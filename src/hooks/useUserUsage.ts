/**
 * useUserUsage — Fetches the current user's personal usage stats from usage_logs.
 * Uses a single query (latest 200 rows) and aggregates client-side to avoid multiple round trips.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/context/AuthContext";

export interface UsageLogRow {
  id: string;
  output_mode: string;
  model_id: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

export interface UserUsageStats {
  todayRuns: number;
  todayImageRuns: number;
  todayTokens: number;
  todayCostUsd: number;
  monthRuns: number;
  monthTokens: number;
  monthCostUsd: number;
  recentLogs: UsageLogRow[];
  loading: boolean;
  loaded: boolean;
}

const EMPTY: UserUsageStats = {
  todayRuns: 0,
  todayImageRuns: 0,
  todayTokens: 0,
  todayCostUsd: 0,
  monthRuns: 0,
  monthTokens: 0,
  monthCostUsd: 0,
  recentLogs: [],
  loading: false,
  loaded: false,
};

export function useUserUsage() {
  const { user } = useAuthContext();
  const userId = user?.id;
  const [stats, setStats] = useState<UserUsageStats>(EMPTY);
  const fetchingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (!userId) { setStats(EMPTY); return; }
    if (fetchingRef.current) return;      // prevent concurrent fetches
    fetchingRef.current = true;
    setStats((s) => ({ ...s, loading: true }));

    try {
      const now = new Date();
      const todayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const monthStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("usage_logs")
        .select("id, output_mode, model_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);

      const rows: UsageLogRow[] = data ?? [];

      let todayRuns = 0, todayImageRuns = 0, todayTokens = 0, todayCostUsd = 0;
      let monthRuns = 0, monthTokens = 0, monthCostUsd = 0;

      for (const r of rows) {
        const ms = new Date(r.created_at).getTime();
        const isToday = ms >= todayStartMs;
        const isMonth = ms >= monthStartMs;
        if (isMonth) {
          monthRuns++;
          monthTokens += r.total_tokens ?? 0;
          monthCostUsd += r.cost_usd ? Number(r.cost_usd) : 0;
        }
        if (isToday) {
          todayRuns++;
          todayTokens += r.total_tokens ?? 0;
          todayCostUsd += r.cost_usd ? Number(r.cost_usd) : 0;
          if (r.output_mode === "image") todayImageRuns++;
        }
      }

      setStats({
        todayRuns, todayImageRuns, todayTokens, todayCostUsd,
        monthRuns, monthTokens, monthCostUsd,
        recentLogs: rows.slice(0, 30),
        loading: false,
        loaded: true,
      });
    } finally {
      fetchingRef.current = false;
    }
  }, [userId]);   // ← only userId, not the whole user object

  return { stats, fetchStats };
}

