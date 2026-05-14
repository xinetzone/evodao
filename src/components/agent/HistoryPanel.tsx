import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Trash2, ArrowLeft, Clock, CheckCircle, AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { HistoryEntry } from "@/hooks/useAgentHistory";
import { ExportActions } from "./ExportActions";
import { cn } from "@/lib/utils";

function relativeTime(ms: number, lang: string): string {
  const diff = Date.now() - ms;
  if (lang === "zh") {
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return `${Math.floor(diff / 86_400_000)} 天前`;
  }
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
  isLoading?: boolean;
}

export function HistoryPanel({ open, onClose, entries, onRemove, onClear, isLoading }: HistoryPanelProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [view, setView] = useState<"list" | "detail">("list");
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  const openDetail = (entry: HistoryEntry) => {
    setSelected(entry);
    setExpandedTasks(new Set());
    setView("detail");
  };

  const backToList = () => {
    setView("list");
    setSelected(null);
  };

  const handleClose = () => {
    onClose();
    // Reset to list when panel closes
    setTimeout(() => { setView("list"); setSelected(null); }, 300);
  };

  const toggleTask = (id: number) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md flex flex-col",
          "bg-card border-l border-border shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border shrink-0">
          {view === "detail" ? (
            <button
              onClick={backToList}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("history.back")}
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold tracking-widest text-primary">
                {t("history.title")}
              </span>
              {entries.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">
                  {entries.length}
                </span>
              )}
            </div>
          )}

          {/* Export actions shown in detail view */}
          {view === "detail" && selected && (
            <div className="flex-1 flex justify-end">
              <ExportActions
                goal={selected.goal}
                tasks={selected.tasks}
                taskOutputs={selected.taskOutputs}
                taskStatuses={selected.taskStatuses}
                extractedFiles={selected.outputMode === "agent" ? (selected.extractedFiles ?? []) : undefined}
                compact
              />
            </div>
          )}

          <button
            onClick={handleClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === "list" ? (
            /* ── List view ── */
            entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <p className="text-xs text-muted-foreground">Loading history…</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">{t("history.empty")}</p>
                  </>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {entries.map((entry) => {
                  const done = Object.values(entry.taskStatuses).filter((s) => s === "completed").length;
                  return (
                    <li key={entry.id} className="group relative">
                      <button
                        className="w-full text-left px-5 py-4 hover:bg-primary/5 transition-colors"
                        onClick={() => openDetail(entry)}
                      >
                        <div className="flex items-start gap-2 pr-8">
                          <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground/90 leading-snug line-clamp-2 mb-1">
                              {entry.goal}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>{t("history.tasks", { count: done })}</span>
                              <span>·</span>
                              <span>{relativeTime(entry.completedAt, lang)}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                        </div>
                      </button>
                      {/* Delete button - always visible on mobile, hover-only on desktop */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        title={t("history.deleteEntry")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            /* ── Detail view ── */
            selected && (
              <div className="px-5 py-4 space-y-4">
                {/* Goal */}
                <div>
                  <div className="text-[10px] text-primary/60 tracking-widest font-bold mb-1">GOAL</div>
                  <p className="text-sm text-foreground/90 leading-relaxed">{selected.goal}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {t("history.completedAt", { time: relativeTime(selected.completedAt, lang) })}
                  </p>
                </div>

                <div className="border-t border-border" />

                {/* Tasks */}
                <div className="space-y-2">
                  {selected.tasks.map((task) => {
                    const taskStatus = selected.taskStatuses[task.id];
                    const output = selected.taskOutputs[task.id] || "";
                    const isExpanded = expandedTasks.has(task.id);

                    return (
                      <div
                        key={task.id}
                        className="rounded border border-border bg-background/60 overflow-hidden"
                      >
                        {/* Task header */}
                        <button
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-primary/5 transition-colors"
                          onClick={() => output && toggleTask(task.id)}
                        >
                          <div className="text-[10px] font-bold text-primary/50 shrink-0">
                            {String(task.id).padStart(2, "0")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground/80 truncate">
                              {task.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {taskStatus === "completed" ? (
                              <CheckCircle className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                            )}
                            {output && (
                              <ChevronRight
                                className={cn(
                                  "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                                  isExpanded && "rotate-90"
                                )}
                              />
                            )}
                          </div>
                        </button>

                        {/* Expandable output */}
                        {output && isExpanded && (
                          <div className="border-t border-border bg-background/80 px-3 py-3">
                            <pre className="text-[11px] text-foreground/70 font-mono leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                              {output}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer: clear all button */}
        {view === "list" && entries.length > 0 && (
          <div className="shrink-0 px-5 py-3 border-t border-border">
            <button
              onClick={onClear}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-destructive/70 hover:text-destructive border border-destructive/20 hover:border-destructive/50 rounded transition-all duration-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("history.clearAll")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
