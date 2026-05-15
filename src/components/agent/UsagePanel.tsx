import { useEffect } from "react";
import { BarChart2, X, RefreshCw, Zap, Cpu, DollarSign, TrendingUp, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useUserUsage } from "@/hooks/useUserUsage";
import { useAuthContext } from "@/context/AuthContext";
import { MODEL_DISPLAY, IMAGE_MODEL_DISPLAY } from "@/lib/models";

interface UsagePanelProps {
  open: boolean;
  onClose: () => void;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtTime(iso: string, lang: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (lang === "zh") {
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return `${Math.floor(diff / 86_400_000)} 天前`;
  }
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface QuotaBarProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}
function QuotaBar({ label, used, limit, unit = "" }: QuotaBarProps) {
  const pct = Math.min(100, (used / limit) * 100);
  const isOver = used >= limit;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground/70">{label}</span>
        <span className={cn("text-[10px] font-mono font-semibold", isOver ? "text-destructive" : "text-foreground/70")}>
          {used} / {limit}{unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border/60 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isOver ? "bg-destructive" : pct > 80 ? "bg-yellow-500/70" : "bg-primary/60"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function UsagePanel({ open, onClose }: UsagePanelProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { profile } = useAuthContext();
  const { stats, fetchStats } = useUserUsage();

  useEffect(() => {
    if (open) fetchStats();
  }, [open, fetchStats]);

  const hasQuotas =
    profile?.daily_run_limit != null ||
    profile?.daily_image_limit != null ||
    profile?.monthly_run_limit != null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md flex flex-col",
          "bg-card border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border shrink-0">
          <BarChart2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold tracking-widest text-primary flex-1">
            {t("usage.title")}
          </span>
          <button
            onClick={fetchStats}
            disabled={stats.loading}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
            title={t("usage.refresh")}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", stats.loading && "animate-spin")} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">

            {/* ── Today Summary ── */}
            <section>
              <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-primary/60" />
                {t("usage.todaySection")}
              </h3>
              <div className="grid grid-cols-3 gap-2.5">
                {/* Runs */}
                <div className="rounded border border-border bg-background/40 px-3 py-2.5">
                  <p className="text-[9px] tracking-widest text-muted-foreground/60 mb-1">
                    {t("usage.todayRuns")}
                  </p>
                  <p className="text-lg font-bold font-mono text-foreground leading-none">
                    {stats.todayRuns}
                  </p>
                  {profile?.daily_run_limit != null && (
                    <p className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">
                      / {profile.daily_run_limit}
                    </p>
                  )}
                </div>
                {/* Tokens */}
                <div className="rounded border border-border bg-background/40 px-3 py-2.5">
                  <p className="text-[9px] tracking-widest text-muted-foreground/60 mb-1">
                    {t("usage.todayTokens")}
                  </p>
                  <p className="text-lg font-bold font-mono text-foreground leading-none">
                    {fmtTokens(stats.todayTokens)}
                  </p>
                </div>
                {/* Cost */}
                <div className="rounded border border-border bg-background/40 px-3 py-2.5">
                  <p className="text-[9px] tracking-widest text-muted-foreground/60 mb-1">
                    {t("usage.todayCost")}
                  </p>
                  <p className="text-lg font-bold font-mono text-primary/80 leading-none">
                    ${stats.todayCostUsd.toFixed(4)}
                  </p>
                </div>
              </div>
            </section>

            {/* ── Monthly Summary ── */}
            <section>
              <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-primary/60" />
                {t("usage.monthSection")}
              </h3>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded border border-border bg-background/40 px-3 py-2.5">
                  <p className="text-[9px] tracking-widest text-muted-foreground/60 mb-1">
                    {t("usage.monthRuns")}
                  </p>
                  <p className="text-lg font-bold font-mono text-foreground leading-none">
                    {stats.monthRuns}
                  </p>
                  {profile?.monthly_run_limit != null && (
                    <p className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">
                      / {profile.monthly_run_limit}
                    </p>
                  )}
                </div>
                <div className="rounded border border-border bg-background/40 px-3 py-2.5">
                  <p className="text-[9px] tracking-widest text-muted-foreground/60 mb-1">
                    {t("usage.monthTokens")}
                  </p>
                  <p className="text-lg font-bold font-mono text-foreground leading-none">
                    {fmtTokens(stats.monthTokens)}
                  </p>
                </div>
                <div className="rounded border border-border bg-background/40 px-3 py-2.5">
                  <p className="text-[9px] tracking-widest text-muted-foreground/60 mb-1">
                    {t("usage.monthCost")}
                  </p>
                  <p className="text-lg font-bold font-mono text-primary/80 leading-none">
                    ${stats.monthCostUsd.toFixed(4)}
                  </p>
                </div>
              </div>
            </section>

            {/* ── Quota Progress Bars ── */}
            {hasQuotas && (
              <section>
                <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-primary/60" />
                  {t("usage.quotaSection")}
                </h3>
                <div className="space-y-3">
                  {profile?.daily_run_limit != null && (
                    <QuotaBar
                      label={t("usage.dailyRunQuota")}
                      used={stats.todayRuns}
                      limit={profile.daily_run_limit}
                    />
                  )}
                  {profile?.daily_image_limit != null && (
                    <QuotaBar
                      label={t("usage.dailyImageQuota")}
                      used={stats.todayImageRuns}
                      limit={profile.daily_image_limit}
                    />
                  )}
                  {profile?.monthly_run_limit != null && (
                    <QuotaBar
                      label={t("usage.monthlyRunQuota")}
                      used={stats.monthRuns}
                      limit={profile.monthly_run_limit}
                    />
                  )}
                </div>
              </section>
            )}

            {/* ── Recent Runs Table ── */}
            <section>
              <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-primary/60" />
                {t("usage.recentRuns")}
              </h3>

              {stats.recentLogs.length === 0 && !stats.loading ? (
                <p className="text-[10px] text-muted-foreground/40 text-center py-8 tracking-widest">
                  {t("usage.noData")}
                </p>
              ) : (
                <div className="rounded border border-border overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-border bg-card/60">
                        <th className="text-left px-3 py-2 text-muted-foreground/60 font-semibold tracking-widest">
                          {t("usage.time")}
                        </th>
                        <th className="text-left px-2 py-2 text-muted-foreground/60 font-semibold tracking-widest">
                          {t("usage.model")}
                        </th>
                        <th className="text-right px-2 py-2 text-muted-foreground/60 font-semibold tracking-widest">
                          {t("usage.tokens")}
                        </th>
                        <th className="text-right px-3 py-2 text-muted-foreground/60 font-semibold tracking-widest">
                          {t("usage.cost")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentLogs.map((r, i) => {
                        const modelName =
                          MODEL_DISPLAY[r.model_id as keyof typeof MODEL_DISPLAY]?.name ??
                          IMAGE_MODEL_DISPLAY[r.model_id as keyof typeof IMAGE_MODEL_DISPLAY]?.name ??
                          r.model_id ??
                          "—";
                        return (
                          <tr
                            key={r.id}
                            className={cn(
                              "border-b border-border/40 hover:bg-card/20 transition-colors",
                              i === stats.recentLogs.length - 1 && "border-b-0"
                            )}
                          >
                            <td className="px-3 py-2 font-mono text-muted-foreground/50">
                              {fmtTime(r.created_at, lang)}
                            </td>
                            <td className="px-2 py-2 max-w-[100px]">
                              <div className="truncate text-foreground/70">{modelName}</div>
                              <div className="text-[8px] font-mono text-primary/40 uppercase tracking-widest">
                                {r.output_mode}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-foreground/60">
                              {r.total_tokens != null ? fmtTokens(r.total_tokens) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-primary/70">
                              {r.cost_usd != null && Number(r.cost_usd) > 0
                                ? `$${Number(r.cost_usd).toFixed(5)}`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Bottom note */}
            <p className="text-[9px] text-muted-foreground/30 text-center tracking-widest pb-2">
              <DollarSign className="inline w-2.5 h-2.5 mr-0.5" />
              {t("usage.costNote")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
