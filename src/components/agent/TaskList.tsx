import { Check, Loader, AlertCircle, Clock } from "lucide-react";
import { Task, TaskStatus } from "@/hooks/useHarnessAgent";
import { cn } from "@/lib/utils";

interface TaskListProps {
  tasks: Task[];
  taskStatuses: Record<number, TaskStatus>;
  activeTaskId: number | null;
}

const statusConfig: Record<
  TaskStatus,
  {
    icon: React.ReactNode;
    cardClass: string;
    titleClass: string;
    numberClass: string;
    dotClass: string;
  }
> = {
  pending: {
    icon: <Clock className="w-3 h-3 text-muted-foreground" />,
    cardClass: "border-border bg-card/50",
    titleClass: "text-muted-foreground",
    numberClass: "text-muted-foreground/50 bg-muted",
    dotClass: "bg-muted-foreground/30",
  },
  running: {
    icon: <Loader className="w-3 h-3 text-primary animate-spin-slow" />,
    cardClass: "border-primary/60 bg-primary/5 animate-pulse-glow",
    titleClass: "text-primary",
    numberClass: "text-primary-foreground bg-primary",
    dotClass: "bg-primary animate-pulse",
  },
  completed: {
    icon: <Check className="w-3 h-3 text-primary" />,
    cardClass: "border-primary/30 bg-primary/5",
    titleClass: "text-foreground",
    numberClass: "text-primary-foreground bg-primary/70",
    dotClass: "bg-primary",
  },
  error: {
    icon: <AlertCircle className="w-3 h-3 text-destructive" />,
    cardClass: "border-destructive/40 bg-destructive/5",
    titleClass: "text-destructive",
    numberClass: "text-destructive-foreground bg-destructive",
    dotClass: "bg-destructive",
  },
};

export function TaskList({ tasks, taskStatuses, activeTaskId }: TaskListProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        <span className="text-primary">$</span>
        <span className="tracking-wider">TASK DECOMPOSITION</span>
        <span className="text-muted-foreground/40">// {tasks.length} sub-tasks identified</span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-px bg-border relative overflow-hidden">
          {(() => {
            const completed = Object.values(taskStatuses).filter(
              (s) => s === "completed"
            ).length;
            const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
            return (
              <div
                className="absolute left-0 top-0 h-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            );
          })()}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground/60">
          <span>
            {Object.values(taskStatuses).filter((s) => s === "completed").length} /{" "}
            {tasks.length} completed
          </span>
          <span>
            {Math.round(
              (Object.values(taskStatuses).filter((s) => s === "completed").length /
                Math.max(tasks.length, 1)) *
                100
            )}
            %
          </span>
        </div>
      </div>

      {/* Task cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tasks.map((task, index) => {
          const taskStatus = taskStatuses[task.id] || "pending";
          const config = statusConfig[taskStatus];
          const isActive = activeTaskId === task.id;

          return (
            <div
              key={task.id}
              className={cn(
                "relative rounded border p-3 transition-all duration-300",
                config.cardClass,
                isActive && "terminal-glow"
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Active indicator line */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-px bg-primary animate-pulse" />
              )}

              <div className="flex items-start gap-2.5">
                {/* Task number */}
                <div
                  className={cn(
                    "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300",
                    config.numberClass
                  )}
                >
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {config.icon}
                    <span
                      className={cn("text-xs font-semibold truncate transition-colors", config.titleClass)}
                    >
                      {task.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                    {task.description}
                  </p>
                </div>
              </div>

              {/* Status dot */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", config.dotClass)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
