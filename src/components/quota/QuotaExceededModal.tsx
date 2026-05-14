import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { QuotaCheckResult } from "@/hooks/useUsageQuota";
import { cn } from "@/lib/utils";

interface Props {
  result: QuotaCheckResult | null;
  onClose: () => void;
}

export function QuotaExceededModal({ result, onClose }: Props) {
  const { t } = useTranslation();

  if (!result || result.allowed) return null;

  const messageKey =
    result.reason === "daily_run"
      ? "quota.dailyRunExceeded"
      : result.reason === "daily_image"
      ? "quota.dailyImageExceeded"
      : "quota.monthlyExceeded";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-sm rounded border border-destructive/40 bg-card shadow-xl animate-fade-in",
          "flex flex-col"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            </div>
            <span className="text-sm font-bold tracking-widest text-foreground">
              {t("quota.exceeded")}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-foreground/80 leading-relaxed">
            {t(messageKey, { used: result.used, limit: result.limit })}
          </p>

          {/* Usage bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 font-mono">
              <span>{result.used} / {result.limit}</span>
              <span>{Math.round((result.used / result.limit) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-destructive/70"
                style={{ width: `${Math.min(100, (result.used / result.limit) * 100)}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/60 leading-relaxed border-t border-border/30 pt-3">
            {t("quota.contactAdmin")}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-bold tracking-widest rounded border border-border hover:border-primary/40 hover:text-primary text-muted-foreground transition-all duration-200"
          >
            {t("quota.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
