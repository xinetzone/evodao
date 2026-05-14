/**
 * useMemory — Long-term memory hook (Coze 长期记忆节点).
 * Persists completed agent sessions to Supabase and retrieves
 * relevant past sessions to inject as context in new runs.
 */
import { useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

export interface MemoryItem {
  id: string;
  goal: string;
  outputMode: string;
  taskSummaries: string;
  qualityScore?: number;
  evolutionRound: number;
  createdAt: string;
}

export interface SaveMemoryParams {
  goal: string;
  outputMode: string;
  taskSummaries: string;
  qualityScore?: number;
  evolutionRound?: number;
}

export function useMemory() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchMemory = useCallback(async (
    _goal: string,
    limit = 3
  ): Promise<MemoryItem[]> => {
    setIsSearching(true);
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error } = await supabase
        .from("agent_memory")
        .select("id, goal, output_mode, task_summaries, quality_score, evolution_round, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error || !data) return [];

      const items: MemoryItem[] = data.map((row) => ({
        id: row.id,
        goal: row.goal,
        outputMode: row.output_mode,
        taskSummaries: row.task_summaries,
        qualityScore: row.quality_score ?? undefined,
        evolutionRound: row.evolution_round ?? 0,
        createdAt: row.created_at,
      }));

      setMemories(items);
      return items;
    } catch {
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const saveMemory = useCallback(async (params: SaveMemoryParams): Promise<void> => {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await supabase.from("agent_memory").insert({
        goal: params.goal,
        output_mode: params.outputMode,
        task_summaries: params.taskSummaries,
        quality_score: params.qualityScore ?? null,
        evolution_round: params.evolutionRound ?? 0,
      });
    } catch {
      // Memory save is best-effort — never block the user
    }
  }, []);

  const clearMemories = useCallback(() => setMemories([]), []);

  /** Format memories as context strings for injection into task execution */
  const formatAsContext = useCallback((items: MemoryItem[]): string[] => {
    return items.slice(0, 3).map((mem, i) => {
      const lines = [
        `[LONG-TERM MEMORY #${i + 1}]`,
        `Past goal: ${mem.goal}`,
        mem.qualityScore != null ? `Quality score: ${mem.qualityScore}/100` : "",
        `Summary:`,
        mem.taskSummaries.substring(0, 600),
      ].filter(Boolean);
      return lines.join("\n");
    });
  }, []);

  return { memories, isSearching, searchMemory, saveMemory, clearMemories, formatAsContext };
}
