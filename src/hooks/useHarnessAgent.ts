import { useState, useRef, useCallback, useEffect } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

export type AgentStatus = "idle" | "planning" | "executing" | "done" | "error";
export type TaskStatus = "pending" | "running" | "completed" | "error";

export interface Task {
  id: number;
  title: string;
  description: string;
}

export interface HistoryEntry {
  id: string;
  goal: string;
  tasks: Task[];
  taskOutputs: Record<number, string>;
  taskStatuses: Record<number, TaskStatus>;
  completedAt: number;
}

export interface SavedSession {
  goal: string;
  tasks: Task[];
  taskStatuses: Record<number, TaskStatus>;
  taskOutputs: Record<number, string>;
  savedAt: number;
}

const STORAGE_KEY = "harness-agent-session";
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/harness-agent`;

const FALLBACK_MESSAGES: Record<string, string> = {
  authentication_error: "Authentication failed. Please refresh the page.",
  rate_limit_error: "Too many requests. Please try again later.",
  invalid_request_error: "Invalid request. Please try again.",
  overloaded_error: "Service is busy. Please try again later.",
  insufficient_credits: "AI credits have been exhausted. Please contact the administrator.",
  permission_error: "AI capability is disabled. Please contact the administrator.",
  api_error: "Service temporarily unavailable.",
};

function getUserErrorMessage(code: string, backendMessage: string): string {
  if (backendMessage) return backendMessage;
  return FALLBACK_MESSAGES[code] || "Service temporarily unavailable.";
}

function loadSavedSession(): SavedSession | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const session = JSON.parse(data) as SavedSession;
    // Only return if there are incomplete tasks
    const hasIncomplete = session.tasks.some(
      (t) => session.taskStatuses[t.id] !== "completed"
    );
    return hasIncomplete ? session : null;
  } catch {
    return null;
  }
}

export function useHarnessAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<number, TaskStatus>>({});
  const [taskOutputs, setTaskOutputs] = useState<Record<number, string>>({});
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentGoal, setCurrentGoal] = useState<string>("");
  const [savedSession, setSavedSession] = useState<SavedSession | null>(loadSavedSession);

  const abortControllerRef = useRef<AbortController | null>(null);
  // Keep a ref of taskOutputs to read in the save effect without triggering it on every chunk
  const taskOutputsRef = useRef<Record<number, string>>({});

  // Sync ref with state
  useEffect(() => {
    taskOutputsRef.current = taskOutputs;
  }, [taskOutputs]);

  // Auto-save: fires when task statuses or task list changes (not on every streaming chunk)
  useEffect(() => {
    if (tasks.length === 0 || !currentGoal) return;

    if (status === "done" || status === "idle") {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Normalize "running" → "pending" so resume always starts clean
    const normalizedStatuses: Record<number, TaskStatus> = {};
    const savedOutputs: Record<number, string> = {};
    tasks.forEach((t) => {
      const s = taskStatuses[t.id] || "pending";
      normalizedStatuses[t.id] = s === "running" ? "pending" : s;
      if (s === "completed") {
        savedOutputs[t.id] = taskOutputsRef.current[t.id] || "";
      }
    });

    const session: SavedSession = {
      goal: currentGoal,
      tasks,
      taskStatuses: normalizedStatuses,
      taskOutputs: savedOutputs,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [tasks, taskStatuses, status, currentGoal]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    localStorage.removeItem(STORAGE_KEY);
    setSavedSession(null);
    setStatus("idle");
    setTasks([]);
    setTaskStatuses({});
    setTaskOutputs({});
    setActiveTaskId(null);
    setError(null);
    setCurrentGoal("");
  }, []);

  const dismissSavedSession = useCallback(() => {
    setSavedSession(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // ── Core helpers ──────────────────────────────────────────────────────────

  const planTasks = async (goal: string): Promise<Task[]> => {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ mode: "plan", goal }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Planning failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.tasks)) {
      throw new Error("Invalid task plan received from agent");
    }
    return data.tasks;
  };

  const executeTask = (
    goal: string,
    task: Task,
    context: string[],
    onChunk: (chunk: string) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        controller.abort();
        fn();
      };

      fetchEventSource(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mode: "execute", goal, task, context }),
        signal: controller.signal,

        async onopen(response) {
          const contentType = response.headers.get("content-type");
          if (!response.ok) {
            if (contentType?.includes("text/event-stream")) {
              const text = await response.text();
              const dataMatch = text.match(/data: (.+)/);
              if (dataMatch) {
                try {
                  const errorData = JSON.parse(dataMatch[1]);
                  const msg = errorData.error?.message;
                  if (msg) {
                    settle(() => reject(new Error(msg)));
                    throw new Error(msg);
                  }
                } catch (e) {
                  if (e instanceof Error && !e.message.includes("Unexpected token")) throw e;
                }
              }
            }
            const err = new Error(`Request failed: ${response.status}`);
            settle(() => reject(err));
            throw err;
          }
        },

        onmessage(event) {
          if (event.data === "[DONE]") {
            settle(() => resolve());
            return;
          }
          if (!event.data) return;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }

          if ((data as { error?: { type?: string; message?: string } }).error) {
            const err = (data as { error: { type?: string; message?: string } }).error;
            const errorMsg = getUserErrorMessage(err.type || "api_error", err.message || "");
            settle(() => reject(new Error(errorMsg)));
            return;
          }

          const choice = (
            data as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
            }
          ).choices?.[0];
          if (!choice) return;

          if (choice.delta?.content) onChunk(choice.delta.content);
          if (choice.finish_reason) settle(() => resolve());
        },

        onerror(err) {
          if (settled) { throw err; }
          if (err instanceof Error && err.name === "AbortError") { throw err; }
          settle(() => reject(err));
          throw err;
        },
      });
    });
  };

  // Shared execution loop — used by both runAgent and resumeAgent
  const runExecutionLoop = async (
    goal: string,
    plannedTasks: Task[],
    startStatuses: Record<number, TaskStatus>,
    startOutputs: Record<number, string>,
    onComplete?: (entry: HistoryEntry) => void
  ) => {
    // Build context from already-completed tasks
    const completedSummaries: string[] = plannedTasks
      .filter((t) => startStatuses[t.id] === "completed")
      .map((t) => {
        const out = startOutputs[t.id] || "";
        return `[Task ${t.id}: ${t.title}]\n${out.substring(0, 400)}${out.length > 400 ? "..." : ""}`;
      });

    for (const task of plannedTasks) {
      if (startStatuses[task.id] === "completed") continue;

      setActiveTaskId(task.id);
      setTaskStatuses((prev) => ({ ...prev, [task.id]: "running" }));
      setTaskOutputs((prev) => ({ ...prev, [task.id]: "" }));

      let taskContent = "";

      try {
        await executeTask(goal, task, completedSummaries, (chunk) => {
          taskContent += chunk;
          setTaskOutputs((prev) => ({
            ...prev,
            [task.id]: (prev[task.id] || "") + chunk,
          }));
        });

        setTaskStatuses((prev) => ({ ...prev, [task.id]: "completed" }));
        completedSummaries.push(
          `[Task ${task.id}: ${task.title}]\n${taskContent.substring(0, 400)}${taskContent.length > 400 ? "..." : ""}`
        );
      } catch (taskError: unknown) {
        if (taskError instanceof Error && taskError.name === "AbortError") throw taskError;
        setTaskStatuses((prev) => ({ ...prev, [task.id]: "error" }));
        throw taskError;
      }
    }

    setActiveTaskId(null);

    if (onComplete) {
      const finalStatuses: Record<number, TaskStatus> = {};
      plannedTasks.forEach((t) => { finalStatuses[t.id] = "completed"; });
      onComplete({
        id: Date.now().toString(),
        goal,
        tasks: plannedTasks,
        taskOutputs: { ...taskOutputsRef.current },
        taskStatuses: finalStatuses,
        completedAt: Date.now(),
      });
    }

    setStatus("done");
  };

  // ── Public actions ────────────────────────────────────────────────────────

  const runAgent = useCallback(async (goal: string, onComplete?: (entry: HistoryEntry) => void) => {
    setCurrentGoal(goal);
    setStatus("planning");
    setError(null);
    setTasks([]);
    setTaskStatuses({});
    setTaskOutputs({});
    setActiveTaskId(null);
    setSavedSession(null);

    try {
      const plannedTasks = await planTasks(goal);
      setTasks(plannedTasks);

      const initialStatuses: Record<number, TaskStatus> = {};
      plannedTasks.forEach((t) => { initialStatuses[t.id] = "pending"; });
      setTaskStatuses(initialStatuses);

      setStatus("executing");
      await runExecutionLoop(goal, plannedTasks, initialStatuses, {}, onComplete);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Agent failed");
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeAgent = useCallback(async (onComplete?: (entry: HistoryEntry) => void) => {
    if (!savedSession) return;

    const { goal, tasks: rTasks, taskStatuses: rStatuses, taskOutputs: rOutputs } = savedSession;

    setCurrentGoal(goal);
    setTasks(rTasks);
    setTaskStatuses(rStatuses);
    setTaskOutputs(rOutputs);
    setStatus("executing");
    setError(null);
    setSavedSession(null);

    try {
      await runExecutionLoop(goal, rTasks, rStatuses, rOutputs, onComplete);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Agent failed");
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSession]);

  return {
    status,
    tasks,
    taskStatuses,
    taskOutputs,
    activeTaskId,
    error,
    currentGoal,
    savedSession,
    runAgent,
    resumeAgent,
    dismissSavedSession,
    reset,
  };
}
