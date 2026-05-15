import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Shield, Users, Brain, Trash2, ChevronLeft, Loader, RefreshCw, ToggleLeft, ToggleRight, Gauge, Zap, BarChart3, DollarSign, Cpu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { PLAN_CONFIGS } from "@/lib/planConfig";
import { MODEL_DISPLAY, IMAGE_MODEL_DISPLAY } from "@/lib/models";

type AdminTab = "users" | "memories" | "quotas" | "usage";

interface UsageLog {
  id: string;
  user_id: string;
  output_mode: string;
  model_id: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

interface ModelStat {
  model_id: string;
  runs: number;
  total_tokens: number;
  cost_usd: number;
}

interface UsageSummary {
  totalRuns: number;
  totalTokens: number;
  totalCostUsd: number;
}


interface UserRow {
  id: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  daily_run_limit: number | null;
  daily_image_limit: number | null;
  monthly_run_limit: number | null;
  daily_token_limit: number | null;
  monthly_token_limit: number | null;
  subscription_plan: "basic" | "pro" | null;
  subscription_status: "active" | "cancelled" | null;
}

interface MemoryRow {
  id: string;
  goal: string;
  output_mode: string;
  task_summaries: string;
  quality_score: number | null;
  evolution_round: number;
  created_at: string;
}

export default function Admin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuthContext();

  const [tab, setTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState<Record<string, number>>({});
  const [monthlyTokenUsage, setMonthlyTokenUsage] = useState<Record<string, number>>({});
  type QuotaField = "daily_run_limit" | "daily_image_limit" | "monthly_run_limit" | "daily_token_limit" | "monthly_token_limit";
  const [editingQuota, setEditingQuota] = useState<{ userId: string; field: QuotaField; value: string } | null>(null);

  // ── Usage Analytics state ────────────────────────────────────────────────
  const [usageSummary, setUsageSummary] = useState<UsageSummary>({ totalRuns: 0, totalTokens: 0, totalCostUsd: 0 });
  const [modelStats, setModelStats] = useState<ModelStat[]>([]);
  const [recentRuns, setRecentRuns] = useState<UsageLog[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, email, is_admin, created_at, daily_run_limit, daily_image_limit, monthly_run_limit, daily_token_limit, monthly_token_limit, subscription_plan, subscription_status")
      .order("created_at", { ascending: false });
    setUsers((data as UserRow[]) || []);
    setLoadingUsers(false);
  }, []);

