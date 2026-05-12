import { useState, useRef, useCallback } from "react";
import { Task, TaskStatus, AgentStatus, OutputMode } from "@/hooks/useEvodaoAgent";
import { planTasksCore, executeTaskCore } from "@/lib/agentCore";

export interface AgentSession {
  id: string;
  goal: string;
  outputMode: OutputMode;
  model: string;
  status: AgentStatus;
  tasks: Task[];
  taskStatuses: Record<number, TaskStatus>;
  taskOutputs: Record<number, string>;
  activeTaskIds: Set<number>;
  error: string | null;
  createdAt: number;
  completedAt?: number;
}

export function useTaskManager() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const runControllersRef = useRef<Map<string, AbortController>>(new Map());

  const _runSession = useCallback(async (
    id: string,
    goal: string,
    outputMode: OutputMode,
    model: string
  ) => {
    const runCtrl = new AbortController();
    runControllersRef.current.set(id, runCtrl);

    try {
      // ── Planning ──────────────────────────────────────────────────────────
      const tasks = await planTasksCore(goal, outputMode, model);

      const initStatuses: Record<number, TaskStatus> = {};
      tasks.forEach((t) => { initStatuses[t.id] = "pending"; });

      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: "executing", tasks, taskStatuses: initStatuses,
                activeTaskIds: new Set(tasks.map((t) => t.id)) }
            : s
        )
      );

      // ── Parallel execution ────────────────────────────────────────────────
      const results = await Promise.allSettled(
        tasks.map(async (task) => {
          const taskCtrl = new AbortController();
          runCtrl.signal.addEventListener("abort", () => taskCtrl.abort(), { once: true });

          // Mark task running + clear output
          setSessions((prev) =>
            prev.map((s) =>
              s.id === id
                ? { ...s,
                    taskStatuses: { ...s.taskStatuses, [task.id]: "running" },
                    taskOutputs: { ...s.taskOutputs, [task.id]: "" } }
                : s
            )
          );

          try {
            await executeTaskCore(
              goal, task, [], outputMode, model, taskCtrl.signal,
              (chunk) => {
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === id
                      ? { ...s, taskOutputs: {
                          ...s.taskOutputs,
                          [task.id]: (s.taskOutputs[task.id] || "") + chunk,
                        } }
                      : s
                  )
                );
              }
            );

            setSessions((prev) =>
              prev.map((s) =>
                s.id === id
                  ? {
                      ...s,
                      taskStatuses: { ...s.taskStatuses, [task.id]: "completed" },
                      activeTaskIds: new Set([...s.activeTaskIds].filter((x) => x !== task.id)),
                    }
                  : s
              )
            );
          } catch (err) {
            if (!(err instanceof Error && err.name === "AbortError")) {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === id
                    ? { ...s, taskStatuses: { ...s.taskStatuses, [task.id]: "error" } }
                    : s
                )
              );
            }
            throw err;
          }
        })
      );

      // Handle abort / error outcomes
      const firstAbort = results.find(
        (r) => r.status === "rejected" && r.reason instanceof Error && r.reason.name === "AbortError"
      );
      if (firstAbort) return; // aborted by user — status already set by abortSession

      const firstError = results.find((r) => r.status === "rejected");
      if (firstError) throw (firstError as PromiseRejectedResult).reason;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: "done", activeTaskIds: new Set(), completedAt: Date.now() }
            : s
        )
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: "error", activeTaskIds: new Set(),
                error: err instanceof Error ? err.message : "Session failed" }
            : s
        )
      );
    } finally {
      runControllersRef.current.delete(id);
    }
  }, []);

  /** Add a new session and immediately start executing it */
  const addSession = useCallback((goal: string, outputMode: OutputMode, model: string) => {
    const id = crypto.randomUUID();
    setSessions((prev) => [
      {
        id, goal, outputMode, model,
        status: "planning",
        tasks: [], taskStatuses: {}, taskOutputs: {},
        activeTaskIds: new Set(),
        error: null,
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    _runSession(id, goal, outputMode, model);
  }, [_runSession]);

  /** Abort a running session */
  const abortSession = useCallback((id: string) => {
    runControllersRef.current.get(id)?.abort();
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "idle", activeTaskIds: new Set() } : s
      )
    );
  }, []);

  /** Remove a session from the list (aborts if running) */
  const removeSession = useCallback((id: string) => {
    runControllersRef.current.get(id)?.abort();
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  /** Remove all completed and errored sessions */
  const clearCompleted = useCallback(() => {
    setSessions((prev) => prev.filter((s) => s.status === "planning" || s.status === "executing"));
  }, []);

  const runningCount = sessions.filter(
    (s) => s.status === "planning" || s.status === "executing"
  ).length;

  return { sessions, addSession, abortSession, removeSession, clearCompleted, runningCount };
}
