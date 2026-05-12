import { useState, useRef, useCallback, useEffect } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { parseFilesFromOutput } from "@/lib/parseFiles";

export type AgentStatus = "idle" | "planning" | "executing" | "done" | "error";
export type TaskStatus = "pending" | "running" | "completed" | "error";
export type OutputMode = "text" | "agent" | "qa";
export type EvolutionStatus = "idle" | "reflecting" | "reflected";

export interface Task {
  id: number;
  title: string;
  description: string;
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

export function useHarnessAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<number, TaskStatus>>({});
  const [taskOutputs, setTaskOutputs] = useState<Record<number, string>>({});
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
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
    localStorage.removeItem(STORAGE_KEY);
    setSavedSession(null);
    setStatus("idle");
    setTasks([]);
    setTaskStatuses({});
    setTaskOutputs({});
    setActiveTaskId(null);
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
    model?: string
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
        body: JSON.stringify({
          mode: "execute",
          goal,
          task,
          context,
          outputMode: mode,
          evolutionContext: evolutionCtx,
          model,
        }),
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

  // Shared execution loop
  const runExecutionLoop = async (
    goal: string,
    plannedTasks: Task[],
    startStatuses: Record<number, TaskStatus>,
    startOutputs: Record<number, string>,
    mode: OutputMode,
    startFiles: AgentFile[],
    onComplete?: (entry: HistoryEntry) => void,
    evolutionCtx?: EvolutionContext,
    model?: string
  ) => {
    const completedSummaries: string[] = plannedTasks
      .filter((t) => startStatuses[t.id] === "completed")
      .map((t) => {
        const out = startOutputs[t.id] || "";
        return `[Task ${t.id}: ${t.title}]\n${out.substring(0, 400)}${out.length > 400 ? "..." : ""}`;
      });

    if (startFiles.length > 0) setExtractedFiles(startFiles);

    for (const task of plannedTasks) {
      if (startStatuses[task.id] === "completed") continue;

      setActiveTaskId(task.id);
      setTaskStatuses((prev) => ({ ...prev, [task.id]: "running" }));
      setTaskOutputs((prev) => ({ ...prev, [task.id]: "" }));

      let taskContent = "";

      try {
        await executeTask(goal, task, completedSummaries, mode, (chunk) => {
          taskContent += chunk;
          setTaskOutputs((prev) => ({ ...prev, [task.id]: (prev[task.id] || "") + chunk }));
        }, evolutionCtx, model);

        setTaskStatuses((prev) => ({ ...prev, [task.id]: "completed" }));

        if (mode === "agent") {
          const newFiles = parseFilesFromOutput(taskContent, task.id);
          if (newFiles.length > 0) setExtractedFiles((prev) => [...prev, ...newFiles]);
        }

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
    model?: string
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
    setActiveTaskId(null);
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
      plannedTasks.forEach((t) => { initialStatuses[t.id] = "pending"; });
      setTaskStatuses(initialStatuses);

      setStatus("executing");
      await runExecutionLoop(goal, plannedTasks, initialStatuses, {}, mode, [], onComplete, evolutionCtx, model);
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
    activeTaskId,
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
