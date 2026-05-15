import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useEvodaoAgent, HistoryEntry } from "@/hooks/useEvodaoAgent";
import { useAgentHistory } from "@/hooks/useAgentHistory";
import { useTaskManager } from "@/hooks/useTaskManager";
import { useAIImage } from "@/hooks/useAIImage";
import { useMemory } from "@/hooks/useMemory";
import { useUsageQuota, QuotaCheckResult } from "@/hooks/useUsageQuota";
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
import { ImageOutput } from "@/components/agent/ImageOutput";
import { MemoryContext } from "@/components/agent/MemoryContext";
import { QuotaExceededModal } from "@/components/quota/QuotaExceededModal";
import { PricingModal } from "@/components/pricing/PricingModal";
import { AlertCircle, Trophy, RotateCcw, X, PenLine } from "lucide-react";
import { MODEL_DISPLAY, IMAGE_MODEL_DISPLAY, ModelId, ImageModelId } from "@/lib/models";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { PlatformPanel } from "@/components/agent/PlatformPanel";
import { UsagePanel } from "@/components/agent/UsagePanel";
import { HelpModal } from "@/components/agent/HelpModal";

const Index = () => {
  const { t, i18n } = useTranslation();
  const history = useAgentHistory();
  const taskManager = useTaskManager();
  const aiImage = useAIImage();
  const memory = useMemory();
  const { checkQuota, recordUsage, finalizeUsage } = useUsageQuota();
  const [quotaExceeded, setQuotaExceeded] = useState<QuotaCheckResult | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pendingLogId, setPendingLogId] = useState<string | null>(null);
  const [pendingModel, setPendingModel] = useState<string>("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [taskManagerOpen, setTaskManagerOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [lastRunMode, setLastRunMode] = useState<string>("");
  const [activeImageModelId, setActiveImageModelId] = useState<string>("openai/gpt-image-2");
  // The model currently selected in the dropdown (before execution)
  const [selectedModel, setSelectedModel] = useState<string>("z-ai/glm-5.1");
  // Prompt suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsAI, setSuggestionsAI] = useState(false);
  const prevQACountRef = useRef(0);
  const latestMemoryIdRef = useRef<string | null>(null);
  // Text-selection-to-prompt feature
  const [textSelection, setTextSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>(undefined);
  const goalInputAreaRef = useRef<HTMLDivElement>(null);
  const {
    status,
    tasks,
    taskStatuses,
    taskOutputs,
    activeTaskIds,
    error,
    currentGoal,
    currentModel,
    outputMode,
    extractedFiles,
    savedSession,
    evolutionStatus,
    reflection,
    reflectionStream,
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
  } = useEvodaoAgent();

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
        body: JSON.stringify({ mode: "suggest", goal, outputMode: mode, lang: i18n.language, ...contextInfo }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setSuggestionsAI(true);
      }
    } catch { /* keep static suggestions */ }
    finally { setSuggestionsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    aiImage.clearImages();
    setLastRunMode("");
    memory.clearMemories();
    reset();
  };

  const handleResetQA = () => {
    setSuggestions([]);
    setSuggestionsAI(false);
    prevQACountRef.current = 0;
    resetQA();
  };

  /**
   * Completion callback — saves the session to long-term memory (Coze 长期记忆写入节点)
   * while also persisting it to the local history panel.
   */
  const handleComplete = useCallback((entry: HistoryEntry) => {
    history.addEntry(entry);
    // Build a concise summary of task outputs for memory storage
    const completedTasks = entry.tasks.filter(
      (t) => entry.taskStatuses[t.id] === "completed"
    );
    const taskSummaries = completedTasks
      .map((t) => {
        const out = entry.taskOutputs[t.id] || "";
        return `${t.title}:\n${out.substring(0, 200)}${out.length > 200 ? "..." : ""}`;
      })
      .join("\n\n");
    memory.saveMemory({
      goal: entry.goal,
      outputMode: entry.outputMode || "text",
      taskSummaries,
      evolutionRound: entry.evolutionRound ?? 0,
    }).then((id) => {
      latestMemoryIdRef.current = id;
    });
  }, [history, memory]);

  // Finalize token usage when agent run completes (text/agent modes → "done"; QA mode → back to "idle")
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const isDoneTransition = prevStatusRef.current !== "done" && status === "done";
    const isQAFinished =
      prevStatusRef.current === "executing" && status === "idle" && outputMode === "qa";

    if ((isDoneTransition || isQAFinished) && pendingLogId && sessionUsage.totalTokens > 0) {
      finalizeUsage(pendingLogId, sessionUsage, pendingModel);
      setPendingLogId(null);
      setPendingModel("");
    }
    prevStatusRef.current = status;
  }, [status, pendingLogId, pendingModel, sessionUsage, finalizeUsage, outputMode]);

  // Back-fill quality_score into long-term memory after QA evaluation (Agent 自我进化)
  useEffect(() => {
    if (reflection && latestMemoryIdRef.current) {
      memory.updateMemoryScore(latestMemoryIdRef.current, reflection.qualityScore);
    }
  }, [reflection, memory]);

  // Text-selection-to-prompt: listen for mouseup outside GoalInput area
  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? "";
        // Require at least 10 chars; ignore selections inside GoalInput itself
        if (text.length >= 10) {
          const range = sel?.getRangeAt(0);
          const rect = range?.getBoundingClientRect();
          // Ignore if selection is inside the goal input area
          const anchorNode = sel?.anchorNode;
          if (
            rect && rect.width > 0 &&
            anchorNode &&
            goalInputAreaRef.current &&
            !goalInputAreaRef.current.contains(anchorNode as Node)
          ) {
            setTextSelection({ text, x: rect.left + rect.width / 2, y: rect.top });
            return;
          }
        }
        setTextSelection(null);
      }, 30);
    };
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

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
        onPlatformOpen={() => setPlatformOpen(true)}
          onUsageOpen={() => setUsageOpen(true)}
          onHelpOpen={() => setHelpOpen(true)}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

          {/* Grid lines decoration */}
          <div
            className="fixed inset-0 pointer-events-none opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          <div ref={goalInputAreaRef}>
            <GoalInput
              status={status}
              onModelChange={setSelectedModel}
              pendingPrompt={pendingPrompt}
              onPendingPromptConsumed={() => setPendingPrompt(undefined)}
              onRun={async (goal, mode, model, attachments) => {
              // Build text context from doc/PDF attachments
              const textParts = attachments
                .filter((a) => a.textContent)
                .map((a) => `[附件: ${a.name}]\n${a.textContent!.slice(0, 8000)}`);
              const textContext = textParts.length > 0
                ? `\n\n--- 附件内容 ---\n${textParts.join("\n\n")}\n--- 附件内容结束 ---`
                : "";
              const enrichedGoal = textContext ? `${goal}${textContext}` : goal;
              // Collect image data URLs for multimodal vision (QA mode)
              const imageDataUrls = attachments
                .filter((a) => a.type === "image" && a.dataUrl && !a.error)
                .map((a) => a.dataUrl!);

              // Quota check — block non-admin users who exceed their limit
              const quotaResult = await checkQuota(mode);
              if (!quotaResult.allowed) {
                setQuotaExceeded(quotaResult);
                return;
              }
              // Record usage before running; store logId for token finalization
              const logId = await recordUsage(mode, model);
              setPendingLogId(logId);
              setPendingModel(model);

              setLastRunMode(mode);
              if (mode === "image") {
                setActiveImageModelId(model);
                aiImage.submitAndPoll({ model, prompt: enrichedGoal, type: "txt_2_img" });
              } else {
                // Coze 长期记忆检索节点 — retrieve relevant past sessions to inject as context
                let memCtx: string[] = [];
                if (mode !== "qa") {
                  const mems = await memory.searchMemory(goal);
                  memCtx = memory.formatAsContext(mems);
                }
                runAgent(enrichedGoal, mode, handleComplete, undefined, model, memCtx, imageDataUrls);
              }
            }}
            onReset={handleReset}
              suggestions={suggestions}
              suggestionsLoading={suggestionsLoading}
              suggestionsAI={suggestionsAI}
            />
          </div>

          {/* Coze 长期记忆节点 — display recalled memory context */}
          {status === "idle" && (memory.isSearching || memory.memories.length > 0) && (
            <MemoryContext memories={memory.memories} isSearching={memory.isSearching} />
          )}

          {/* Resume banner */}
          {savedSession && status === "idle" && (
            <div className="animate-fade-in flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded border border-primary/50 bg-primary/10 terminal-glow">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <RotateCcw className="w-4 h-4 text-primary shrink-0 mt-0.5" />
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
              </div>
              <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                <button
                  onClick={() => resumeAgent(handleComplete)}
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

          {/* Error banner — agent errors only, hidden during image runs */}
          {error && lastRunMode !== "image" && (
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

          {/* Image Output — shown in image gen mode */}
          {lastRunMode === "image" && (
            <ImageOutput
              images={aiImage.images}
              isLoading={aiImage.isLoading}
              isSubmitting={aiImage.isSubmitting}
              isPolling={aiImage.isPolling}
              error={aiImage.error}
              taskId={aiImage.taskId}
              modelName={IMAGE_MODEL_DISPLAY[activeImageModelId as ImageModelId]?.name ?? activeImageModelId}
              onDownload={aiImage.downloadImage}
              onDownloadAll={aiImage.downloadAllImages}
            />
          )}

          {/* Task list — task/agent modes only */}
          {tasks.length > 0 && outputMode !== "qa" && lastRunMode !== "image" && (
            <TaskList tasks={tasks} taskStatuses={taskStatuses} activeTaskIds={activeTaskIds} />
          )}

          {/* Terminal output — task/agent modes only */}
          {outputMode !== "qa" && lastRunMode !== "image" && (
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
          {status === "done" && outputMode !== "qa" && lastRunMode !== "image" && (
            <div className="animate-fade-in flex flex-wrap items-center gap-3 px-4 py-3 rounded border border-primary/40 bg-primary/5 terminal-glow">
              <Trophy className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-primary tracking-wider text-glow">
                  {t("index.missionAccomplished")}
                </p>
                <p className="text-[11px] text-foreground/75 mt-0.5">
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
          {(status === "done" || evolutionStatus !== "idle") && outputMode !== "qa" && lastRunMode !== "image" && (
            <EvolutionPanel
              evolutionStatus={evolutionStatus}
              reflection={reflection}
              reflectionStream={reflectionStream}
              evolutionRound={evolutionRound}
              maxRounds={maxEvolutionRounds}
              onEvolve={evolve}
              onApply={() => applyEvolution(handleComplete)}
              onDismiss={dismissEvolution}
            />
          )}

          {/* Idle hero — hide when QA mode has messages */}
          {status === "idle" && !(outputMode === "qa" && qaMessages.length > 0) && (
            <div className="animate-fade-in flex flex-col items-center justify-center min-h-[320px] py-10 px-4">
              {/* Animated rings */}
              <div className="relative mb-8">
                <div className="w-20 h-20 rounded-full border border-primary/10 flex items-center justify-center mx-auto">
                  <div className="w-14 h-14 rounded-full border border-primary/25 flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full border border-primary/50 flex items-center justify-center terminal-glow">
                      <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                    </div>
                  </div>
                </div>
                {/* Orbiting dot */}
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: "8s" }}>
                  <div className="w-2 h-2 rounded-full bg-primary/40 absolute -top-1 left-1/2 -translate-x-1/2" />
                </div>
              </div>

              <h2 className="text-base font-bold text-foreground/85 tracking-[0.25em] mb-2">
                {t("index.standby")}
              </h2>
              <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto leading-relaxed text-center mb-8">
                {t("index.standbyDesc")}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-2xl text-left">
                {steps.map((item, i) => (
                  <div
                    key={i}
                    className="rounded border border-border/50 bg-card/30 p-3.5 hover:border-primary/30 hover:bg-card/60 transition-all duration-200"
                  >
                    <div className="text-[9px] text-primary/70 tracking-widest font-bold mb-1.5 font-mono">
                      STEP {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="text-xs font-semibold text-foreground/80 tracking-wider mb-1">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground/75 leading-relaxed">
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
      <footer className="border-t border-border bg-card/50 px-4 sm:px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] text-muted-foreground tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {(() => {
                // During execution show the active run model; idle shows the dropdown selection
                const modelId = (status === "idle" && lastRunMode !== "image")
                  ? selectedModel
                  : lastRunMode === "image"
                  ? activeImageModelId
                  : currentModel;
                return lastRunMode === "image"
                  ? (IMAGE_MODEL_DISPLAY[modelId as ImageModelId]?.name ?? modelId.split("/")[1])
                  : (MODEL_DISPLAY[modelId as ModelId]?.name ?? modelId.split("/")[1]);
              })()}
            </span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">{lastRunMode === "image" ? t("index.protocolImage") : t("index.protocolLLM")}</span>
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
        isLoading={history.isLoading}
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

      <PlatformPanel open={platformOpen} onClose={() => setPlatformOpen(false)} />
      <UsagePanel open={usageOpen} onClose={() => setUsageOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <QuotaExceededModal
        result={quotaExceeded}
        onClose={() => setQuotaExceeded(null)}
        onUpgrade={() => setPricingOpen(true)}
      />
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* Text-selection-to-prompt floating button */}
      {textSelection && createPortal(
        <button
          style={{
            position: "fixed",
            top: textSelection.y - 44,
            left: textSelection.x,
            transform: "translateX(-50%)",
          }}
          className="z-[300] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all animate-fade-in select-none whitespace-nowrap"
          onMouseDown={(e) => {
            // Prevent this click from clearing the text selection
            e.preventDefault();
          }}
          onClick={() => {
            setPendingPrompt(textSelection.text);
            setTextSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          <PenLine className="w-3 h-3" />
          {t("common.useAsPrompt")}
        </button>,
        document.body
      )}
    </div>
  );
};

export default Index;
