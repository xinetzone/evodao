import { Cpu, Zap, CircleCheck, AlertCircle, Loader, Clock, LayoutGrid, Shield, LogOut, ChevronDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { AgentStatus, TokenUsage } from "@/hooks/useEvodaoAgent";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuthContext } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { PricingModal } from "@/components/pricing/PricingModal";

interface AgentHeaderProps {
  status: AgentStatus;
  currentGoal: string;
  historyCount: number;
  onHistoryOpen: () => void;
  sessionUsage: TokenUsage;
  taskManagerRunning: number;
  onTaskManagerOpen: () => void;
}

export function AgentHeader({ status, currentGoal, historyCount, onHistoryOpen, sessionUsage, taskManagerRunning, onTaskManagerOpen }: AgentHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut } = useAuthContext();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const emailInitial = (user?.email || "U")[0].toUpperCase();

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
    <>
    <header className="relative z-10 border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded border border-primary/60 flex items-center justify-center terminal-glow">
              <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            </div>
            {isPulsing && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-[0.3em] text-primary text-glow">
              {t("header.title")}
            </h1>
            <p className="hidden sm:block text-[10px] tracking-widest text-muted-foreground">
              {t("header.subtitle")}
            </p>
          </div>
        </div>

        {/* Status + Goal + Token Stats + Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-3">
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
              "flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded border text-xs font-semibold tracking-widest",
              isPulsing ? "border-primary/40 bg-primary/5" : "border-border bg-card",
              statusColorMap[status]
            )}
          >
            {statusIconMap[status]}
            <span className="hidden sm:inline">{t(`header.status.${status}`)}</span>
          </div>

          {/* Task Manager button */}
          <button
            onClick={onTaskManagerOpen}
            className="relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded border border-border bg-card text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all duration-200"
            title={t("taskManager.title")}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline tracking-widest">{t("taskManager.title")}</span>
            {taskManagerRunning > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center animate-pulse">
                {taskManagerRunning}
              </span>
            )}
          </button>

          {/* History button */}
          <button
            onClick={onHistoryOpen}
            className="relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded border border-border bg-card text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all duration-200"
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

          {/* User menu */}
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={cn(
                  "flex items-center gap-1 sm:gap-1.5 pl-1.5 pr-1.5 sm:pr-2.5 py-1 rounded border transition-all duration-200",
                  isAdmin
                    ? "border-primary/40 bg-primary/5 hover:border-primary/70 hover:bg-primary/10 terminal-glow"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                  isAdmin
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/20 border border-primary/40 text-primary"
                )}>
                  {emailInitial}
                </div>
                <span className="hidden sm:block text-[10px] text-muted-foreground max-w-[90px] truncate font-mono">
                  {user.email}
                </span>
                <ChevronDown className={cn("hidden sm:block w-3 h-3 text-muted-foreground/60 transition-transform duration-200 shrink-0", userMenuOpen && "rotate-180")} />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 sm:w-60 rounded border border-border/80 bg-card shadow-xl z-50 overflow-hidden animate-fade-in">
                  {/* Profile header */}
                  <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                        isAdmin ? "bg-primary text-primary-foreground" : "bg-primary/20 border border-primary/40 text-primary"
                      )}>
                        {emailInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-foreground/80 font-medium truncate">{user.email}</p>
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest text-primary-foreground bg-primary px-1.5 py-0.5 rounded mt-0.5">
                            <Shield className="w-2.5 h-2.5" />
                            ADMIN
                          </span>
                        ) : profile?.subscription_status === "active" && profile.subscription_plan ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest text-primary border border-primary/30 bg-primary/10 px-1.5 py-0.5 rounded mt-0.5">
                            <Zap className="w-2.5 h-2.5" />
                            {profile.subscription_plan.toUpperCase()}
                          </span>
                        ) : (
                          <p className="text-[9px] text-muted-foreground/50 tracking-widest mt-0.5">FREE</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    {isAdmin && (
                      <button
                        onClick={() => { setUserMenuOpen(false); navigate("/admin"); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors group"
                      >
                        <Shield className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
                        <span className="tracking-wider">{t("admin.title")}</span>
                      </button>
                    )}

                    {!isAdmin && profile?.subscription_status !== "active" && (
                      <button
                        onClick={() => { setUserMenuOpen(false); setPricingOpen(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-primary/80 hover:text-primary hover:bg-primary/5 transition-colors group"
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
                        <span className="tracking-wider">{t("pricing.upgradeNow")}</span>
                      </button>
                    )}

                    <div className="mx-3 border-t border-border/30 my-1" />

                    <button
                      onClick={() => { setUserMenuOpen(false); signOut(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors group"
                    >
                      <LogOut className="w-3.5 h-3.5 group-hover:text-destructive transition-colors" />
                      <span className="tracking-wider">{t("auth.logout")}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
    <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </>
  );
}
