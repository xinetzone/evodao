import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useHarnessAgent } from "@/hooks/useHarnessAgent";
import { useAgentHistory } from "@/hooks/useAgentHistory";
import { useTaskManager } from "@/hooks/useTaskManager";
import { AgentHeader } from "@/components/agent/AgentHeader";
import { GoalInput } from "@/components/agent/GoalInput";
import { TaskList } from "@/components/agent/TaskList";
import { TerminalOutput } from "@/components/agent/TerminalOutput";
import { FileTree } from "@/components/agent/FileTree";
import { HistoryPanel } from "@/components/agent/HistoryPanel";
import { TaskManagerPanel } from "@/components/agent/TaskManagerPanel";
import { ExportActions } from "@/components/agent/ExportActions";
import { EvolutionPanel } from "@/components/agent/EvolutionPanel";
import { QAOutput } from "@/components/agent/QAOutput";
import { AlertCircle, Trophy, RotateCcw, X } from "lucide-react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

const Index = () => {
  const { t } = useTranslation();
  const history = useAgentHistory();
  const taskManager = useTaskManager();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [taskManagerOpen, setTaskManagerOpen] = useState(false);
  const [activeModel, setActiveModel] = useState("GLM 5.1");
  // Prompt suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsAI, setSuggestionsAI] = useState(false);
  const prevQACountRef = useRef(0);
  const {
    status,
    tasks,
    taskStatuses,
    taskOutputs,
    activeTaskIds,
    error,
    currentGoal,
    outputMode,
    extractedFiles,
    savedSession,
    evolutionStatus,
    reflection,
    evolutionRound,
    maxEvolutionRounds,
    runAgent,
    resumeAgent,
    dismissSavedSession,
    reset,
    evolve,
    applyEvolution,
    dismissEvolution,
    qaMessages,
    resetQA,
    sessionUsage,
  } = useHarnessAgent();

  const steps: Array<{ label: string; desc: string }> = t("index.steps", {
    returnObjects: true,
  }) as Array<{ label: string; desc: string }>;

  // ── Fetch AI-generated suggestions ──────────────────────────────────────
  const fetchSuggestions = useCallback(async (
    goal: string,
    mode: string,
    contextInfo?: { taskSummary?: string; lastQA?: string }
  ) => {
    setSuggestionsLoading(true);
    setSuggestions([]);
    setSuggestionsAI(false);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/harness-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ mode: "suggest", goal, outputMode: mode, ...contextInfo }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setSuggestionsAI(true);
      }
    } catch { /* keep static suggestions */ }
    finally { setSuggestionsLoading(false); }
  }, []);

  // Trigger AI suggestions when task/agent run completes
  useEffect(() => {
    if (status === "done" && outputMode !== "qa" && currentGoal) {
      const taskSummary = tasks
        .map((tk) => `${tk.title}: ${(taskOutputs[tk.id] || "").substring(0, 200)}`)
        .join("\n");
      fetchSuggestions(currentGoal, outputMode, { taskSummary });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Trigger AI suggestions after each QA exchange completes
  useEffect(() => {
    const completedMessages = qaMessages.filter((m) => !m.streaming);
    const count = completedMessages.length;
    if (
      count > prevQACountRef.current &&
      count >= 2 &&
      completedMessages[completedMessages.length - 1].role === "assistant"
    ) {
      const lastUser = completedMessages[completedMessages.length - 2]?.content || "";
      const lastAsst = completedMessages[completedMessages.length - 1]?.content || "";
      fetchSuggestions(lastUser, "qa", { lastQA: `Q: ${lastUser.substring(0, 200)}\nA: ${lastAsst.substring(0, 400)}` });
    }
    prevQACountRef.current = count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qaMessages]);

  // Reset suggestions on full reset
  const handleReset = () => {
    setSuggestions([]);
    setSuggestionsAI(false);
    prevQACountRef.current = 0;
    reset();
  };

  const handleResetQA = () => {
    setSuggestions([]);
    setSuggestionsAI(false);
    prevQACountRef.current = 0;
    resetQA();
  };

  return (
    <div className="w-full h-full flex flex-col bg-background overflow-hidden">
      <AgentHeader
        status={status}
        currentGoal={currentGoal}
        historyCount={history.entries.length}
        onHistoryOpen={() => setHistoryOpen(true)}
        sessionUsage={sessionUsage}
        taskManagerRunning={taskManager.runningCount}
        onTaskManagerOpen={() => setTaskManagerOpen(true)}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* Grid lines decoration */}
          <div
            className="fixed inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(142 100% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(142 100% 50%) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          <GoalInput
            status={status}
            onRun={(goal, mode, model) => {
              setActiveModel(model.split("/")[1] || model);
              runAgent(goal, mode, history.addEntry, undefined, model);
            }}
            onReset={handleReset}
            suggestions={suggestions}
            suggestionsLoading={suggestionsLoading}
            suggestionsAI={suggestionsAI}
          />

          {/* Resume banner */}
          {savedSession && status === "idle" && (
            <div className="animate-fade-in flex items-center gap-3 px-4 py-3 rounded border border-primary/50 bg-primary/10 terminal-glow">
              <RotateCcw className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-primary tracking-wider mb-0.5">
                  {t("resume.banner")}
                </p>
                <p className="text-[11px] text-foreground/60 truncate">
                  {savedSession.goal}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t("resume.tasksProgress", {
                    done: savedSession.tasks.filter(
                      (t) => savedSession.taskStatuses[t.id] === "completed"
                    ).length,
                    total: savedSession.tasks.length,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => resumeAgent(history.addEntry)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold tracking-widest text-primary-foreground bg-primary border border-primary rounded hover:bg-primary/90 transition-all duration-200"
                >
                  <RotateCcw className="w-3 h-3" />
                  {t("resume.resumeBtn")}
                </button>
                <button
                  onClick={dismissSavedSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all duration-200"
                >
                  <X className="w-3 h-3" />
                  {t("resume.dismissBtn")}
                </button>
              </div>
            </div>
          )}

          {/* Planning indicator — task/agent modes only */}
          {status === "planning" && outputMode !== "qa" && (
            <div className="animate-fade-in flex items-center gap-3 px-4 py-3 rounded border border-yellow-500/30 bg-yellow-500/5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-yellow-400 tracking-wider">
                {t("index.planning")}
              </span>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="animate-fade-in flex items-start gap-3 px-4 py-3 rounded border border-destructive/40 bg-destructive/10">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-destructive tracking-wider mb-0.5">
                  {t("index.errorTitle")}
                </p>
                <p className="text-xs text-destructive/80">{error}</p>
              </div>
            </div>
          )}

          {/* Q&A Output — shown in exploratory mode */}
          {outputMode === "qa" && qaMessages.length > 0 && (
            <QAOutput messages={qaMessages} onClear={handleResetQA} />
          )}

          {/* Task list — task/agent modes only */}
          {tasks.length > 0 && outputMode !== "qa" && (
            <TaskList tasks={tasks} taskStatuses={taskStatuses} activeTaskIds={activeTaskIds} />
          )}

          {/* Terminal output — task/agent modes only */}
          {outputMode !== "qa" && (
            <TerminalOutput
              tasks={tasks}
              taskStatuses={taskStatuses}
              taskOutputs={taskOutputs}
              activeTaskIds={activeTaskIds}
            />
          )}

          {/* File tree — agent build mode only */}
          {extractedFiles.length > 0 && outputMode === "agent" && (
            <FileTree files={extractedFiles} tasks={tasks} />
          )}

          {/* Completion message — task/agent modes only */}
          {status === "done" && outputMode !== "qa" && (
            <div className="animate-fade-in flex flex-wrap items-center gap-3 px-4 py-3 rounded border border-primary/40 bg-primary/5 terminal-glow">
              <Trophy className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-primary tracking-wider text-glow">
                  {t("index.missionAccomplished")}
                </p>
                <p className="text-[11px] text-foreground/60 mt-0.5">
                  {t("index.missionDone", { count: tasks.length })}
                </p>
              </div>
              <ExportActions
                goal={currentGoal}
                tasks={tasks}
                taskOutputs={taskOutputs}
                taskStatuses={taskStatuses}
                extractedFiles={outputMode === "agent" ? extractedFiles : undefined}
              />
            </div>
          )}

          {/* Evolution panel — task/agent modes only */}
          {(status === "done" || evolutionStatus !== "idle") && outputMode !== "qa" && (
            <EvolutionPanel
              evolutionStatus={evolutionStatus}
              reflection={reflection}
              evolutionRound={evolutionRound}
              maxRounds={maxEvolutionRounds}
              onEvolve={evolve}
              onApply={() => applyEvolution(history.addEntry)}
              onDismiss={dismissEvolution}
            />
          )}

          {/* Idle hero — hide when QA mode has messages */}
          {status === "idle" && !(outputMode === "qa" && qaMessages.length > 0) && (
            <div className="animate-fade-in text-center py-16">
              <div className="relative inline-block mb-6">
                <div className="w-16 h-16 rounded-full border border-primary/30 flex items-center justify-center mx-auto terminal-glow">
                  <div className="w-10 h-10 rounded-full border border-primary/60 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  </div>
                </div>
              </div>
              <h2 className="text-lg font-bold text-foreground/80 tracking-widest mb-2">
                {t("index.standby")}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {t("index.standbyDesc")}
              </p>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
                {steps.map((item, i) => (
                  <div
                    key={i}
                    className="rounded border border-border bg-card/50 p-3 hover:border-primary/30 transition-colors"
                  >
                    <div className="text-[10px] text-primary/60 tracking-widest font-bold mb-1">
                      STEP {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="text-xs font-semibold text-foreground/80 tracking-wider mb-1">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {activeModel}
            </span>
            <span>|</span>
            <span>openai_chat_completions</span>
          </div>
          <div className="text-[10px] text-muted-foreground tracking-wider">
            {t("index.footer")}
          </div>
        </div>
      </footer>

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entries={history.entries}
        onRemove={history.removeEntry}
        onClear={history.clearHistory}
      />

      <TaskManagerPanel
        open={taskManagerOpen}
        onClose={() => setTaskManagerOpen(false)}
        sessions={taskManager.sessions}
        addSession={taskManager.addSession}
        abortSession={taskManager.abortSession}
        removeSession={taskManager.removeSession}
        clearCompleted={taskManager.clearCompleted}
        runningCount={taskManager.runningCount}
      />
    </div>
  );
};

export default Index;