  const fetchMonthlyUsage = useCallback(async () => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("usage_logs")
      .select("user_id, total_tokens")
      .gte("created_at", monthStart)
      .limit(5000); // safety cap to prevent full-table fetch
    if (data) {
      const counts: Record<string, number> = {};
      const tokens: Record<string, number> = {};
      for (const row of data) {
        counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
        tokens[row.user_id] = (tokens[row.user_id] ?? 0) + (row.total_tokens ?? 0);
      }
      setMonthlyUsage(counts);
      setMonthlyTokenUsage(tokens);
    }
  }, []);

  const fetchUsageStats = useCallback(async () => {
    setLoadingUsage(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: all } = await (supabase as any)
      .from("usage_logs")
      .select("id, user_id, output_mode, model_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows: UsageLog[] = all ?? [];

    // Summary
    const summary: UsageSummary = { totalRuns: rows.length, totalTokens: 0, totalCostUsd: 0 };
    const modelMap: Record<string, ModelStat> = {};
    for (const r of rows) {
      summary.totalTokens += r.total_tokens ?? 0;
      summary.totalCostUsd += r.cost_usd ?? 0;
      const mid = r.model_id ?? "(unknown)";
      if (!modelMap[mid]) modelMap[mid] = { model_id: mid, runs: 0, total_tokens: 0, cost_usd: 0 };
      modelMap[mid].runs++;
      modelMap[mid].total_tokens += r.total_tokens ?? 0;
      modelMap[mid].cost_usd += r.cost_usd ?? 0;
    }

    setUsageSummary(summary);
    setModelStats(Object.values(modelMap).sort((a, b) => b.total_tokens - a.total_tokens));
    setRecentRuns(rows.slice(0, 50));
    setLoadingUsage(false);
  }, []);

  const saveQuota = useCallback(async (userId: string, field: QuotaField, value: string) => {
    const numVal = value.trim() === "" ? null : parseInt(value);
    if (value.trim() !== "" && (isNaN(numVal as number) || (numVal as number) < 0)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("profiles").update({ [field]: numVal }).eq("id", userId);
    setEditingQuota(null);
    // Optimistic update — no re-fetch needed
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, [field]: numVal } : u));
  }, []);

  const assignPlan = useCallback(async (userId: string, plan: "basic" | "pro" | null) => {
    if (plan === null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("profiles")
        .update({ subscription_plan: null, subscription_status: null })
        .eq("id", userId);
      // Optimistic update
      setUsers((prev) => prev.map((u) => u.id === userId
        ? { ...u, subscription_plan: null, subscription_status: null }
        : u));
    } else {
      const preset = PLAN_CONFIGS.find((p) => p.id === plan);
      if (!preset) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("profiles").update({
        subscription_plan: plan,
        subscription_status: "active",
        daily_run_limit: preset.daily_run_limit,
        daily_image_limit: preset.daily_image_limit,
        monthly_run_limit: preset.monthly_run_limit,
        daily_token_limit: preset.daily_token_limit,
        monthly_token_limit: preset.monthly_token_limit,
      }).eq("id", userId);
      // Optimistic update
      setUsers((prev) => prev.map((u) => u.id === userId
        ? {
            ...u,
            subscription_plan: plan,
            subscription_status: "active",
            daily_run_limit: preset.daily_run_limit,
            daily_image_limit: preset.daily_image_limit,
            monthly_run_limit: preset.monthly_run_limit,
            daily_token_limit: preset.daily_token_limit,
            monthly_token_limit: preset.monthly_token_limit,
          }
        : u));
    }
  }, []);

  const fetchMemories = useCallback(async () => {
    setLoadingMemories(true);
    const { data } = await supabase
      .from("agent_memory")
      .select("id, goal, output_mode, task_summaries, quality_score, evolution_round, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setMemories((data as MemoryRow[]) || []);
    setLoadingMemories(false);
  }, []);

  // On mount: parallel fetch users + monthly usage
  useEffect(() => { Promise.all([fetchUsers(), fetchMonthlyUsage()]); }, [fetchUsers, fetchMonthlyUsage]);
  // Load memories only when that tab is first opened
  useEffect(() => { if (tab === "memories") fetchMemories(); }, [tab, fetchMemories]);
  // Load usage analytics when that tab is opened
  useEffect(() => { if (tab === "usage") fetchUsageStats(); }, [tab, fetchUsageStats]);

  const toggleAdmin = async (user: UserRow) => {
    if (user.id === profile?.id) return; // Can't demote yourself
    setTogglingId(user.id);
    await supabase
      .from("profiles")
      .update({ is_admin: !user.is_admin })
      .eq("id", user.id);
    // Optimistic update — no re-fetch needed
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u));
    setTogglingId(null);
  };

  const deleteMemory = async (id: string) => {
    setDeletingId(id);
    await supabase.from("agent_memory").delete().eq("id", id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setDeletingId(null);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs tracking-wider"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t("admin.backToApp")}
            </button>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold tracking-[0.2em] text-primary">
                {t("admin.title")}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground/50 font-mono tracking-widest">
            {profile?.email}
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded border border-border bg-card w-fit mb-6">
          <button
            onClick={() => setTab("users")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-widest rounded transition-all duration-150",
              tab === "users"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            {t("admin.users")}
          </button>
          <button
            onClick={() => setTab("memories")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-widest rounded transition-all duration-150",
              tab === "memories"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Brain className="w-3.5 h-3.5" />
            {t("admin.memories")}
          </button>
          <button
            onClick={() => setTab("quotas")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-widest rounded transition-all duration-150",
              tab === "quotas"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Gauge className="w-3.5 h-3.5" />
            {t("admin.quotas")}
          </button>
          <button
            onClick={() => setTab("usage")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-widest rounded transition-all duration-150",
              tab === "usage"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {t("admin.usageAnalytics", "用量统计")}
          </button>
        </div>

        {/* Users Table */}
        {tab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground tracking-widest">
                {t("admin.totalUsers", { count: users.length })}
              </p>
              <button
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all"
              >
                <RefreshCw className={cn("w-3 h-3", loadingUsers && "animate-spin")} />
                {t("admin.refresh")}
              </button>
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-16">
                <Loader className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground/50 text-xs py-16 tracking-widest">
                {t("admin.noUsers")}
              </p>
            ) : (
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-card/50">
                      <th className="text-left px-4 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.email")}
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold hidden sm:table-cell">
                        {t("admin.createdAt")}
                      </th>
                      <th className="text-center px-4 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.isAdmin")}
                      </th>
                      <th className="text-center px-4 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.toggleAdmin")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr
                        key={u.id}
                        className={cn(
                          "border-b border-border/50 hover:bg-card/30 transition-colors",
                          i === users.length - 1 && "border-b-0"
                        )}
                      >
                        <td className="px-4 py-3 text-foreground/80 font-mono">
                          {u.email || "—"}
                          {u.id === profile?.id && (
                            <span className="ml-2 text-[9px] text-primary/60 border border-primary/20 px-1 rounded">
                              {t("admin.you")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground/60 hidden sm:table-cell font-mono">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "inline-block text-[9px] font-bold tracking-widest px-2 py-0.5 rounded border",
                            u.is_admin
                              ? "border-primary/30 text-primary bg-primary/5"
                              : "border-border text-muted-foreground/50"
                          )}>
                            {u.is_admin ? "ADMIN" : "USER"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleAdmin(u)}
                            disabled={togglingId === u.id || u.id === profile?.id}
                            title={u.id === profile?.id ? t("admin.cannotDemoteSelf") : ""}
                            className={cn(
                              "inline-flex items-center gap-1 transition-colors",
                              u.id === profile?.id
                                ? "opacity-30 cursor-not-allowed"
                                : "text-muted-foreground hover:text-primary"
                            )}
                          >
                            {togglingId === u.id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : u.is_admin ? (
                              <ToggleRight className="w-5 h-5 text-primary" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Memories Table */}
        {tab === "memories" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground tracking-widest">
                {t("admin.totalMemories", { count: memories.length })}
              </p>
              <button
                onClick={fetchMemories}
                disabled={loadingMemories}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all"
              >
                <RefreshCw className={cn("w-3 h-3", loadingMemories && "animate-spin")} />
                {t("admin.refresh")}
              </button>
            </div>

            {loadingMemories ? (
              <div className="flex items-center justify-center py-16">
                <Loader className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : memories.length === 0 ? (
              <p className="text-center text-muted-foreground/50 text-xs py-16 tracking-widest">
                {t("admin.noMemories")}
              </p>
            ) : (
              <div className="space-y-2">
                {memories.map((mem) => (
                  <div
                    key={mem.id}
                    className="rounded border border-border/60 bg-card/20 p-4 hover:border-border transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[9px] font-mono text-primary/50 border border-primary/20 px-1.5 py-0.5 rounded">
                            {mem.output_mode.toUpperCase()}
                          </span>
                          {mem.quality_score != null && (
                            <span className="text-[9px] font-mono text-muted-foreground/50">
                              score: {mem.quality_score}
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-muted-foreground/40">
                            r{mem.evolution_round} · {formatDate(mem.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 font-medium mb-1.5 line-clamp-1">
                          {mem.goal}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 leading-relaxed line-clamp-2">
                          {mem.task_summaries}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteMemory(mem.id)}
                        disabled={deletingId === mem.id}
                        className="shrink-0 p-1.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                        title={t("admin.delete")}
                      >
                        {deletingId === mem.id ? (
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quotas Tab */}
        {tab === "quotas" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-muted-foreground tracking-widest">
                {t("admin.totalUsers", { count: users.length })}
              </p>
              <p className="text-[10px] text-muted-foreground/40 tracking-wider">{t("admin.setUnlimited")}</p>
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-16">
                <Loader className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground/50 text-xs py-16 tracking-widest">
                {t("admin.noQuotas")}
              </p>
            ) : (
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-card/50">
                      <th className="text-left px-4 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.email")}
                      </th>
                      <th className="text-center px-3 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.plan")}
                      </th>
                      <th className="text-center px-3 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.dailyRun")}
                      </th>
                      <th className="text-center px-3 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.dailyImage")}
                      </th>
                      <th className="text-center px-3 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.monthly")}
                      </th>
                      <th className="text-center px-3 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.dailyToken")}
                      </th>
                      <th className="text-center px-3 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.monthlyToken")}
                      </th>
                      <th className="text-center px-3 py-3 text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.thisMonthUsed")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr
                        key={u.id}
                        className={cn(
                          "border-b border-border/50 hover:bg-card/20 transition-colors",
                          i === users.length - 1 && "border-b-0"
                        )}
                      >
                        <td className="px-4 py-3 text-foreground/70 font-mono text-[10px]">
                          {u.email || "—"}
                          {u.is_admin && (
                            <span className="ml-2 text-[8px] text-primary/60 border border-primary/20 px-1 rounded">ADMIN</span>
                          )}
                        </td>
                        {/* Plan assignment cell */}
                        <td className="px-3 py-3 text-center">
                          {u.is_admin ? (
                            <span className="text-[9px] text-muted-foreground/30 tracking-wider">—</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {(["basic", "pro", null] as const).map((plan) => (
                                <button
                                  key={String(plan)}
                                  onClick={() => assignPlan(u.id, plan)}
                                  className={cn(
                                    "text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border transition-colors",
                                    u.subscription_plan === plan && u.subscription_status === "active"
                                      ? "border-primary/50 bg-primary/10 text-primary"
                                      : plan === null && !u.subscription_plan
                                      ? "border-muted-foreground/20 bg-muted/10 text-muted-foreground/50"
                                      : "border-border text-muted-foreground/40 hover:border-primary/30 hover:text-primary/60"
                                  )}
                                >
                                  {plan === null ? "FREE" : plan.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        {(["daily_run_limit", "daily_image_limit", "monthly_run_limit", "daily_token_limit", "monthly_token_limit"] as QuotaField[]).map((field) => (
                          <td key={field} className="px-3 py-3 text-center">
                            {editingQuota?.userId === u.id && editingQuota?.field === field ? (
                              <input
                                type="number"
                                min="0"
                                className="w-16 text-center text-[10px] font-mono bg-background border border-primary/40 rounded px-1 py-0.5 outline-none focus:border-primary"
                                value={editingQuota.value}
                                autoFocus
                                onChange={(e) => setEditingQuota({ ...editingQuota, value: e.target.value })}
                                onBlur={() => saveQuota(u.id, field, editingQuota.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveQuota(u.id, field, editingQuota.value);
                                  if (e.key === "Escape") setEditingQuota(null);
                                }}
                              />
                            ) : (
                              <button
                                onClick={() => setEditingQuota({ userId: u.id, field, value: u[field]?.toString() ?? "" })}
                                className={cn(
                                  "text-[10px] font-mono px-2 py-0.5 rounded border transition-colors hover:border-primary/40 hover:text-primary",
                                  u[field] == null
                                    ? "text-muted-foreground/40 border-transparent"
                                    : "text-foreground/70 border-border/50"
                                )}
                              >
                                {u[field] == null ? t("admin.unlimited") : u[field]}
                              </button>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] font-mono text-muted-foreground/60">
                              {monthlyUsage[u.id] ?? 0} 次
                            </span>
                            {(monthlyTokenUsage[u.id] ?? 0) > 0 && (
                              <span className="text-[9px] font-mono text-primary/50">
                                {Math.round((monthlyTokenUsage[u.id] ?? 0) / 1000)}K tk
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Usage Analytics Tab */}
        {tab === "usage" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs text-muted-foreground tracking-widest">
                {t("admin.usageAnalyticsDesc", "所有用户累计消耗（最近 2000 条运行记录）")}
              </p>
              <button
                onClick={fetchUsageStats}
                disabled={loadingUsage}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all"
              >
                <RefreshCw className={cn("w-3 h-3", loadingUsage && "animate-spin")} />
                {t("admin.refresh")}
              </button>
            </div>

            {loadingUsage ? (
              <div className="flex items-center justify-center py-16">
                <Loader className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="rounded border border-border bg-card/40 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-3.5 h-3.5 text-primary/60" />
                      <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.totalRuns", "总运行次数")}
                      </span>
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">
                      {usageSummary.totalRuns.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded border border-border bg-card/40 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="w-3.5 h-3.5 text-primary/60" />
                      <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.totalTokens", "总 Token 消耗")}
                      </span>
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">
                      {usageSummary.totalTokens >= 1_000_000
                        ? `${(usageSummary.totalTokens / 1_000_000).toFixed(2)}M`
                        : usageSummary.totalTokens >= 1_000
                        ? `${(usageSummary.totalTokens / 1_000).toFixed(1)}K`
                        : usageSummary.totalTokens.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded border border-border bg-card/40 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-3.5 h-3.5 text-primary/60" />
                      <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
                        {t("admin.estimatedCost", "预估费用 (USD)")}
                      </span>
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">
                      ${usageSummary.totalCostUsd.toFixed(4)}
                    </p>
                  </div>
                </div>

                {/* Per-Model Breakdown */}
                {modelStats.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
                      {t("admin.byModel", "按模型统计")}
                    </h3>
                    <div className="rounded border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-card/50">
                            <th className="text-left px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.model", "模型")}
                            </th>
                            <th className="text-center px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.runs", "次数")}
                            </th>
                            <th className="text-right px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.tokens", "Tokens")}
                            </th>
                            <th className="text-right px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.costUsd", "预估费用 (USD)")}
                            </th>
                            <th className="text-right px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.avgTokens", "平均 Tokens/次")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {modelStats.map((ms, i) => {
                            const modelName =
                              MODEL_DISPLAY[ms.model_id as keyof typeof MODEL_DISPLAY]?.name ??
                              IMAGE_MODEL_DISPLAY[ms.model_id as keyof typeof IMAGE_MODEL_DISPLAY]?.name ??
                              ms.model_id;
                            const maxTokens = modelStats[0]?.total_tokens ?? 1;
                            const barPct = Math.round((ms.total_tokens / maxTokens) * 100);
                            return (
                              <tr
                                key={ms.model_id}
                                className={cn(
                                  "border-b border-border/50 hover:bg-card/20 transition-colors",
                                  i === modelStats.length - 1 && "border-b-0"
                                )}
                              >
                                <td className="px-4 py-3">
                                  <div>
                                    <span className="text-foreground/80 font-medium">{modelName}</span>
                                    <span className="ml-2 text-[9px] font-mono text-muted-foreground/40">{ms.model_id}</span>
                                  </div>
                                  <div className="mt-1 h-1 rounded-full bg-border/50 w-32 overflow-hidden">
                                    <div
                                      className="h-1 rounded-full bg-primary/50 transition-all"
                                      style={{ width: `${barPct}%` }}
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center text-foreground/70 font-mono">
                                  {ms.runs.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-foreground/70">
                                  {ms.total_tokens >= 1_000_000
                                    ? `${(ms.total_tokens / 1_000_000).toFixed(2)}M`
                                    : ms.total_tokens >= 1_000
                                    ? `${(ms.total_tokens / 1_000).toFixed(1)}K`
                                    : ms.total_tokens}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-primary/70">
                                  ${ms.cost_usd.toFixed(4)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-muted-foreground/50 text-[10px]">
                                  {ms.runs > 0 ? Math.round(ms.total_tokens / ms.runs).toLocaleString() : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent 50 Runs */}
                {recentRuns.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
                      {t("admin.recentRuns", "最近运行记录")}
                    </h3>
                    <div className="rounded border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-card/50">
                            <th className="text-left px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.time", "时间")}
                            </th>
                            <th className="text-left px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.model", "模型")}
                            </th>
                            <th className="text-center px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.mode", "模式")}
                            </th>
                            <th className="text-right px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.promptTokens", "输入")}
                            </th>
                            <th className="text-right px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.completionTokens", "输出")}
                            </th>
                            <th className="text-right px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.totalTokensCol", "总 Tokens")}
                            </th>
                            <th className="text-right px-4 py-2.5 text-[10px] tracking-widest text-muted-foreground font-semibold">
                              {t("admin.costUsd", "预估费用")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentRuns.map((r, i) => {
                            const modelName =
                              MODEL_DISPLAY[r.model_id as keyof typeof MODEL_DISPLAY]?.name ??
                              IMAGE_MODEL_DISPLAY[r.model_id as keyof typeof IMAGE_MODEL_DISPLAY]?.name ??
                              r.model_id ??
                              "—";
                            return (
                              <tr
                                key={r.id}
                                className={cn(
                                  "border-b border-border/50 hover:bg-card/20 transition-colors",
                                  i === recentRuns.length - 1 && "border-b-0"
                                )}
                              >
                                <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground/60">
                                  {formatDate(r.created_at)}
                                </td>
                                <td className="px-4 py-2.5 text-foreground/70 text-[10px]">{modelName}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className="text-[9px] font-mono text-primary/50 border border-primary/20 px-1.5 py-0.5 rounded">
                                    {r.output_mode?.toUpperCase() ?? "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-muted-foreground/50 text-[10px]">
                                  {r.prompt_tokens?.toLocaleString() ?? "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-muted-foreground/50 text-[10px]">
                                  {r.completion_tokens?.toLocaleString() ?? "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-foreground/70 text-[10px]">
                                  {r.total_tokens?.toLocaleString() ?? "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-primary/70 text-[10px]">
                                  {r.cost_usd != null && r.cost_usd > 0 ? `$${Number(r.cost_usd).toFixed(5)}` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
