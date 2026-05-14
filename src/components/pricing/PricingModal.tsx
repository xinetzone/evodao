import { X, Check, Zap, Star, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/AuthContext";
import { PLAN_CONFIGS } from "@/lib/planConfig";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PricingModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { profile } = useAuthContext();

  if (!open) return null;

  const currentPlan = profile?.subscription_plan ?? null;
  const isActive = profile?.subscription_status === "active";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl rounded border border-border bg-card shadow-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
          <div>
            <h2 className="text-sm font-bold tracking-[0.2em] text-foreground">
              {t("pricing.title")}
            </h2>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5 tracking-wider">
              {t("pricing.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plans grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLAN_CONFIGS.map((plan) => {
            const isCurrent = isActive && currentPlan === plan.id;
            const isPro = plan.id === "pro";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded border p-5 flex flex-col gap-4 transition-all duration-200",
                  isPro
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-card/50",
                  isCurrent && "ring-1 ring-primary/40"
                )}
              >
                {isPro && (
                  <div className="absolute -top-2.5 left-4">
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest text-primary-foreground bg-primary px-2 py-0.5 rounded-full">
                      <Star className="w-2.5 h-2.5" />
                      {t("pricing.recommended")}
                    </span>
                  </div>
                )}

                {/* Plan name */}
                <div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-6 h-6 rounded flex items-center justify-center",
                      isPro ? "bg-primary/20 border border-primary/40" : "bg-muted/30 border border-border"
                    )}>
                      {isPro ? <Zap className="w-3 h-3 text-primary" /> : <Clock className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <h3 className={cn(
                      "text-sm font-bold tracking-widest",
                      isPro ? "text-primary" : "text-foreground/80"
                    )}>
                      {t(plan.nameKey)}
                    </h3>
                    {isCurrent && (
                      <span className="ml-auto text-[9px] font-bold tracking-widest text-primary border border-primary/30 px-1.5 py-0.5 rounded bg-primary/5">
                        {t("pricing.currentPlan")}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-1.5 leading-relaxed">
                    {t(plan.descKey)}
                  </p>
                </div>

                {/* Quota list */}
                <ul className="space-y-2">
                  {[
                    { label: t("pricing.quotaDailyRun"), value: plan.daily_run_limit.toLocaleString() },
                    { label: t("pricing.quotaDailyImage"), value: plan.daily_image_limit.toLocaleString() },
                    { label: t("pricing.quotaMonthlyRun"), value: plan.monthly_run_limit.toLocaleString() },
                    { label: t("pricing.quotaDailyToken"), value: `${Math.round(plan.daily_token_limit / 1000)}K` },
                    { label: t("pricing.quotaMonthlyToken"), value: `${Math.round(plan.monthly_token_limit / 1_000_000)}M` },
                  ].map(({ label, value }) => (
                    <li key={label} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-muted-foreground/70">
                        <Check className={cn("w-3 h-3 shrink-0", isPro ? "text-primary" : "text-muted-foreground/50")} />
                        {label}
                      </span>
                      <span className={cn("font-mono font-semibold", isPro ? "text-primary/80" : "text-foreground/60")}>
                        {value}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-auto pt-2">
                  {isCurrent ? (
                    <div className="w-full py-2 text-center text-[11px] font-bold tracking-widest text-primary/60 border border-primary/20 rounded bg-primary/5">
                      {t("pricing.currentPlan")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Payment placeholder - wire real payment here */}
                      <button
                        disabled
                        className="w-full py-2 text-[11px] font-bold tracking-widest rounded border border-border text-muted-foreground/50 bg-muted/10 cursor-not-allowed"
                      >
                        {t("pricing.comingSoon")}
                      </button>
                      <p className="text-[10px] text-center text-muted-foreground/40">
                        {t("pricing.contactToActivate")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-6 pb-5 border-t border-border/30 pt-4">
          <p className="text-[11px] text-muted-foreground/50 text-center leading-relaxed">
            {t("pricing.footerNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
