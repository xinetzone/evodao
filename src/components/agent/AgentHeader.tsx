import { Cpu, Zap, CircleCheck, AlertCircle, Loader } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentStatus } from "@/hooks/useHarnessAgent";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/lib/utils";

interface AgentHeaderProps {
  status: AgentStatus;
  currentGoal: string;
}

export function AgentHeader({ status, currentGoal }: AgentHeaderProps) {
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

        {/* Status + Goal + Switcher */}
        <div className="flex items-center gap-3">
          {currentGoal && status !== "idle" && (
            <p className="hidden md:block text-xs text-muted-foreground max-w-56 truncate">
              <span className="text-primary/60">{t("header.goalPrefix")}</span>
              {currentGoal.substring(0, 45)}{currentGoal.length > 45 ? "…" : ""}
            </p>
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

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
