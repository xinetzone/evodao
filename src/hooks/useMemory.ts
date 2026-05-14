/**
 * useMemory — Long-term memory hook (Coze 长期记忆节点).
 * Persists completed agent sessions to Supabase and retrieves
 * relevant past sessions to inject as context in new runs.
 *
 * Agent 自我进化技能学习成果：
 * - searchMemory 现在使用 goal 关键词过滤相关记忆（而非仅按时间排序）
 * - 高质量记忆（quality_score 越高）优先被召回
 * - saveMemory 返回新记录 id，供后续回填 quality_score
 * - updateMemoryScore 在 QA 评估完成后回填 quality_score
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

function rowToItem(row: Record<string, unknown>): MemoryItem {
  return {
    id: row.id as string,
    goal: row.goal as string,
    outputMode: row.output_mode as string,
    taskSummaries: row.task_summaries as string,
    qualityScore: row.quality_score != null ? (row.quality_score as number) : undefined,
    evolutionRound: (row.evolution_round as number) ?? 0,
    createdAt: row.created_at as string,
  };
}

export function useMemory() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  /**
   * Goal-aware memory retrieval (Agent 自我进化核心修复).
   *
   * Strategy:
   * 1. Extract keywords (length > 3) from goal — up to 5 words
   * 2. Query agent_memory with ILIKE filter for any keyword
   * 3. Sort: quality_score DESC NULLS LAST → created_at DESC
   * 4. If relevant results < limit, back-fill with most-recent records
   */
  const searchMemory = useCallback(async (
    goal: string,
    limit = 3
  ): Promise<MemoryItem[]> => {
    setIsSearching(true);
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const SELECT = "id, goal, output_mode, task_summaries, quality_score, evolution_round, created_at";

      // Extract meaningful keywords from the goal
      const keywords = goal
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);

      let relevant: MemoryItem[] = [];

      if (keywords.length > 0) {
        // OR-filter: any keyword match in the stored goal text
        const orFilter = keywords.map((k) => `goal.ilike.%${k}%`).join(",");
        const { data } = await supabase
          .from("agent_memory")
          .select(SELECT)
          .or(orFilter)
          .order("quality_score", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(limit);

        relevant = (data ?? []).map(rowToItem);
      }

      // Back-fill with recent memories if we didn't find enough relevant ones
      if (relevant.length < limit) {
        const needed = limit - relevant.length;
        const existingIds = new Set(relevant.map((m) => m.id));
        const { data: recent } = await supabase
          .from("agent_memory")
          .select(SELECT)
          .order("created_at", { ascending: false })
          .limit(limit + relevant.length); // over-fetch to account for deduplication

        const extras = (recent ?? [])
          .map(rowToItem)
          .filter((m) => !existingIds.has(m.id))
          .slice(0, needed);

        relevant = [...relevant, ...extras];
      }

      setMemories(relevant);
      return relevant;
    } catch {
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Saves a completed run to long-term memory.
   * Returns the new record's id so the caller can later back-fill quality_score.
   */
  const saveMemory = useCallback(async (params: SaveMemoryParams): Promise<string | null> => {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await supabase
        .from("agent_memory")
        .insert({
          goal: params.goal,
          output_mode: params.outputMode,
          task_summaries: params.taskSummaries,
          quality_score: params.qualityScore ?? null,
          evolution_round: params.evolutionRound ?? 0,
        })
        .select("id")
        .single();

      return data?.id ?? null;
    } catch {
      // Memory save is best-effort — never block the user
      return null;
    }
  }, []);

  /**
   * Back-fills quality_score after a QA evaluation completes.
   * Called from Index.tsx when reflection state is set.
   */
  const updateMemoryScore = useCallback(async (id: string, qualityScore: number): Promise<void> => {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await supabase
        .from("agent_memory")
        .update({ quality_score: qualityScore })
        .eq("id", id);
    } catch {
      // Best-effort, non-blocking
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

  return { memories, isSearching, searchMemory, saveMemory, updateMemoryScore, clearMemories, formatAsContext };
}
