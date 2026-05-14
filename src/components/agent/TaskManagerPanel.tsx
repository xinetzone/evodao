import { useState, useRef, useEffect } from "react";
import { X, Square, Trash2, LayoutGrid, Plus, Check, AlertCircle, Loader, Clock, ChevronDown, ChevronRight, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentSession } from "@/hooks/useTaskManager";
import { OutputMode } from "@/hooks/useEvodaoAgent";
import { ModelSelector } from "@/components/agent/ModelSelector";
import { ModelId, getAutoModel } from "@/lib/models";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { cn } from "@/lib/utils";

interface TaskManagerPanelProps {
  open: boolean;
  onClose: () => void;
  sessions: AgentSession[];
  addSession: (goal: string, outputMode: OutputMode, model: string) => void;
  abortSession: (id: string) => void;
  removeSession: (id: string) => void;
  clearCompleted: () => void;
  runningCount: number;
}

const STATUS_COLORS = {
  idle:      { badge: "text-muted-foreground border-border", dot: "bg-muted-foreground/40" },
  planning:  { badge: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5", dot: "bg-yellow-400 animate-pulse" },
  executing: { badge: "text-primary border-primary/30 bg-primary/5", dot: "bg-primary animate-pulse" },
  done:      { badge: "text-primary/70 border-primary/20 bg-primary/5", dot: "bg-primary" },
  error:     { badge: "text-destructive border-destructive/30 bg-destructive/5", dot: "bg-destructive" },
};

// Compact session card
function SessionCard({
  session,
  onAbort,
  onRemove,
}: {
  session: AgentSession;
  onAbort: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const completedCount = Object.values(session.taskStatuses).filter((s) => s === "completed").length;
  const totalCount = session.tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isRunning = session.status === "planning" || session.status === "executing";
  const colors = STATUS_COLORS[session.status] || STATUS_COLORS.idle;

  const elapsed = session.completedAt
    ? Math.round((session.completedAt - session.createdAt) / 1000)
    : Math.round((Date.now() - session.createdAt) / 1000);

  return (
    <div className={cn(
      "rounded border transition-all duration-300",
      session.status === "executing" || session.status === "planning"
        ? "border-primary/40 bg-primary/5"
        : session.status === "error"
        ? "border-destructive/30 bg-destructive/5"
        : "border-border bg-card/50"
    )}>
      {/* Card header */}
      <div className="flex items-start gap-2.5 p-3">
        {/* Status dot */}
        <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", colors.dot)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={cn(
              "text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded border",
              colors.badge
            )}>
              {t(`header.status.${session.status}`, { defaultValue: session.status })}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {({ text: t("agentMode.taskMode"), agent: t("agentMode.agentBuild"), qa: t("agentMode.qaChat") } as Record<OutputMode, string>)[session.outputMode]}
            </span>
            {totalCount > 0 && (
              <span className="text-[9px] text-muted-foreground/60">
                {completedCount}/{totalCount} {t("taskManager.tasks")}
              </span>
            )}
            <span className="text-[9px] text-muted-foreground/40 ml-auto">
              {elapsed}s
            </span>
          </div>

          <p className="text-xs text-foreground/80 leading-tight line-clamp-2 mb-2">
            {session.goal}
          </p>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="h-px bg-border relative overflow-hidden mb-2">
              <div
                className="absolute left-0 top-0 h-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Task status dots */}
          {session.tasks.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {session.tasks.map((task) => {
                const s = session.taskStatuses[task.id] || "pending";
                const isActive = session.activeTaskIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    title={`${task.title}: ${s}`}
                    className={cn(
                      "w-2 h-2 rounded-sm transition-all",
                      s === "completed" ? "bg-primary" :
                      s === "running" ? "bg-primary/60 animate-pulse" :
                      s === "error" ? "bg-destructive" :
                      "bg-muted-foreground/20",
                      isActive && "ring-1 ring-primary/50"
                    )}
                  />
                );
              })}
            </div>
          )}

          {/* Error message */}
          {session.error && (
            <p className="text-[10px] text-destructive/80 mt-1 line-clamp-2">{session.error}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {session.tasks.length > 0 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1 rounded text-muted-foreground/60 hover:text-foreground transition-colors"
              title={t("taskManager.expand")}
            >
              {expanded
                ? <ChevronDown className="w-3 h-3" />
                : <ChevronRight className="w-3 h-3" />
              }
            </button>
          )}
          {isRunning && (
            <button
              onClick={onAbort}
              className="p-1 rounded text-muted-foreground/60 hover:text-destructive transition-colors"
              title={t("taskManager.abort")}
            >
              <Square className="w-3 h-3" />
            </button>
          )}
          {!isRunning && (
            <button
              onClick={onRemove}
              className="p-1 rounded text-muted-foreground/60 hover:text-destructive transition-colors"
              title={t("taskManager.remove")}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded terminal output */}
      {expanded && session.tasks.length > 0 && (
        <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-2 max-h-64 overflow-y-auto">
          {session.tasks.map((task) => {
            const s = session.taskStatuses[task.id] || "pending";
            const output = session.taskOutputs[task.id] || "";
            if (!output && s === "pending") return null;
            return (
              <div key={task.id} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  {s === "completed" && <Check className="w-2.5 h-2.5 text-primary shrink-0" />}
                  {s === "running" && <Loader className="w-2.5 h-2.5 text-primary animate-spin shrink-0" />}
                  {s === "error" && <AlertCircle className="w-2.5 h-2.5 text-destructive shrink-0" />}
                  {s === "pending" && <Clock className="w-2.5 h-2.5 text-muted-foreground shrink-0" />}
                  <span className="text-[10px] font-semibold text-foreground/70 truncate">
                    {task.title}
                  </span>
                </div>
                {output && (
                  <pre className="text-[10px] text-foreground/60 whitespace-pre-wrap break-words leading-relaxed ml-4 line-clamp-6 font-mono">
                    {output.slice(-600)}
                    {s === "running" && (
                      <span className="inline-block w-1 h-2.5 bg-primary ml-0.5 animate-pulse align-middle" />
                    )}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Quick-add form inside the panel
function QuickAddForm({ onAdd }: { onAdd: (goal: string, mode: OutputMode, model: string) => void }) {
  const { t } = useTranslation();
  const [goal, setGoal] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("text");
  const [manualModel, setManualModel] = useState<ModelId | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const staticSuggestions: string[] = t(
    outputMode === "agent" ? "promptSuggestions.agent"
    : outputMode === "qa" ? "promptSuggestions.qa"
    : "promptSuggestions.text",
    { returnObjects: true }
  ) as string[];

  const handleSubmit = () => {
    if (!goal.trim()) return;
    const model = manualModel ?? getAutoModel(outputMode);
    onAdd(goal.trim(), outputMode, model);
    setGoal("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (text: string) => {
    setGoal(text);
    setTimeout(() => {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length || 0;
      textareaRef.current?.setSelectionRange(len, len);
    }, 0);
  };

  const handleOptimize = async () => {
    if (!goal.trim() || isOptimizing) return;
    setIsOptimizing(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/harness-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mode: "optimize", goal: goal.trim(), outputMode }),
      });
      if (!resp.ok) throw new Error("Optimize failed");
      const data = await resp.json();
      if (data.optimizedPrompt) {
        setGoal(data.optimizedPrompt);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    } catch {
      // silently fail — keep original goal
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="border border-border rounded bg-card/50 p-3 space-y-2">
      {/* Mode pills */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 p-0.5 rounded border border-border bg-background">
          {(["text", "agent", "qa"] as OutputMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setOutputMode(m)}
              className={cn(
                "px-2 py-0.5 text-[9px] font-bold tracking-widest rounded transition-all",
                outputMode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {({ text: t("agentMode.taskMode"), agent: t("agentMode.agentBuild"), qa: t("agentMode.qaChat") } as Record<OutputMode, string>)[m]}
            </button>
          ))}
        </div>
        <ModelSelector
          outputMode={outputMode}
          manualModel={manualModel}
          onChange={setManualModel}
        />
      </div>

      {/* Suggestion chips */}
      <div className="flex items-center gap-1 flex-wrap min-h-[20px]">
        <span className="text-[9px] text-muted-foreground/40 tracking-widest font-bold shrink-0">
          {t("promptSuggestions.label")}
        </span>
        {staticSuggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSuggestionClick(s)}
            className="px-1.5 py-0.5 text-[9px] text-muted-foreground/60 border border-border/50 rounded hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all truncate max-w-[180px] text-left"
            title={s}
          >
            {s.length > 28 ? s.slice(0, 28) + "…" : s}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("taskManager.addPlaceholder")}
        rows={2}
        className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 resize-none outline-none leading-relaxed font-mono"
      />

      {/* Bottom toolbar */}
      <div className="flex items-center gap-2">
        {/* Optimize button */}
        {goal.trim().length > 5 && (
          <button
            onClick={handleOptimize}
            disabled={isOptimizing}
            title={t("goalInput.optimizeTitle")}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold tracking-widest rounded border transition-all",
              isOptimizing
                ? "border-primary/20 text-primary/40 cursor-not-allowed"
                : "border-primary/30 text-primary/60 hover:border-primary/60 hover:text-primary hover:bg-primary/5"
            )}
          >
            {isOptimizing
              ? <Loader className="w-2.5 h-2.5 animate-spin" />
              : <Wand2 className="w-2.5 h-2.5" />}
            {isOptimizing ? t("goalInput.optimizing") : t("goalInput.optimize")}
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={!goal.trim()}
          className={cn(
            "ml-auto flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold tracking-widest rounded border transition-all",
            goal.trim()
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "text-muted-foreground/30 border-border/30 cursor-not-allowed"
          )}
        >
          <Plus className="w-3 h-3" />
          {t("taskManager.addTask")}
        </button>
      </div>
    </div>
  );
}

export function TaskManagerPanel({
  open,
  onClose,
  sessions,
  addSession,
  abortSession,
  removeSession,
  clearCompleted,
  runningCount,
}: TaskManagerPanelProps) {
  const { t } = useTranslation();

  const completedCount = sessions.filter((s) => s.status === "done" || s.status === "error").length;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-full max-w-lg z-50 flex flex-col bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold tracking-[0.2em] text-primary">
              {t("taskManager.title")}
            </h2>
            {runningCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {runningCount} {t("taskManager.running")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded px-2 py-1 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                {t("taskManager.clearCompleted")}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick-add form */}
        <div className="px-5 py-4 border-b border-border/60">
          <QuickAddForm onAdd={addSession} />
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <LayoutGrid className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground/60 tracking-wider">
                {t("taskManager.empty")}
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onAbort={() => abortSession(session.id)}
                onRemove={() => removeSession(session.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-card/30 text-[10px] text-muted-foreground tracking-wider flex items-center justify-between">
          <span>{sessions.length} {t("taskManager.sessions")}</span>
          <span>EVODAO TASK MANAGER</span>
        </div>
      </div>
    </>
  );
}
