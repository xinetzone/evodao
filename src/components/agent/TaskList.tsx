import { Check, Loader, AlertCircle, Clock, Lock, ArrowDown, GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Task, TaskStatus } from "@/hooks/useEvodaoAgent";
import { cn } from "@/lib/utils";

interface TaskListProps {
  tasks: Task[];
  taskStatuses: Record<number, TaskStatus>;
  activeTaskIds: Set<number>;
}

const statusStyleMap: Record<
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
  blocked: {
    icon: <Lock className="w-3 h-3 text-muted-foreground/50" />,
    cardClass: "border-border/40 bg-card/30",
    titleClass: "text-muted-foreground/60",
    numberClass: "text-muted-foreground/30 bg-muted/40",
    dotClass: "bg-muted-foreground/20",
  },
};

/** D: Topological sort — returns tasks grouped by dependency depth (level 0 = no deps). */
function getTaskLevels(tasks: Task[]): Task[][] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const levelOf = new Map<number, number>();

  function getLevel(id: number): number {
    if (levelOf.has(id)) return levelOf.get(id)!;
    const task = taskMap.get(id);
    const deps = task?.dependsOn ?? [];
    if (deps.length === 0) {
      levelOf.set(id, 0);
      return 0;
    }
    const maxDep = Math.max(...deps.map((depId) => getLevel(depId)));
    const level = maxDep + 1;
    levelOf.set(id, level);
    return level;
  }

  tasks.forEach((t) => getLevel(t.id));
  const maxLevel = levelOf.size > 0 ? Math.max(...levelOf.values()) : 0;
  const levels: Task[][] = [];
  for (let i = 0; i <= maxLevel; i++) {
    levels.push(tasks.filter((t) => (levelOf.get(t.id) ?? 0) === i));
  }
  return levels;
}

function TaskCard({
  task,
  index,
  taskStatus,
  isActive,
}: {
  task: Task;
  index: number;
  taskStatus: TaskStatus;
  isActive: boolean;
}) {
  const { t } = useTranslation();
  const style = statusStyleMap[taskStatus];

  return (
    <div
      className={cn(
        "relative rounded border p-3 transition-all duration-300 flex-1 min-w-0",
        style.cardClass,
        isActive && "terminal-glow"
      )}
    >
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-px bg-primary animate-pulse" />
      )}

      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300",
            style.numberClass
          )}
        >
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {style.icon}
            <span className={cn("text-xs font-semibold truncate transition-colors", style.titleClass)}>
              {task.title}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
            {task.description}
          </p>
          {task.dependsOn && task.dependsOn.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <Lock className="w-2 h-2 text-muted-foreground/40 shrink-0" />
              <span className="text-[9px] text-muted-foreground/40 font-mono">
                {t("taskList.dependsOn")} {task.dependsOn.join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-2 right-2">
        <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", style.dotClass)} />
      </div>
    </div>
  );
}

export function TaskList({ tasks, taskStatuses, activeTaskIds }: TaskListProps) {
  const { t } = useTranslation();

  if (tasks.length === 0) return null;

  const completedCount = Object.values(taskStatuses).filter((s) => s === "completed").length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  // D: Use DAG layout when any task has dependencies, otherwise flat grid
  const hasDeps = tasks.some((t) => t.dependsOn && t.dependsOn.length > 0);
  const levels = hasDeps ? getTaskLevels(tasks) : null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        <span className="text-primary">$</span>
        {hasDeps ? (
          <GitBranch className="w-3 h-3 text-primary/60" />
        ) : null}
        <span className="tracking-wider">{t("taskList.heading")}</span>
        <span className="text-muted-foreground/40">
          {t("taskList.subTaskCount", { count: tasks.length })}
        </span>
        {hasDeps && (
          <span className="text-[10px] text-primary/40 font-mono tracking-widest">DAG</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-px bg-border relative overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground/60">
          <span>{t("taskList.completed", { done: completedCount, total: tasks.length })}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* D: DAG level layout */}
      {levels ? (
        <div className="space-y-3">
          {levels.map((levelTasks, levelIdx) => (
            <div key={levelIdx}>
              {/* Level separator with arrow (except for first level) */}
              {levelIdx > 0 && (
                <div className="flex items-center justify-center py-1.5 gap-2">
                  <div className="flex-1 h-px bg-border/40" />
                  <div className="flex items-center gap-1.5 px-2">
                    <ArrowDown className="w-3 h-3 text-primary/30" />
                    <span className="text-[9px] text-muted-foreground/40 font-mono tracking-widest">THEN</span>
                    <ArrowDown className="w-3 h-3 text-primary/30" />
                  </div>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}

              {/* Level label */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[9px] text-muted-foreground/30 font-mono tracking-widest">
                  {levelIdx === 0 ? "PARALLEL START" : `STAGE ${levelIdx + 1}`}
                  {levelTasks.length > 1 ? ` · ${levelTasks.length}× parallel` : ""}
                </span>
              </div>

              {/* Tasks in this level — flex row for parallel visualization */}
              <div className="flex flex-col sm:flex-row gap-3">
                {levelTasks.map((task) => {
                  const globalIndex = tasks.findIndex((t) => t.id === task.id);
                  const taskStatus = taskStatuses[task.id] || "pending";
                  const isActive = activeTaskIds.has(task.id);
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      index={globalIndex}
                      taskStatus={taskStatus}
                      isActive={isActive}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat grid — no dependencies */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tasks.map((task, index) => {
            const taskStatus = taskStatuses[task.id] || "pending";
            const isActive = activeTaskIds.has(task.id);
            return (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                taskStatus={taskStatus}
                isActive={isActive}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
