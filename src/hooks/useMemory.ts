/**
 * useMemory — Long-term memory hook (Coze 长期记忆节点).
 *
 * Optimizations vs previous version:
 * 1. Uses shared supabase singleton instead of creating a new client on every call.
 * 2. User-scoped: all operations are filtered to the current user's rows (privacy fix).
 * 3. searchMemory makes ONE DB query (composite index on user_id + quality_score + created_at)
 *    and does relevance ranking client-side — no more 2-round-trip keyword + fallback pattern.
 * 4. CJK-aware keyword extraction: Chinese characters are 1 JS char and are meaningful on their
 *    own, so the threshold is `length >= 1` for CJK segments vs `length > 2` for ASCII.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/context/AuthContext";

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

const SELECT = "id, goal, output_mode, task_summaries, quality_score, evolution_round, created_at";

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

/**
 * Extract keywords from a goal string with CJK awareness.
 * - CJK-containing tokens (e.g. "分析React应用"): keep if length >= 1
 * - ASCII/Latin tokens: keep if length > 2 (avoids stop words like "the", "a")
 */
function extractKeywords(goal: string): string[] {
  return goal
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .filter((w) => /[\u4e00-\u9fff\u3040-\u30ff]/.test(w) ? w.length >= 1 : w.length > 2)
    .slice(0, 8);
}

/**
 * Score a memory item by how many keywords overlap with the current goal.
 */
function keywordScore(mem: MemoryItem, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const lowerGoal = mem.goal.toLowerCase();
  return keywords.filter((k) => lowerGoal.includes(k)).length;
}

export function useMemory() {
  const { user } = useAuthContext();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  /**
   * Retrieve relevant past sessions in a SINGLE DB query.
   *
   * Strategy:
   * 1. Fetch the top 15 memories for this user, ordered by quality_score DESC + created_at DESC.
   *    This hits the composite index on (user_id, quality_score DESC, created_at DESC).
   * 2. Re-rank client-side by keyword overlap → prefer contextually relevant memories
   *    while still falling back to high-quality / recent ones when there are no keyword matches.
   * 3. Return the top `limit` items.
   */
  const searchMemory = useCallback(async (
    goal: string,
    limit = 3
  ): Promise<MemoryItem[]> => {
    if (!user) return [];
    setIsSearching(true);
    try {
      // Single query: composite index (user_id, quality_score DESC, created_at DESC)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("agent_memory")
        .select(SELECT)
        .eq("user_id", user.id)
        .order("quality_score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(15); // candidate pool for client-side ranking

      const items: MemoryItem[] = (data ?? []).map(rowToItem);
      const keywords = extractKeywords(goal);

      // Re-rank by keyword overlap, then quality_score, then recency (already sorted above)
      const ranked = items
        .map((m) => ({ item: m, score: keywordScore(m, keywords) }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return (b.item.qualityScore ?? 0) - (a.item.qualityScore ?? 0);
        })
        .map(({ item }) => item)
        .slice(0, limit);

      setMemories(ranked);
      return ranked;
    } catch {
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [user]);

  /**
   * Saves a completed run to long-term memory.
   * Returns the new record's id so the caller can later back-fill quality_score.
   */
  const saveMemory = useCallback(async (params: SaveMemoryParams): Promise<string | null> => {
    if (!user) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("agent_memory")
        .insert({
          user_id: user.id,
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
  }, [user]);

  /**
   * Back-fills quality_score after a QA evaluation completes.
   * Called from Index.tsx when reflection state is set.
   */
  const updateMemoryScore = useCallback(async (id: string, qualityScore: number): Promise<void> => {
    if (!user) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("agent_memory")
        .update({ quality_score: qualityScore })
        .eq("id", id)
        .eq("user_id", user.id); // explicit guard (RLS also enforces this)
    } catch {
      // Best-effort, non-blocking
    }
  }, [user]);

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
