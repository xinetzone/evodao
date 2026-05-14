import { useState, useRef, useCallback, useEffect } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { parseFilesFromOutput } from "@/lib/parseFiles";

export type AgentStatus = "idle" | "planning" | "executing" | "done" | "error";
export type TaskStatus = "pending" | "blocked" | "running" | "completed" | "error";
export type OutputMode = "text" | "agent" | "qa" | "image";
export type EvolutionStatus = "idle" | "reflecting" | "reflected";

export interface Task {
  id: number;
  title: string;
  description: string;
  dependsOn?: number[];
  tools?: string[];           // declared tool capabilities (e.g. "search", "code", "analyze")
}

export interface AgentFile {
  path: string;
  content: string;
  language: string;
  taskId: number;
}

export interface ReflectionResult {
  qualityScore: number;       // 0–100
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  evolvedGoal: string;        // refined goal for next round
}

export interface EvolutionContext {
  round: number;
  qualityScore: number;
  improvements: string[];
  evolvedGoal: string;
}

export interface HistoryEntry {
  id: string;
  goal: string;
  tasks: Task[];
  taskOutputs: Record<number, string>;
  taskStatuses: Record<number, TaskStatus>;
  completedAt: number;
  outputMode?: OutputMode;
  extractedFiles?: AgentFile[];
  evolutionRound?: number;
}

export interface SavedSession {
  goal: string;
  tasks: Task[];
  taskStatuses: Record<number, TaskStatus>;
  taskOutputs: Record<number, string>;
  savedAt: number;
  outputMode?: OutputMode;
  extractedFiles?: AgentFile[];
}

export interface QAMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const STORAGE_KEY = "evodao-session";
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

/** DFS-based cycle detector: strips back edges so the task graph is always a valid DAG */
function stripCycles(tasks: Task[]): Task[] {
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  function dfs(id: number, path: Set<number>) {
    if (visited.has(id)) return;
    path.add(id);
    visiting.add(id);
    const task = taskMap.get(id);
    if (task?.dependsOn) {
      task.dependsOn = task.dependsOn.filter((depId) => {
        if (path.has(depId)) return false; // back edge → strip
        dfs(depId, path);
        return true;
      });
    }
    path.delete(id);
    visited.add(id);
  }

  tasks.forEach((t) => { if (!visited.has(t.id)) dfs(t.id, new Set()); });
  return tasks;
}

function loadSavedSession(): SavedSession | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const session = JSON.parse(data) as SavedSession;
    const hasIncomplete = session.tasks.some(
      (t) => session.taskStatuses[t.id] !== "completed"
    );
    return hasIncomplete ? session : null;
  } catch {
    return null;
  }
}

const MAX_EVOLUTION_ROUNDS = 5;

type RawUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

