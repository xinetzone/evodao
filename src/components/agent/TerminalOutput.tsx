import { useEffect, useRef } from "react";
import { Terminal, ChevronRight } from "lucide-react";
import { Task, TaskStatus } from "@/hooks/useHarnessAgent";
import { cn } from "@/lib/utils";

interface TerminalOutputProps {
  tasks: Task[];
  taskStatuses: Record<number, TaskStatus>;
  taskOutputs: Record<number, string>;
  activeTaskId: number | null;
}

function formatOutput(text: string): string {
  return text;
}

export function TerminalOutput({
  tasks,
  taskStatuses,
  taskOutputs,
  activeTaskId,
}: TerminalOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [taskOutputs]);

  const visibleTasks = tasks.filter(
    (t) => taskStatuses[t.id] === "running" || taskStatuses[t.id] === "completed" || taskStatuses[t.id] === "error"
  );

  if (visibleTasks.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        <span className="text-primary">$</span>
        <span className="tracking-wider">EXECUTION OUTPUT</span>
        <Terminal className="w-3 h-3 text-muted-foreground/60" />
      </div>

      <div
        ref={scrollRef}
        className="rounded border border-border bg-background/80 overflow-y-auto max-h-[480px] scanline"
        style={{ scrollBehavior: "smooth" }}
      >
        {/* Terminal top bar */}
        <div className="sticky top-0 flex items-center gap-1.5 px-4 py-2 border-b border-border bg-card/90 backdrop-blur-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
          <span className="ml-2 text-[10px] text-muted-foreground tracking-widest">
            harness-agent — output
          </span>
        </div>

        <div className="p-4 space-y-6 font-mono">
          {visibleTasks.map((task) => {
            const status = taskStatuses[task.id];
            const output = taskOutputs[task.id] || "";
            const isActive = activeTaskId === task.id;
            const isRunning = status === "running";

            return (
              <div
                key={task.id}
                className={cn(
                  "space-y-2 transition-all duration-300",
                  isActive && "animate-fade-in"
                )}
              >
                {/* Task header */}
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-primary/60 shrink-0" />
                  <div
                    className={cn(
                      "text-xs font-bold tracking-wider px-2 py-0.5 rounded border",
                      status === "completed"
                        ? "text-primary border-primary/30 bg-primary/5"
                        : status === "error"
                        ? "text-destructive border-destructive/30 bg-destructive/5"
                        : "text-primary border-primary/40 bg-primary/10"
                    )}
                  >
                    TASK {task.id}: {task.title.toUpperCase()}
                  </div>
                  {isRunning && (
                    <span className="text-[10px] text-primary animate-blink tracking-widest">
                      PROCESSING...
                    </span>
                  )}
                  {status === "completed" && (
                    <span className="text-[10px] text-primary/60 tracking-widest">DONE</span>
                  )}
                  {status === "error" && (
                    <span className="text-[10px] text-destructive/80 tracking-widest">FAILED</span>
                  )}
                </div>

                {/* Output content */}
                {output && (
                  <div className="ml-5 pl-3 border-l border-primary/20">
                    <pre
                      className={cn(
                        "text-xs leading-relaxed whitespace-pre-wrap break-words",
                        status === "error" ? "text-destructive/80" : "text-foreground/90"
                      )}
                    >
                      {formatOutput(output)}
                      {isRunning && (
                        <span className="inline-block w-1.5 h-3 bg-primary ml-0.5 animate-blink align-middle" />
                      )}
                    </pre>
                  </div>
                )}

                {/* Loading placeholder */}
                {!output && isRunning && (
                  <div className="ml-5 pl-3 border-l border-primary/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-block w-1.5 h-3 bg-primary animate-blink" />
                      <span className="animate-pulse">Generating output...</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
