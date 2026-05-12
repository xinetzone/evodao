import { useState, useRef } from "react";
import { Play, RotateCcw, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentStatus } from "@/hooks/useHarnessAgent";
import { cn } from "@/lib/utils";

interface GoalInputProps {
  status: AgentStatus;
  onRun: (goal: string) => void;
  onReset: () => void;
}

export function GoalInput({ status, onRun, onReset }: GoalInputProps) {
  const { t } = useTranslation();
  const [goal, setGoal] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholders: string[] = t("goalInput.placeholders", { returnObjects: true }) as string[];
  const [placeholderIndex] = useState(() => Math.floor(Math.random() * 4));

  const isRunning = status === "planning" || status === "executing";
  const isDone = status === "done" || status === "error";
  const isIdle = status === "idle";

  const handleRun = () => {
    if (!goal.trim() || isRunning) return;
    onRun(goal.trim());
  };

  const handleReset = () => {
    setGoal("");
    onReset();
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isRunning) {
      handleRun();
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Terminal prompt header */}
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        <span className="text-primary">$</span>
        <span className="tracking-wider">{t("goalInput.prompt")}</span>
        <span className="text-muted-foreground/40">{t("goalInput.hint")}</span>
      </div>

      {/* Input area */}
      <div
        className={cn(
          "relative rounded border bg-card transition-all duration-300",
          isRunning
            ? "border-primary/60 terminal-glow"
            : "border-border hover:border-primary/40 focus-within:border-primary/60 focus-within:terminal-glow"
        )}
      >
        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40 rounded-tl" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/40 rounded-tr" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-primary/40 rounded-bl" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-primary/40 rounded-br" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-primary mt-1 text-sm select-none shrink-0">
              {isRunning ? "►" : ">"}
            </span>
            <textarea
              ref={textareaRef}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning}
              placeholder={placeholders[placeholderIndex % placeholders.length]}
              rows={3}
              className={cn(
                "w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/40",
                "leading-relaxed transition-colors duration-200",
                isRunning ? "text-muted-foreground cursor-not-allowed" : "text-foreground"
              )}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground/60 tracking-wider">
              {goal.length > 0
                ? t("goalInput.chars", { count: goal.length })
                : t("goalInput.awaiting")}
            </p>

            <div className="flex items-center gap-2">
              {isDone && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all duration-200"
                >
                  <RotateCcw className="w-3 h-3" />
                  {t("goalInput.reset")}
                </button>
              )}

              {isRunning ? (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-destructive border border-destructive/40 rounded hover:bg-destructive/10 transition-all duration-200"
                >
                  <Square className="w-3 h-3" />
                  {t("goalInput.abort")}
                </button>
              ) : (
                <button
                  onClick={handleRun}
                  disabled={!goal.trim() || isRunning}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold tracking-widest rounded border transition-all duration-200",
                    goal.trim() && isIdle
                      ? "text-primary-foreground bg-primary border-primary hover:bg-primary/90 terminal-glow"
                      : "text-muted-foreground border-border cursor-not-allowed"
                  )}
                >
                  <Play className="w-3 h-3" />
                  {t("goalInput.execute")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
