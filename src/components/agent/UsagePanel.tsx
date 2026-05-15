import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BarChart2, X, RefreshCw, Zap, Cpu, DollarSign, TrendingUp, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useUserUsage } from "@/hooks/useUserUsage";
import { useAuthContext } from "@/context/AuthContext";
import { MODEL_DISPLAY, IMAGE_MODEL_DISPLAY } from "@/lib/models";

interface UsagePanelProps {
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
}

/* ── Formatting helpers ──────────────────────────────────────────────── */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtTime(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (lang.startsWith("zh")) {
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h前`;
    return `${Math.floor(diff / 86_400_000)}d前`;
  }
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ── Skeleton helpers ───────────────────────────────────────────────── */
function SkeletonLine({ w = "w-16", h = "h-3" }: { w?: string; h?: string }) {
  return <div className={cn("rounded bg-border/50 animate-pulse", w, h)} />;
}

/* ── Stat card (fixed height to prevent layout shift) ───────────────── */
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  loading: boolean;
  accent?: boolean;
}
function StatCard({ label, value, sub, loading, accent }: StatCardProps) {
  return (
    <div className="rounded border border-border bg-background/50 px-3 py-2.5 h-[68px] flex flex-col justify-between">
      <p className="text-[9px] tracking-widest text-muted-foreground/55">{label}</p>
      {loading ? (
        <div className="space-y-1.5">
          <SkeletonLine w="w-12" h="h-4" />
          {sub !== undefined && <SkeletonLine w="w-8" h="h-2.5" />}
        </div>
      ) : (
        <div>
          <p className={cn(
            "text-base font-bold font-mono leading-none",
            accent ? "text-primary/80" : "text-foreground"
          )}>
            {value}
          </p>
          {sub && <p className="text-[9px] font-mono text-muted-foreground/35 mt-0.5">{sub}</p>}
        </div>
      )}
    </div>
  );
}

/* ── Quota bar ──────────────────────────────────────────────────────── */
function QuotaBar({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const pct = Math.min(100, (used / limit) * 100);
  const isOver = used >= limit;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground/65">{label}</span>
        <span className={cn("text-[10px] font-mono font-semibold", isOver ? "text-destructive" : "text-foreground/65")}>
          {used} / {limit}{unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", isOver ? "bg-destructive" : pct > 80 ? "bg-yellow-500/70" : "bg-primary/60")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Mode badge ─────────────────────────────────────────────────────── */
const MODE_BADGE: Record<string, string> = {
  text:  "text-sky-600    bg-sky-100/60    dark:text-sky-400    dark:bg-sky-400/10",
  agent: "text-violet-600 bg-violet-100/60 dark:text-violet-400 dark:bg-violet-400/10",
  qa:    "text-emerald-600 bg-emerald-100/60 dark:text-emerald-400 dark:bg-emerald-400/10",
  image: "text-orange-600 bg-orange-100/60 dark:text-orange-400 dark:bg-orange-400/10",
};

/* ── Main panel ─────────────────────────────────────────────────────── */
export function UsagePanel({ open, onClose, refreshKey }: UsagePanelProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { profile } = useAuthContext();
  const { stats, fetchStats } = useUserUsage();

  useEffect(() => {
    if (open) fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshKey]); // re-fetch when a run finalizes (refreshKey increments)

  const hasQuotas =
    profile?.daily_run_limit != null ||
    profile?.daily_image_limit != null ||
    profile?.monthly_run_limit != null;

  const isLoading = stats.loading || !stats.loaded;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md flex flex-col",
          "bg-card border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border shrink-0">
          <BarChart2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-bold tracking-widest text-primary flex-1">
            {t("usage.title")}
          </span>
          <button
            onClick={fetchStats}
            disabled={stats.loading}
            className="p-1.5 text-muted-foreground/50 hover:text-foreground rounded transition-colors"
            title={t("usage.refresh")}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", stats.loading && "animate-spin")} />
          </button>
          <button onClick={onClose} className="p-1.5 text-muted-foreground/50 hover:text-foreground rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable content ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-6">

            {/* Today */}
            <section>
              <h3 className="text-[9px] font-bold tracking-widest text-muted-foreground/60 mb-2.5 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-primary/50" />
                {t("usage.todaySection")}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <StatCard
                  label={t("usage.todayRuns")}
                  value={String(stats.todayRuns)}
                  sub={profile?.daily_run_limit != null ? `/ ${profile.daily_run_limit}` : undefined}
                  loading={isLoading}
                />
                <StatCard label={t("usage.todayTokens")} value={fmtTokens(stats.todayTokens)} loading={isLoading} />
                <StatCard label={t("usage.todayCost")} value={`$${stats.todayCostUsd.toFixed(4)}`} loading={isLoading} accent />
              </div>
            </section>

            {/* Month */}
            <section>
              <h3 className="text-[9px] font-bold tracking-widest text-muted-foreground/60 mb-2.5 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-primary/50" />
                {t("usage.monthSection")}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <StatCard
                  label={t("usage.monthRuns")}
                  value={String(stats.monthRuns)}
                  sub={profile?.monthly_run_limit != null ? `/ ${profile.monthly_run_limit}` : undefined}
                  loading={isLoading}
                />
                <StatCard label={t("usage.monthTokens")} value={fmtTokens(stats.monthTokens)} loading={isLoading} />
                <StatCard label={t("usage.monthCost")} value={`$${stats.monthCostUsd.toFixed(4)}`} loading={isLoading} accent />
              </div>
            </section>

            {/* Quota bars */}
            {hasQuotas && (
              <section>
                <h3 className="text-[9px] font-bold tracking-widest text-muted-foreground/60 mb-2.5 flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-primary/50" />
                  {t("usage.quotaSection")}
                </h3>
                <div className="space-y-3">
                  {profile?.daily_run_limit != null && (
                    <QuotaBar label={t("usage.dailyRunQuota")} used={stats.todayRuns} limit={profile.daily_run_limit} />
                  )}
                  {profile?.daily_image_limit != null && (
                    <QuotaBar label={t("usage.dailyImageQuota")} used={stats.todayImageRuns} limit={profile.daily_image_limit} />
                  )}
                  {profile?.monthly_run_limit != null && (
                    <QuotaBar label={t("usage.monthlyRunQuota")} used={stats.monthRuns} limit={profile.monthly_run_limit} />
                  )}
                </div>
              </section>
            )}

            {/* Recent runs */}
            <section>
              <h3 className="text-[9px] font-bold tracking-widest text-muted-foreground/60 mb-2.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-primary/50" />
                {t("usage.recentRuns")}
              </h3>

              {isLoading ? (
                /* Skeleton rows */
                <div className="space-y-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded border border-border/50 bg-background/30 px-3 py-2.5 flex items-center gap-3">
                      <SkeletonLine w="w-10" />
                      <div className="flex-1 space-y-1">
                        <SkeletonLine w="w-24" />
                        <SkeletonLine w="w-10" h="h-2" />
                      </div>
                      <SkeletonLine w="w-8" />
                      <SkeletonLine w="w-12" />
                    </div>
                  ))}
                </div>
              ) : stats.recentLogs.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/35 text-center py-8 tracking-widest">
                  {t("usage.noData")}
                </p>
              ) : (
                /* Stable flex list — no table layout shifts */
                <div className="space-y-1">
                  {stats.recentLogs.map((r, i) => {
                    const modelName =
                      MODEL_DISPLAY[r.model_id as keyof typeof MODEL_DISPLAY]?.name ??
                      IMAGE_MODEL_DISPLAY[r.model_id as keyof typeof IMAGE_MODEL_DISPLAY]?.name ??
                      r.model_id?.split("/")[1] ?? "—";
                    const badgeCls = MODE_BADGE[r.output_mode] ?? "text-muted-foreground bg-muted/30";
                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "flex items-center gap-2 rounded border border-border/40 bg-background/30 px-3 py-2 text-[10px]",
                          i % 2 === 0 ? "" : "bg-card/20"
                        )}
                      >
                        {/* Time */}
                        <span className="w-12 shrink-0 font-mono text-muted-foreground/45 text-[9px]">
                          {fmtTime(r.created_at, lang)}
                        </span>
                        {/* Mode badge */}
                        <span className={cn("shrink-0 text-[8px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5", badgeCls)}>
                          {r.output_mode}
                        </span>
                        {/* Model name */}
                        <span className="flex-1 min-w-0 truncate text-foreground/65">
                          {modelName}
                        </span>
                        {/* Tokens */}
                        <span className="shrink-0 w-10 text-right font-mono text-foreground/50 text-[9px]">
                          {r.total_tokens != null ? fmtTokens(r.total_tokens) : "—"}
                        </span>
                        {/* Cost */}
                        <span className="shrink-0 w-14 text-right font-mono text-primary/60 text-[9px]">
                          {r.cost_usd != null && Number(r.cost_usd) > 0
                            ? `$${Number(r.cost_usd).toFixed(4)}`
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Bottom note */}
            <p className="text-[9px] text-muted-foreground/25 text-center tracking-wider pb-2 flex items-center justify-center gap-1">
              <DollarSign className="w-2.5 h-2.5" />
              {t("usage.costNote")}
            </p>

          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