export function useEvodaoAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<number, TaskStatus>>({});
  const [taskOutputs, setTaskOutputs] = useState<Record<number, string>>({});
  const [activeTaskIds, setActiveTaskIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [currentGoal, setCurrentGoal] = useState<string>("");
  const [outputMode, setOutputMode] = useState<OutputMode>("text");
  const [extractedFiles, setExtractedFiles] = useState<AgentFile[]>([]);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(loadSavedSession);
  // Evolution state
  const [evolutionStatus, setEvolutionStatus] = useState<EvolutionStatus>("idle");
  const [reflection, setReflection] = useState<ReflectionResult | null>(null);
  const [evolutionRound, setEvolutionRound] = useState(0);
  // Q&A state
  const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
  // Token usage
  const [sessionUsage, setSessionUsage] = useState<TokenUsage>({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

  const abortControllerRef = useRef<AbortController | null>(null);
  // Per-task abort controllers for parallel execution
  const taskControllersRef = useRef<Map<number, AbortController>>(new Map());
  const taskOutputsRef = useRef<Record<number, string>>({});
  const extractedFilesRef = useRef<AgentFile[]>([]);
  const qaMessagesRef = useRef<QAMessage[]>([]);
  // Stable refs for use inside applyEvolution callback
  const outputModeRef = useRef<OutputMode>("text");
  const currentGoalRef = useRef<string>("");
  const evolutionRoundRef = useRef(0);
  const reflectionRef = useRef<ReflectionResult | null>(null);

  // Sync refs with state
  useEffect(() => { taskOutputsRef.current = taskOutputs; }, [taskOutputs]);
  useEffect(() => { extractedFilesRef.current = extractedFiles; }, [extractedFiles]);
  useEffect(() => { outputModeRef.current = outputMode; }, [outputMode]);
  useEffect(() => { currentGoalRef.current = currentGoal; }, [currentGoal]);
  useEffect(() => { evolutionRoundRef.current = evolutionRound; }, [evolutionRound]);
  useEffect(() => { reflectionRef.current = reflection; }, [reflection]);
  useEffect(() => { qaMessagesRef.current = qaMessages; }, [qaMessages]);

  // Auto-save
  useEffect(() => {
    if (tasks.length === 0 || !currentGoal) return;

    if (status === "done" || status === "idle") {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

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
      outputMode,
      extractedFiles: extractedFilesRef.current,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [tasks, taskStatuses, status, currentGoal, outputMode]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    taskControllersRef.current.forEach((ctrl) => ctrl.abort());
    taskControllersRef.current.clear();
    localStorage.removeItem(STORAGE_KEY);
    setSavedSession(null);
    setStatus("idle");
    setTasks([]);
    setTaskStatuses({});
    setTaskOutputs({});
    setActiveTaskIds(new Set());
    setError(null);
    setCurrentGoal("");
    setOutputMode("text");
    setExtractedFiles([]);
    setEvolutionStatus("idle");
    setReflection(null);
    setEvolutionRound(0);
    setQaMessages([]);
    setSessionUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  }, []);

  /** Clears only the QA conversation, keeps status idle */
  const resetQA = useCallback(() => {
    abortControllerRef.current?.abort();
    setQaMessages([]);
    setError(null);
    setStatus("idle");
    setSessionUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  }, []);

  const dismissSavedSession = useCallback(() => {
    setSavedSession(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // ── Core helpers ──────────────────────────────────────────────────────────

  const planTasks = async (
    goal: string,
    mode: OutputMode,
    evolutionCtx?: EvolutionContext,
    model?: string
  ): Promise<Task[]> => {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ mode: "plan", goal, outputMode: mode, evolutionContext: evolutionCtx, model }),
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
    mode: OutputMode,
    onChunk: (chunk: string) => void,
    evolutionCtx?: EvolutionContext,
    model?: string,
    externalSignal?: AbortSignal
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Local controller manages SSE lifecycle (abort-on-done to prevent retries)
      const localController = new AbortController();
      let settled = false;

      // Forward external abort (e.g. user pressed Stop) to local controller
      if (externalSignal) {
        externalSignal.addEventListener("abort", () => localController.abort(), { once: true });
      }

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        localController.abort();
        fn();
      };

      fetchEventSource(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          mode: "execute",
          goal,
          task,
          context,
          outputMode: mode,
          evolutionContext: evolutionCtx,
          model,
        }),
        signal: localController.signal,

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
          if (event.data === "[DONE]") { settle(() => resolve()); return; }
          if (!event.data) return;

          let data: Record<string, unknown>;
          try { data = JSON.parse(event.data); } catch { return; }

          if ((data as { error?: { type?: string; message?: string } }).error) {
            const err = (data as { error: { type?: string; message?: string } }).error;
            const errorMsg = getUserErrorMessage(err.type || "api_error", err.message || "");
            settle(() => reject(new Error(errorMsg)));
            return;
          }

          // Accumulate token usage when present (usage-only chunk or final chunk)
          const rawUsage = (data as { usage?: RawUsage }).usage;
          if (rawUsage) {
            setSessionUsage((prev) => ({
              promptTokens: prev.promptTokens + (rawUsage.prompt_tokens || 0),
              completionTokens: prev.completionTokens + (rawUsage.completion_tokens || 0),
              totalTokens: prev.totalTokens + (rawUsage.total_tokens || 0),
            }));
          }

          const choice = (
            data as { choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }> }
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

  // ── DAG-aware execution loop (Trae SOLO architecture) ────────────────────
  // Independent tasks run immediately in parallel; tasks with dependsOn wait
  // for their direct prerequisites and receive their outputs as context.
  const runExecutionLoop = async (
    goal: string,
    plannedTasks: Task[],
    startStatuses: Record<number, TaskStatus>,
    startOutputs: Record<number, string>,
    mode: OutputMode,
    startFiles: AgentFile[],
    onComplete?: (entry: HistoryEntry) => void,
    evolutionCtx?: EvolutionContext,
    model?: string,
    memoryContext?: string[]   // injected long-term memory from Coze 长期记忆节点
  ) => {
    // Deep-copy tasks and strip any cycles so the graph is a valid DAG
    const safeTasks = stripCycles(
      plannedTasks.map((t) => ({ ...t, dependsOn: t.dependsOn ? [...t.dependsOn] : [] }))
    );
    const taskMap = new Map(safeTasks.map((t) => [t.id, t]));

    // Context from already-completed tasks (e.g. resumed session) — 400 chars each
    // Long-term memory entries are prepended (labeled [LONG-TERM MEMORY])
    const sessionContext = safeTasks
      .filter((t) => startStatuses[t.id] === "completed")
      .map((t) => {
        const out = startOutputs[t.id] || "";
        return `[Task ${t.id}: ${t.title}]\n${out.substring(0, 400)}${out.length > 400 ? "..." : ""}`;
      });
    const completedContext = [...(memoryContext || []), ...sessionContext];

    if (startFiles.length > 0) setExtractedFiles(startFiles);

    const pendingTasks = safeTasks.filter((t) => startStatuses[t.id] !== "completed");

    // Parent run controller — aborting this stops all tasks
    const runController = new AbortController();
    abortControllerRef.current = runController;
    taskControllersRef.current.clear();

    // Initialise statuses: "blocked" if has unmet deps, "pending" otherwise
    const initialStatuses: Record<number, TaskStatus> = {};
    const initialOutputs: Record<number, string> = {};
    pendingTasks.forEach((t) => {
      const unmetDeps = (t.dependsOn || []).filter((depId) => startStatuses[depId] !== "completed");
      initialStatuses[t.id] = unmetDeps.length > 0 ? "blocked" : "pending";
      initialOutputs[t.id] = "";
    });
    setTaskStatuses((prev) => ({ ...prev, ...initialStatuses }));
    setTaskOutputs((prev) => ({ ...prev, ...initialOutputs }));

    // ── Promise-cache DAG scheduler ────────────────────────────────────────
    // getOrExecute(id) returns a stable promise for each task.
    // A task awaits its deps' promises before executing — guaranteeing that
    // outputs flow top-down while maximising parallelism.
    const taskPromises = new Map<number, Promise<string>>();

    const getOrExecute = (taskId: number): Promise<string> => {
      if (taskPromises.has(taskId)) return taskPromises.get(taskId)!;

      // Already completed from a resumed session → resolve immediately
      if (startStatuses[taskId] === "completed") {
        const p = Promise.resolve(startOutputs[taskId] || "");
        taskPromises.set(taskId, p);
        return p;
      }

      const task = taskMap.get(taskId);
      if (!task) return Promise.resolve("");

      const deps = task.dependsOn || [];

      const p = (async (): Promise<string> => {
        // Await all direct dependency promises (they run concurrently)
        const depOutputsList = await Promise.all(deps.map((depId) => getOrExecute(depId)));

        // Propagate abort that occurred while waiting for deps
        if (runController.signal.aborted) {
          throw Object.assign(new Error("Aborted"), { name: "AbortError" });
        }

        // Build dep context — 800 chars per direct dep, most relevant info
        const depContext = deps.map((depId, i) => {
          const depTask = taskMap.get(depId);
          const out = depOutputsList[i] || "";
          return `[Task ${depId}: ${depTask?.title || depId}]\n${out.substring(0, 800)}${out.length > 800 ? "..." : ""}`;
        });

        // Transition: blocked/pending → running
        setTaskStatuses((prev) => ({ ...prev, [taskId]: "running" }));
        setActiveTaskIds((prev) => new Set([...prev, taskId]));

        const taskController = new AbortController();
        taskControllersRef.current.set(taskId, taskController);
        runController.signal.addEventListener("abort", () => taskController.abort(), { once: true });

        let taskContent = "";
        try {
          await executeTask(
            goal, task, [...completedContext, ...depContext], mode,
            (chunk) => {
              taskContent += chunk;
              setTaskOutputs((prev) => ({ ...prev, [taskId]: (prev[taskId] || "") + chunk }));
            },
            evolutionCtx, model, taskController.signal
          );

          setTaskStatuses((prev) => ({ ...prev, [taskId]: "completed" }));

          if (mode === "agent") {
            const newFiles = parseFilesFromOutput(taskContent, taskId);
            if (newFiles.length > 0) setExtractedFiles((prev) => [...prev, ...newFiles]);
          }

          return taskContent;
        } catch (err) {
          if (!(err instanceof Error && err.name === "AbortError")) {
            setTaskStatuses((prev) => ({ ...prev, [taskId]: "error" }));
          }
          throw err;
        } finally {
          taskControllersRef.current.delete(taskId);
          setActiveTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
          });
        }
      })();

      taskPromises.set(taskId, p);
      return p;
    };

    // Kick off every pending task — the DAG handles sequencing internally
    const results = await Promise.allSettled(pendingTasks.map((t) => getOrExecute(t.id)));

    setActiveTaskIds(new Set());

    // Surface the first abort or error
    const firstAbort = results.find(
      (r) => r.status === "rejected" && r.reason instanceof Error && r.reason.name === "AbortError"
    );
    if (firstAbort) throw Object.assign(new Error("Aborted"), { name: "AbortError" });

    const firstError = results.find((r) => r.status === "rejected");
    if (firstError) throw (firstError as PromiseRejectedResult).reason;

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
        outputMode: mode,
        extractedFiles: [...extractedFilesRef.current],
        evolutionRound: evolutionCtx?.round ?? evolutionRoundRef.current,
      });
    }

    setStatus("done");
  };

  // ── Public actions ────────────────────────────────────────────────────────

  const runAgent = useCallback(async (
    goal: string,
    mode: OutputMode = "text",
    onComplete?: (entry: HistoryEntry) => void,
    evolutionCtx?: EvolutionContext,
    model?: string,
    memoryContext?: string[]   // long-term memory context (Coze 长期记忆检索节点)
  ) => {
    // ── Q&A Mode: single streaming call, no planning ──────────────────────
    if (mode === "qa") {
      setOutputMode("qa");
      setCurrentGoal(goal);
      setError(null);

      const userMsg: QAMessage = { role: "user", content: goal };
      // messages to send to API (completed exchanges only)
      const historyMsgs = qaMessagesRef.current
        .filter((m) => !m.streaming)
        .map((m) => ({ role: m.role, content: m.content }));
      const messagesForAPI = [...historyMsgs, { role: "user", content: goal }];

      setQaMessages((prev) => [
        ...prev.filter((m) => !m.streaming),
        userMsg,
        { role: "assistant", content: "", streaming: true },
      ]);
      setStatus("executing");

      const controller = new AbortController();
      abortControllerRef.current = controller;
      let settled = false;
      let assistantContent = "";

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        controller.abort();
        fn();
      };

      try {
        await new Promise<void>((resolve, reject) => {
          fetchEventSource(EDGE_FUNCTION_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ mode: "chat", messages: messagesForAPI, model }),
            signal: controller.signal,

            async onopen(response) {
              if (!response.ok) {
                const err = new Error(`Request failed: ${response.status}`);
                settle(() => reject(err));
                throw err;
              }
            },

            onmessage(event) {
              if (event.data === "[DONE]") { settle(() => resolve()); return; }
              if (!event.data) return;
              let data: Record<string, unknown>;
              try { data = JSON.parse(event.data); } catch { return; }

              const errObj = (data as { error?: { type?: string; message?: string } }).error;
              if (errObj) {
                settle(() => reject(new Error(errObj.message || "Chat error")));
                return;
              }

              // Accumulate token usage
              const rawUsage = (data as { usage?: RawUsage }).usage;
              if (rawUsage) {
                setSessionUsage((prev) => ({
                  promptTokens: prev.promptTokens + (rawUsage.prompt_tokens || 0),
                  completionTokens: prev.completionTokens + (rawUsage.completion_tokens || 0),
                  totalTokens: prev.totalTokens + (rawUsage.total_tokens || 0),
                }));
              }

              const choice = (
                data as { choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }> }
              ).choices?.[0];
              if (!choice) return;
              if (choice.delta?.content) {
                assistantContent += choice.delta.content;
                setQaMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                    streaming: true,
                  };
                  return updated;
                });
              }
              if (choice.finish_reason) settle(() => resolve());
            },

            onerror(err) {
              if (settled) throw err;
              if (err instanceof Error && err.name === "AbortError") throw err;
              settle(() => reject(err));
              throw err;
            },
          });
        });

        // Finalize assistant message, auto-reset to idle for follow-up
        setQaMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantContent };
          return updated;
        });
        setStatus("idle");
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setQaMessages((prev) => prev.slice(0, -1)); // remove pending assistant
        setError(err instanceof Error ? err.message : "Chat failed");
        setStatus("error");
      }
      return;
    }

    // ── Task / Agent Build Mode ───────────────────────────────────────────
    setCurrentGoal(goal);
    setOutputMode(mode);
    setStatus("planning");
    setError(null);
    setTasks([]);
    setTaskStatuses({});
    setTaskOutputs({});
    setActiveTaskIds(new Set());
    setExtractedFiles([]);
    setSavedSession(null);
    if (!evolutionCtx) {
      // Fresh run resets evolution
      setEvolutionStatus("idle");
      setReflection(null);
      setEvolutionRound(0);
    }

    try {
      const plannedTasks = await planTasks(goal, mode, evolutionCtx, model);
      setTasks(plannedTasks);

      const initialStatuses: Record<number, TaskStatus> = {};
      plannedTasks.forEach((t) => {
        initialStatuses[t.id] = (t.dependsOn || []).length > 0 ? "blocked" : "pending";
      });
      setTaskStatuses(initialStatuses);

      setStatus("executing");
      await runExecutionLoop(goal, plannedTasks, initialStatuses, {}, mode, [], onComplete, evolutionCtx, model, memoryContext);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Agent failed");
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeAgent = useCallback(async (onComplete?: (entry: HistoryEntry) => void) => {
    if (!savedSession) return;

    const {
      goal,
      tasks: rTasks,
      taskStatuses: rStatuses,
      taskOutputs: rOutputs,
      outputMode: rMode = "text",
      extractedFiles: rFiles = [],
    } = savedSession;

    setCurrentGoal(goal);
    setOutputMode(rMode);
    setTasks(rTasks);
    setTaskStatuses(rStatuses);
    setTaskOutputs(rOutputs);
    setStatus("executing");
    setError(null);
    setSavedSession(null);

    try {
      await runExecutionLoop(goal, rTasks, rStatuses, rOutputs, rMode, rFiles, onComplete);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Agent failed");
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSession]);

  // ── Evolution actions ─────────────────────────────────────────────────────

  /** Triggers self-reflection on the completed run */
  const evolve = useCallback(async () => {
    if (evolutionRoundRef.current >= MAX_EVOLUTION_ROUNDS) return;
    setEvolutionStatus("reflecting");
    setReflection(null);

    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          mode: "reflect",
          goal: currentGoalRef.current,
          tasks: tasks,
          taskOutputs: taskOutputsRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error(`Reflection failed: ${response.status}`);
      }

      const result: ReflectionResult = await response.json();
      setReflection(result);
      setEvolutionStatus("reflected");
    } catch {
      setEvolutionStatus("idle");
    }
  }, [tasks]);

  /** Re-runs the agent with reflection insights baked in */
  const applyEvolution = useCallback(async (onComplete?: (entry: HistoryEntry) => void) => {
    const r = reflectionRef.current;
    if (!r) return;

    const newRound = evolutionRoundRef.current + 1;
    setEvolutionRound(newRound);
    setEvolutionStatus("idle");
    setReflection(null);

    const evolutionCtx: EvolutionContext = {
      round: newRound,
      qualityScore: r.qualityScore,
      improvements: r.improvements,
      evolvedGoal: r.evolvedGoal,
    };

    await runAgent(r.evolvedGoal, outputModeRef.current, onComplete, evolutionCtx);
  }, [runAgent]);

  const dismissEvolution = useCallback(() => {
    setEvolutionStatus("idle");
    setReflection(null);
  }, []);

  return {
    status,
    tasks,
    taskStatuses,
    taskOutputs,
    activeTaskIds,
    error,
    currentGoal,
    outputMode,
    extractedFiles,
    savedSession,
    evolutionStatus,
    reflection,
    evolutionRound,
    maxEvolutionRounds: MAX_EVOLUTION_ROUNDS,
    runAgent,
    resumeAgent,
    dismissSavedSession,
    reset,
    evolve,
    applyEvolution,
    dismissEvolution,
    qaMessages,
    resetQA,
    sessionUsage,
  };
}
