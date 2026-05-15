import { useState, useRef, useEffect } from "react";
import { Play, RotateCcw, Square, Wand2, Loader, Sparkles, Paperclip, FileText, X, Loader2, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentStatus, OutputMode } from "@/hooks/useEvodaoAgent";
import { ModelSelector } from "@/components/agent/ModelSelector";
import { ModelId, ImageModelId, getAutoModel } from "@/lib/models";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useAttachments, Attachment } from "@/hooks/useAttachments";
import { PromptLibraryModal } from "@/components/agent/PromptLibraryModal";

interface GoalInputProps {
  status: AgentStatus;
  onRun: (goal: string, outputMode: OutputMode, model: string, attachments: Attachment[]) => void;
  onReset: () => void;
  onModelChange?: (model: string) => void;
  pendingPrompt?: string;
  onPendingPromptConsumed?: () => void;
  suggestions?: string[];
  suggestionsLoading?: boolean;
  suggestionsAI?: boolean;
}

export function GoalInput({
  status,
  onRun,
  onReset,
  onModelChange,
  pendingPrompt,
  onPendingPromptConsumed,
  suggestions = [],
  suggestionsLoading = false,
  suggestionsAI = false,
}: GoalInputProps) {
  const { t, i18n } = useTranslation();
  const [goal, setGoal] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("text");
  const [manualModel, setManualModel] = useState<ModelId | null>(null);
  const [imageModel, setImageModel] = useState<ImageModelId>("google/gemini-3-pro-image-preview");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { attachments, hasLoading, addFiles, removeAttachment, clearAttachments } = useAttachments();

  // Notify parent whenever the effective model changes (for footer display)
  useEffect(() => {
    const effective = outputMode === "image"
      ? imageModel
      : (manualModel ?? getAutoModel(outputMode));
    onModelChange?.(effective);
  }, [outputMode, manualModel, imageModel, onModelChange]);

  // Apply externally injected prompt (e.g. from text selection) — and select all for easy editing
  useEffect(() => {
    if (pendingPrompt) {
      setGoal(pendingPrompt);
      onPendingPromptConsumed?.();
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 0);
    }
  }, [pendingPrompt, onPendingPromptConsumed]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedReason, setDetectedReason] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholders: string[] = t("goalInput.placeholders", { returnObjects: true }) as string[];
  const qaPlaceholders: string[] = t("agentMode.qaChatPlaceholders", { returnObjects: true }) as string[];
  const staticSuggestions: string[] = t(
    outputMode === "agent" ? "promptSuggestions.agent"
    : outputMode === "qa" ? "promptSuggestions.qa"
    : outputMode === "image" ? "promptSuggestions.image"
    : "promptSuggestions.text",
    { returnObjects: true }
  ) as string[];
  const [placeholderIndex] = useState(() => Math.floor(Math.random() * 4));

  const activePlaceholders = outputMode === "qa" ? qaPlaceholders
    : outputMode === "image" ? (t("agentMode.imageGenPlaceholders", { returnObjects: true }) as string[])
    : placeholders;
  // AI suggestions override static ones once available
  const activeSuggestions = suggestions.length > 0 ? suggestions : staticSuggestions;

  const isRunning = status === "planning" || status === "executing";
  const isDone = status === "done" || status === "error";
  const isIdle = status === "idle";

  const handleRun = () => {
    if (!goal.trim() || isRunning || hasLoading) return;
    if (outputMode === "image") {
      onRun(goal.trim(), "image", imageModel, attachments);
      clearAttachments();
      return;
    }
    const model = manualModel ?? getAutoModel(outputMode);
    onRun(goal.trim(), outputMode, model, attachments);
    clearAttachments();
  };

  const handleReset = () => {
    setGoal("");
    clearAttachments();
    onReset();
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    addFiles(Array.from(files));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isRunning) {
      e.preventDefault();
      handleRun();
    }
  };

  const handleSuggestionClick = (text: string) => {
    setGoal(text);
    // Focus and select-all so user can immediately type to replace the suggestion
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }, 0);
  };

  const handleOptimize = async () => {
    if (!goal.trim() || isOptimizing || isRunning) return;
    setIsOptimizing(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/harness-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mode: "optimize", goal: goal.trim(), outputMode, lang: i18n.language }),
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

  /** Coze 意图识别节点 — auto-detect the best execution mode for current goal */
  const handleDetectIntent = async () => {
    if (!goal.trim() || isDetecting || isRunning) return;
    setIsDetecting(true);
    setDetectedReason(null);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/harness-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mode: "intent", goal: goal.trim() }),
      });
      if (!resp.ok) throw new Error("Intent detection failed");
      const data = await resp.json();
      if (data.outputMode) {
        setOutputMode((data.outputMode === "image" ? "text" : data.outputMode) as OutputMode);
        setDetectedReason(data.reason || null);
        // auto-clear reason badge after 6 seconds
        setTimeout(() => setDetectedReason(null), 6000);
      }
    } catch {
      // silently fail
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Mode toggle + prompt header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-primary">$</span>
          <span className="tracking-wider">{t("goalInput.prompt")}</span>
          <span className="hidden sm:inline text-muted-foreground/60">{t("goalInput.hint")}</span>
        </div>

        {/* Mode toggle pills + model selector */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Intent auto-detect button (Coze 意图识别节点) */}
          {isIdle && goal.trim().length > 3 && (
            <button
              onClick={handleDetectIntent}
              disabled={isDetecting}
              title={t("intent.detecting")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-[11px] font-bold tracking-widest rounded border transition-all duration-200",
                isDetecting
                  ? "border-primary/20 text-primary/30 cursor-not-allowed"
                  : "border-primary/20 text-primary/40 hover:border-primary/50 hover:text-primary/70 hover:bg-primary/5"
              )}
            >
              {isDetecting ? (
                <Loader className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Sparkles className="w-2.5 h-2.5" />
              )}
              {t("intent.autoBtn")}
            </button>
          )}
          <div className="flex items-center gap-0.5 p-0.5 rounded border border-border bg-card">
            {(["text", "agent", "qa"] as OutputMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setOutputMode(m)}
                disabled={isRunning}
                className={cn(
                  "px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-xs font-semibold tracking-widest rounded transition-all duration-150",
                  outputMode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Abbreviated labels on mobile, full labels on sm+ */}
                <span className="sm:hidden">
                  {m === "text" ? t("agentMode.taskModeShort") || "任务"
                    : m === "agent" ? t("agentMode.agentBuildShort") || "构建"
                    : t("agentMode.qaChatShort") || "问答"}
                </span>
                <span className="hidden sm:inline">
                  {m === "text" ? t("agentMode.taskMode")
                    : m === "agent" ? t("agentMode.agentBuild")
                    : t("agentMode.qaChat")}
                </span>
              </button>
            ))}
          </div>

          <ModelSelector
              outputMode={outputMode}
              manualModel={manualModel}
              onChange={setManualModel}
              disabled={isRunning}
            />
        </div>
      </div>

      {/* Mode hint */}
      {outputMode === "agent" && (
        <p className="text-xs text-primary/60 tracking-wider mb-2 pl-4 border-l border-primary/30">
          {t("agentMode.agentBuildHint")}
        </p>
      )}
      {outputMode === "qa" && (
        <p className="text-xs text-primary/60 tracking-wider mb-2 pl-4 border-l border-primary/30">
          {t("agentMode.qaChatHint")}
        </p>
      )}
      {outputMode === "image" && null}

      {/* Intent detection reason badge */}
      {detectedReason && (
        <div className="flex items-center gap-1.5 mb-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 w-fit">
          <Sparkles className="w-2.5 h-2.5 text-primary/60 shrink-0" />
          <span className="text-xs text-primary/70 tracking-wide">
            <span className="font-bold">{t("intent.reason")}</span>{detectedReason}
          </span>
        </div>
      )}

      {/* Prompt suggestion chips */}
      <div className="mb-3">
        {suggestionsLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 mb-1.5">
            <Loader className="w-3 h-3 animate-spin" />
            {t("promptSuggestions.loading")}
          </div>
        ) : (
          <>
            {/* Label */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] text-muted-foreground tracking-widest font-bold shrink-0">
                {suggestionsAI ? (
                  <span className="flex items-center gap-1 text-primary/50">
                    <Sparkles className="w-2.5 h-2.5" />
                    {t("promptSuggestions.aiLabel")}
                  </span>
                ) : (
                  t("promptSuggestions.label")
                )}
              </span>
              {/* Library picker trigger */}
              <button
                onClick={() => setLibraryOpen(true)}
                className="ml-auto flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-muted-foreground/50 border border-border/40 rounded hover:border-primary/40 hover:text-primary/60 transition-all duration-150"
                title={t("promptLib.openBtn")}
              >
                <BookOpen className="w-2.5 h-2.5" />
                <span className="tracking-wider hidden sm:inline">{t("promptLib.openBtn")}</span>
              </button>
            </div>

            {/* 2-column grid — all chips visible, no horizontal scroll */}
            <div className="grid grid-cols-2 gap-1.5">
              {activeSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  disabled={isRunning}
                  className="px-2.5 py-1 text-xs text-foreground/65 border border-border/60 rounded hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all duration-150 truncate text-left w-full"
                  title={s}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 scrollbar-none">
          {attachments.map((att) => (
            <div
              key={att.id}
              className={cn(
                "flex items-center gap-1.5 shrink-0 px-2 py-1 rounded border text-xs max-w-[160px]",
                att.error
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {att.isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              ) : att.type === "image" && att.previewUrl ? (
                <img
                  src={att.previewUrl}
                  alt={att.name}
                  className="w-4 h-4 object-cover rounded shrink-0"
                />
              ) : (
                <FileText className="w-3 h-3 text-primary shrink-0" />
              )}
              <span className="truncate max-w-[80px]">
                {att.error ? att.error : att.name}
              </span>
              <button
                onClick={() => removeAttachment(att.id)}
                className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
                title={t("goalInput.remove")}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        className={cn(
          "relative rounded border bg-card transition-all duration-300",
          isRunning
            ? "border-primary/60 terminal-glow"
            : outputMode === "agent"
            ? "border-primary/30 hover:border-primary/50 focus-within:border-primary/60 focus-within:terminal-glow"
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
              onPaste={(e) => {
                const files = Array.from(e.clipboardData?.files ?? []);
                if (files.length > 0) {
                  e.preventDefault();
                  addFiles(files);
                }
              }}
              disabled={isRunning}
              placeholder={activePlaceholders[placeholderIndex % activePlaceholders.length]}
              rows={3}
              className={cn(
                "w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/55",
                "leading-relaxed transition-colors duration-200",
                isRunning ? "text-muted-foreground cursor-not-allowed" : "text-foreground"
              )}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {/* Paperclip / attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning}
                title={t("goalInput.attachTitle")}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all duration-200 disabled:opacity-40"
              >
                <Paperclip className="w-3 h-3" />
                <span className="hidden sm:inline tracking-wider">{t("goalInput.attachLabel")}</span>
                {attachments.length > 0 && (
                  <span className="ml-0.5 font-bold text-primary">{attachments.length}</span>
                )}
              </button>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.csv,.json,.xml,.pdf"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
              />
              <p className="text-xs text-muted-foreground/60 tracking-wider">
                {goal.length > 0
                  ? t("goalInput.chars", { count: goal.length })
                  : t("goalInput.awaiting")}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Optimize button */}
              {isIdle && goal.trim().length > 5 && (
                <button
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                  title={t("goalInput.optimizeTitle")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold tracking-widest rounded border transition-all duration-200",
                    isOptimizing
                      ? "border-primary/30 text-primary/60 cursor-not-allowed"
                      : "border-primary/30 text-primary/70 hover:border-primary/60 hover:text-primary hover:bg-primary/5"
                  )}
                >
                  {isOptimizing ? (
                    <Loader className="w-3 h-3 animate-spin" />
                  ) : (
                    <Wand2 className="w-3 h-3" />
                  )}
                  {isOptimizing ? t("goalInput.optimizing") : t("goalInput.optimize")}
                </button>
              )}

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
                  disabled={!goal.trim() || isRunning || hasLoading}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold tracking-widest rounded border transition-all duration-200",
                    goal.trim() && isIdle && !hasLoading
                      ? "text-primary-foreground bg-primary border-primary hover:bg-primary/90 terminal-glow"
                      : "text-muted-foreground border-border cursor-not-allowed"
                  )}
                >
                  {hasLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  {hasLoading ? t("goalInput.processing") : outputMode === "qa" ? t("goalInput.send") : t("goalInput.execute")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Library Picker */}
      <PromptLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={(text) => { handleSuggestionClick(text); setLibraryOpen(false); }}
        currentMode={outputMode}
      />
    </div>
  );
}
