import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/context/AuthContext";
import { OutputMode } from "@/hooks/useEvodaoAgent";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: "daily_run" | "daily_image" | "monthly";
  used: number;
  limit: number;
}

export function useUsageQuota() {
  const { user, profile, isAdmin } = useAuthContext();

  const checkQuota = useCallback(
    async (outputMode: OutputMode): Promise<QuotaCheckResult> => {
      // Admin and unauthenticated bypass all quota checks
      if (isAdmin || !user || !profile) return { allowed: true, used: 0, limit: 0 };

      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = profile as any;

      // Check daily non-image runs
      if (outputMode !== "image" && p.daily_run_limit != null) {
        const { count } = await supabase
          .from("usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .neq("output_mode", "image")
          .gte("created_at", todayStart);
        const used = count ?? 0;
        if (used >= p.daily_run_limit) {
          return { allowed: false, reason: "daily_run", used, limit: p.daily_run_limit };
        }
      }

      // Check daily image runs
      if (outputMode === "image" && p.daily_image_limit != null) {
        const { count } = await supabase
          .from("usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("output_mode", "image")
          .gte("created_at", todayStart);
        const used = count ?? 0;
        if (used >= p.daily_image_limit) {
          return { allowed: false, reason: "daily_image", used, limit: p.daily_image_limit };
        }
      }

      // Check monthly total
      if (p.monthly_run_limit != null) {
        const { count } = await supabase
          .from("usage_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", monthStart);
        const used = count ?? 0;
        if (used >= p.monthly_run_limit) {
          return { allowed: false, reason: "monthly", used, limit: p.monthly_run_limit };
        }
      }

      return { allowed: true, used: 0, limit: 0 };
    },
    [user, profile, isAdmin]
  );

  const recordUsage = useCallback(
    async (outputMode: OutputMode) => {
      if (isAdmin || !user) return;
      await supabase
        .from("usage_logs")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({ user_id: user.id, output_mode: outputMode } as any);
    },
    [user, isAdmin]
  );

  return { checkQuota, recordUsage };
}
