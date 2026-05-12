import { Cpu, Zap, CircleCheck, AlertCircle, Loader, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentStatus, TokenUsage } from "@/hooks/useHarnessAgent";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/lib/utils";

interface AgentHeaderProps {
  status: AgentStatus;
  currentGoal: string;
  historyCount: number;
  onHistoryOpen: () => void;
  sessionUsage: TokenUsage;
}

export function AgentHeader({ status, currentGoal, historyCount, onHistoryOpen, sessionUsage }: AgentHeaderProps) {
  const { t } = useTranslation();

  const statusIconMap: Record<AgentStatus, React.ReactNode> = {
    idle: <span className="w-2 h-2 rounded-full bg-muted-foreground" />,
    planning: <Loader className="w-3 h-3 animate-spin-slow text-yellow-400" />,
    executing: <Zap className="w-3 h-3 text-primary" />,
    done: <CircleCheck className="w-3 h-3 text-primary" />,
    error: <AlertCircle className="w-3 h-3 text-destructive" />,
  };

  const statusColorMap: Record<AgentStatus, string> = {
    idle: "text-muted-foreground",
    planning: "text-yellow-400",
    executing: "text-primary",
    done: "text-primary",
    error: "text-destructive",
  };

  const isPulsing = status === "planning" || status === "executing";

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded border border-primary/60 flex items-center justify-center terminal-glow">
              <Cpu className="w-4 h-4 text-primary" />
            </div>
            {isPulsing && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.3em] text-primary text-glow">
              {t("header.title")}
            </h1>
            <p className="text-[10px] tracking-widest text-muted-foreground">
              {t("header.subtitle")}
            </p>
          </div>
        </div>

        {/* Status + Goal + Token Stats + Switcher */}
        <div className="flex items-center gap-3">
          {currentGoal && status !== "idle" && (
            <p className="hidden md:block text-xs text-muted-foreground max-w-56 truncate">
              <span className="text-primary/60">{t("header.goalPrefix")}</span>
              {currentGoal.substring(0, 45)}{currentGoal.length > 45 ? "…" : ""}
            </p>
          )}

          {/* Token usage badge */}
          {sessionUsage.totalTokens > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card text-[10px] font-mono text-muted-foreground">
              <span title={t("header.promptTokens")}>↑{sessionUsage.promptTokens.toLocaleString()}</span>
              <span className="text-border">·</span>
              <span title={t("header.completionTokens")}>↓{sessionUsage.completionTokens.toLocaleString()}</span>
              <span className="text-border">·</span>
              <span className="text-primary/70" title={t("header.totalTokens")}>Σ{sessionUsage.totalTokens.toLocaleString()}</span>
            </div>
          )}

          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold tracking-widest",
              isPulsing ? "border-primary/40 bg-primary/5" : "border-border bg-card",
              statusColorMap[status]
            )}
          >
            {statusIconMap[status]}
            {t(`header.status.${status}`)}
          </div>

          {/* History button */}
          <button
            onClick={onHistoryOpen}
            className="relative flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all duration-200"
            title={t("history.title")}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline tracking-widest">{t("history.title")}</span>
            {historyCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {historyCount > 99 ? "99+" : historyCount}
              </span>
            )}
          </button>

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
