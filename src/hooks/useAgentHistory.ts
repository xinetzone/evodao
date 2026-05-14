import { useState, useCallback } from "react";
import { HistoryEntry } from "./useEvodaoAgent";

export type { HistoryEntry };

const HISTORY_KEY = "evodao-history";
const MAX_ENTRIES = 20;

function loadHistory(): HistoryEntry[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? (JSON.parse(data) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function persistHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export function useAgentHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => {
      const next = [entry, ...prev].slice(0, MAX_ENTRIES);
      persistHistory(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persistHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY);
    setEntries([]);
  }, []);

  return { entries, addEntry, removeEntry, clearHistory };
}
