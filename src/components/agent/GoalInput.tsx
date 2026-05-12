import { useState, useRef, useEffect } from "react";
import { Play, RotateCcw, Square } from "lucide-react";
import { AgentStatus } from "@/hooks/useHarnessAgent";
import { cn } from "@/lib/utils";

interface GoalInputProps {
  status: AgentStatus;
  onRun: (goal: string) => void;
  onReset: () => void;
}

const PLACEHOLDER_GOALS = [
  "Build a personal finance tracker web application",
  "Create a marketing strategy for a SaaS product",
  "Design and implement a REST API for a blog platform",
  "Analyze and optimize the performance of a React application",
];

export function GoalInput({ status, onRun, onReset }: GoalInputProps) {
  const [goal, setGoal] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isRunning = status === "planning" || status === "executing";
  const isDone = status === "done" || status === "error";
  const isIdle = status === "idle";

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_GOALS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

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
        <span className="tracking-wider">ENTER MISSION OBJECTIVE</span>
        <span className="text-muted-foreground/40">// Ctrl+Enter to execute</span>
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
              placeholder={PLACEHOLDER_GOALS[placeholderIndex]}
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
              {goal.length > 0 ? `${goal.length} chars` : "AWAITING INPUT"}
            </p>

            <div className="flex items-center gap-2">
              {isDone && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all duration-200"
                >
                  <RotateCcw className="w-3 h-3" />
                  RESET
                </button>
              )}

              {isRunning ? (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-destructive border border-destructive/40 rounded hover:bg-destructive/10 transition-all duration-200"
                >
                  <Square className="w-3 h-3" />
                  ABORT
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
                  EXECUTE
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
