import { Cpu, Zap, CircleCheck, AlertCircle, Loader } from "lucide-react";
import { AgentStatus } from "@/hooks/useHarnessAgent";
import { cn } from "@/lib/utils";

interface AgentHeaderProps {
  status: AgentStatus;
  currentGoal: string;
}

const statusConfig: Record<
  AgentStatus,
  { label: string; color: string; icon: React.ReactNode; pulse: boolean }
> = {
  idle: {
    label: "READY",
    color: "text-muted-foreground",
    icon: <span className="w-2 h-2 rounded-full bg-muted-foreground" />,
    pulse: false,
  },
  planning: {
    label: "PLANNING",
    color: "text-yellow-400",
    icon: <Loader className="w-3 h-3 animate-spin-slow text-yellow-400" />,
    pulse: true,
  },
  executing: {
    label: "EXECUTING",
    color: "text-primary",
    icon: <Zap className="w-3 h-3 text-primary" />,
    pulse: true,
  },
  done: {
    label: "COMPLETE",
    color: "text-primary",
    icon: <CircleCheck className="w-3 h-3 text-primary" />,
    pulse: false,
  },
  error: {
    label: "ERROR",
    color: "text-destructive",
    icon: <AlertCircle className="w-3 h-3 text-destructive" />,
    pulse: false,
  },
};

export function AgentHeader({ status, currentGoal }: AgentHeaderProps) {
  const config = statusConfig[status];

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded border border-primary/60 flex items-center justify-center terminal-glow">
              <Cpu className="w-4 h-4 text-primary" />
            </div>
            {(status === "executing" || status === "planning") && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.3em] text-primary text-glow">
              HARNESS AGENT
            </h1>
            <p className="text-[10px] tracking-widest text-muted-foreground">
              AUTONOMOUS TASK EXECUTOR v1.0
            </p>
          </div>
        </div>

        {/* Status + Goal */}
        <div className="flex items-center gap-4">
          {currentGoal && status !== "idle" && (
            <p className="hidden md:block text-xs text-muted-foreground max-w-64 truncate">
              <span className="text-primary/60">goal://</span>
              {currentGoal.substring(0, 50)}{currentGoal.length > 50 ? "…" : ""}
            </p>
          )}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold tracking-widest",
              config.pulse ? "border-primary/40 bg-primary/5" : "border-border bg-card",
              config.color
            )}
          >
            {config.icon}
            {config.label}
          </div>
        </div>
      </div>
    </header>
  );
}
