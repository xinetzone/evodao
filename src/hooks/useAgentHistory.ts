import { useState, useCallback, useEffect, useRef } from "react";
import { HistoryEntry, AgentFile } from "./useEvodaoAgent";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type { HistoryEntry };

const LOCAL_HISTORY_KEY = "evodao-history";
const MAX_ENTRIES = 20;
const MAX_OUTPUT_CHARS = 6000;

// Truncate task outputs to avoid oversized DB rows
function truncateOutputs(outputs: Record<number, string>): Record<number, string> {
  const result: Record<number, string> = {};
  for (const [k, v] of Object.entries(outputs)) {
    result[Number(k)] = typeof v === "string" && v.length > MAX_OUTPUT_CHARS
      ? v.slice(0, MAX_OUTPUT_CHARS) + "…"
      : v;
  }
  return result;
}

// Strip file content to reduce DB size (keep metadata only)
function stripFileContent(files: AgentFile[]): AgentFile[] {
  return files.map(({ path, language, taskId }) => ({
    path,
    language,
    taskId,
    content: "",
  }));
}

// LocalStorage fallback (used when user is not logged in)
function loadLocalHistory(): HistoryEntry[] {
  try {
    const data = localStorage.getItem(LOCAL_HISTORY_KEY);
    return data ? (JSON.parse(data) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function persistLocalHistory(entries: HistoryEntry[]) {
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(entries));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEntry(row: Record<string, any>): HistoryEntry {
  return {
    id: row.id as string,
    goal: row.goal as string,
    tasks: (row.tasks ?? []) as HistoryEntry["tasks"],
    taskOutputs: (row.task_outputs ?? {}) as HistoryEntry["taskOutputs"],
    taskStatuses: (row.task_statuses ?? {}) as HistoryEntry["taskStatuses"],
    completedAt: row.completed_at as number,
    outputMode: row.output_mode as HistoryEntry["outputMode"],
    extractedFiles: (row.extracted_files ?? []) as AgentFile[],
    evolutionRound: row.evolution_round as number,
  };
}

export function useAgentHistory() {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const migratedRef = useRef(false);

  // Fetch history from Supabase (or localStorage if not logged in)
  const fetchHistory = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("agent_history")
        .select("*")
        .eq("user_id", uid)
        .order("completed_at", { ascending: false })
        .limit(MAX_ENTRIES);

      if (error) throw error;
      setEntries((data ?? []).map(rowToEntry));
    } catch {
      // Fall back to local if DB fails
      setEntries(loadLocalHistory());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // One-time migration: push localStorage entries into Supabase
  const migrateLocalToRemote = useCallback(async (uid: string) => {
    if (migratedRef.current) return;
    migratedRef.current = true;

    const local = loadLocalHistory();
    if (local.length === 0) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("agent_history")
        .select("id")
        .eq("user_id", uid)
        .limit(1);

      if (existing && existing.length > 0) {
        // DB already has data — skip migration, just clear local
        localStorage.removeItem(LOCAL_HISTORY_KEY);
        return;
      }

      const rows = local.map((e) => ({
        id: e.id,
        user_id: uid,
        goal: e.goal,
        tasks: e.tasks,
        task_outputs: truncateOutputs(e.taskOutputs),
        task_statuses: e.taskStatuses,
        completed_at: e.completedAt,
        output_mode: e.outputMode ?? "text",
        extracted_files: stripFileContent(e.extractedFiles ?? []),
        evolution_round: e.evolutionRound ?? 0,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("agent_history").upsert(rows);
      localStorage.removeItem(LOCAL_HISTORY_KEY);
    } catch {
      // Migration failed silently — local data preserved
    }
  }, []);

  // Load history when user logs in
  useEffect(() => {
    if (!userId) {
      // Not logged in — use localStorage
      setEntries(loadLocalHistory());
      setIsLoading(false);
      return;
    }
    migrateLocalToRemote(userId).then(() => fetchHistory(userId));
  }, [userId, fetchHistory, migrateLocalToRemote]);

  const addEntry = useCallback(async (entry: HistoryEntry) => {
    // Optimistic update
    setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));

    if (!userId) {
      // Fallback: persist locally
      const next = [entry, ...loadLocalHistory()].slice(0, MAX_ENTRIES);
      persistLocalHistory(next);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("agent_history").upsert({
        id: entry.id,
        user_id: userId,
        goal: entry.goal,
        tasks: entry.tasks,
        task_outputs: truncateOutputs(entry.taskOutputs),
        task_statuses: entry.taskStatuses,
        completed_at: entry.completedAt,
        output_mode: entry.outputMode ?? "text",
        extracted_files: stripFileContent(entry.extractedFiles ?? []),
        evolution_round: entry.evolutionRound ?? 0,
      });
    } catch {
      // DB write failed — optimistic state already applied, no action needed
    }
  }, [userId]);

  const removeEntry = useCallback(async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));

    if (!userId) {
      const next = loadLocalHistory().filter((e) => e.id !== id);
      persistLocalHistory(next);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("agent_history").delete().eq("id", id).eq("user_id", userId);
    } catch {
      // Silent fail — UI already updated
    }
  }, [userId]);

  const clearHistory = useCallback(async () => {
    setEntries([]);
    localStorage.removeItem(LOCAL_HISTORY_KEY);

    if (!userId) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("agent_history").delete().eq("user_id", userId);
    } catch {
      // Silent fail
    }
  }, [userId]);

  return { entries, isLoading, addEntry, removeEntry, clearHistory };
}
