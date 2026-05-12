import { useState, useRef, useCallback } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

export type AgentStatus = "idle" | "planning" | "executing" | "done" | "error";
export type TaskStatus = "pending" | "running" | "completed" | "error";

export interface Task {
  id: number;
  title: string;
  description: string;
}

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

export function useHarnessAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<number, TaskStatus>>({});
  const [taskOutputs, setTaskOutputs] = useState<Record<number, string>>({});
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentGoal, setCurrentGoal] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus("idle");
    setTasks([]);
    setTaskStatuses({});
    setTaskOutputs({});
    setActiveTaskId(null);
    setError(null);
    setCurrentGoal("");
  }, []);

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

      // Ensure only one resolution/rejection, and abort the SSE connection
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

          // Stream-level error from edge function
          if ((data as { error?: { type?: string; message?: string } }).error) {
            const err = (data as { error: { type?: string; message?: string } }).error;
            const errorMsg = getUserErrorMessage(err.type || "api_error", err.message || "");
            settle(() => reject(new Error(errorMsg)));
            return;
          }

          const choice = (data as { choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }> }).choices?.[0];
          if (!choice) return;

          if (choice.delta?.content) {
            onChunk(choice.delta.content);
          }

          if (choice.finish_reason) {
            settle(() => resolve());
          }
        },

        onerror(err) {
          // Already settled (e.g. we aborted after [DONE]): silently stop retrying
          if (settled) {
            throw err;
          }
          // User-triggered abort: don't reject with error
          if (err instanceof Error && err.name === "AbortError") {
            throw err;
          }
          // Real network/server error
          settle(() => reject(err));
          throw err; // stop retrying
        },
      });
    });
  };

  const runAgent = useCallback(async (goal: string) => {
    setCurrentGoal(goal);
    setStatus("planning");
    setError(null);
    setTasks([]);
    setTaskStatuses({});
    setTaskOutputs({});
    setActiveTaskId(null);

    try {
      // Phase 1: Plan
      const plannedTasks = await planTasks(goal);
      setTasks(plannedTasks);

      const initialStatuses: Record<number, TaskStatus> = {};
      plannedTasks.forEach((t) => {
        initialStatuses[t.id] = "pending";
      });
      setTaskStatuses(initialStatuses);

      setStatus("executing");

      // Phase 2: Execute each task sequentially
      const completedSummaries: string[] = [];

      for (const task of plannedTasks) {
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
          const errMsg = taskError instanceof Error ? taskError.message : "Task failed";
          if (errMsg.includes("AbortError") || (taskError instanceof Error && taskError.name === "AbortError")) {
            return;
          }
          setTaskStatuses((prev) => ({ ...prev, [task.id]: "error" }));
          throw taskError;
        }
      }

      setActiveTaskId(null);
      setStatus("done");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Agent failed";
      if (err instanceof Error && err.name === "AbortError") return;
      setError(errMsg);
      setStatus("error");
    }
  }, []);

  return {
    status,
    tasks,
    taskStatuses,
    taskOutputs,
    activeTaskId,
    error,
    currentGoal,
    runAgent,
    reset,
  };
}
