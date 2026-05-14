import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/context/AuthContext";
import { OutputMode, TokenUsage } from "@/hooks/useEvodaoAgent";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: "daily_run" | "daily_image" | "monthly" | "daily_token" | "monthly_token";
  used: number;
  limit: number;
}

export function useUsageQuota() {
  const { user, profile, isAdmin } = useAuthContext();

  const checkQuota = useCallback(
    async (outputMode: OutputMode): Promise<QuotaCheckResult> => {
      if (isAdmin || !user || !profile) return { allowed: true, used: 0, limit: 0 };

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const p = profile;

      // ── Run count checks ──────────────────────────────────────────────────
      if (outputMode !== "image" && p.daily_run_limit != null) {
        const { count } = await supabase
          .from("usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .neq("output_mode", "image")
          .gte("created_at", todayStart);
        const used = count ?? 0;
        if (used >= p.daily_run_limit)
          return { allowed: false, reason: "daily_run", used, limit: p.daily_run_limit };
      }

      if (outputMode === "image" && p.daily_image_limit != null) {
        const { count } = await supabase
          .from("usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("output_mode", "image")
          .gte("created_at", todayStart);
        const used = count ?? 0;
        if (used >= p.daily_image_limit)
          return { allowed: false, reason: "daily_image", used, limit: p.daily_image_limit };
      }

      if (p.monthly_run_limit != null) {
        const { count } = await supabase
          .from("usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", monthStart);
        const used = count ?? 0;
        if (used >= p.monthly_run_limit)
          return { allowed: false, reason: "monthly", used, limit: p.monthly_run_limit };
      }

      // ── Token quota checks (LLM modes only) ──────────────────────────────
      if (outputMode !== "image" && p.daily_token_limit != null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("usage_logs")
          .select("total_tokens")
          .eq("user_id", user.id)
          .gte("created_at", todayStart);
        const used = (data as { total_tokens: number }[] | null)?.reduce(
          (s, r) => s + (r.total_tokens ?? 0), 0
        ) ?? 0;
        if (used >= p.daily_token_limit)
          return { allowed: false, reason: "daily_token", used, limit: p.daily_token_limit };
      }

      if (outputMode !== "image" && p.monthly_token_limit != null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("usage_logs")
          .select("total_tokens")
          .eq("user_id", user.id)
          .gte("created_at", monthStart);
        const used = (data as { total_tokens: number }[] | null)?.reduce(
          (s, r) => s + (r.total_tokens ?? 0), 0
        ) ?? 0;
        if (used >= p.monthly_token_limit)
          return { allowed: false, reason: "monthly_token", used, limit: p.monthly_token_limit };
      }

      return { allowed: true, used: 0, limit: 0 };
    },
    [user, profile, isAdmin]
  );

  /** Inserts a usage log row at run start. Returns the new row's ID. */
  const recordUsage = useCallback(
    async (outputMode: OutputMode): Promise<string | null> => {
      if (isAdmin || !user) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("usage_logs")
        .insert({ user_id: user.id, output_mode: outputMode })
        .select("id")
        .single();
      return (data as { id: string } | null)?.id ?? null;
    },
    [user, isAdmin]
  );

  /** Updates the usage log row with actual token counts after a run completes. */
  const finalizeUsage = useCallback(
    async (logId: string, tokens: TokenUsage) => {
      if (!logId || !tokens.totalTokens) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("usage_logs")
        .update({
          prompt_tokens: tokens.promptTokens,
          completion_tokens: tokens.completionTokens,
          total_tokens: tokens.totalTokens,
        })
        .eq("id", logId);
    },
    []
  );

  return { checkQuota, recordUsage, finalizeUsage };
}
