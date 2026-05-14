import { useState, useRef, useEffect } from "react";
import { Play, RotateCcw, Square, Wand2, Loader, Sparkles, ImageIcon, ChevronDown, Check, Paperclip, FileText, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentStatus, OutputMode } from "@/hooks/useEvodaoAgent";
import { ModelSelector } from "@/components/agent/ModelSelector";
import { ModelId, ImageModelId, IMAGE_MODELS, getAutoModel, IMAGE_MODEL_DISPLAY } from "@/lib/models";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useAttachments, Attachment } from "@/hooks/useAttachments";

interface GoalInputProps {
  status: AgentStatus;
  onRun: (goal: string, outputMode: OutputMode, model: string, attachments: Attachment[]) => void;
  onReset: () => void;
  onModelChange?: (model: string) => void;
  suggestions?: string[];
  suggestionsLoading?: boolean;
  suggestionsAI?: boolean;
}

export function GoalInput({
  status,
  onRun,
  onReset,
  onModelChange,
  suggestions = [],
  suggestionsLoading = false,
  suggestionsAI = false,
}: GoalInputProps) {
  const { t } = useTranslation();
  const [goal, setGoal] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("text");
  const [manualModel, setManualModel] = useState<ModelId | null>(null);
  const [imageModel, setImageModel] = useState<ImageModelId>("openai/gpt-image-2");
  const [imageModelOpen, setImageModelOpen] = useState(false);
  const imageModelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { attachments, hasLoading, addFiles, removeAttachment, clearAttachments } = useAttachments();

  // Notify parent whenever the effective model changes (for footer display)
  useEffect(() => {
    const effective = outputMode === "image"
      ? imageModel
      : (manualModel ?? getAutoModel(outputMode));
    onModelChange?.(effective);
  }, [outputMode, manualModel, imageModel, onModelChange]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (imageModelRef.current && !imageModelRef.current.contains(e.target as Node)) {
        setImageModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedReason, setDetectedReason] = useState<string | null>(null);
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
    setTimeout(() => {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length || 0;
      textareaRef.current?.setSelectionRange(len, len);
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
        setOutputMode(data.outputMode as OutputMode);
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
          <span className="hidden sm:inline text-muted-foreground/40">{t("goalInput.hint")}</span>
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
                "flex items-center gap-1 px-2 py-1 text-[9px] font-bold tracking-widest rounded border transition-all duration-200",
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
            {(["text", "agent", "qa", "image"] as OutputMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setOutputMode(m)}
                disabled={isRunning}
                className={cn(
                  "px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] font-semibold tracking-widest rounded transition-all duration-150",
                  outputMode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "text" ? t("agentMode.taskMode")
                  : m === "agent" ? t("agentMode.agentBuild")
                  : m === "qa" ? t("agentMode.qaChat")
                  : t("agentMode.imageGen")}
              </button>
            ))}
          </div>

          {/* Image model selector — visible in image mode only */}
          {outputMode === "image" ? (
            <div className="relative" ref={imageModelRef}>
              <button
                onClick={() => setImageModelOpen(!imageModelOpen)}
                disabled={isRunning}
                className="flex items-center gap-1.5 pl-2 pr-2 py-1 rounded border border-border bg-card hover:border-primary/40 transition-all duration-200 disabled:opacity-50"
              >
                <ImageIcon className="w-2.5 h-2.5 text-primary/60 shrink-0" />
                <span className="text-[9px] font-bold tracking-widest text-foreground/80 font-mono max-w-[100px] truncate">
                  {IMAGE_MODEL_DISPLAY[imageModel]?.name ?? imageModel.split("/")[1]}
                </span>
                <ChevronDown className={cn("w-2.5 h-2.5 text-muted-foreground/50 transition-transform duration-200 shrink-0", imageModelOpen && "rotate-180")} />
              </button>

              {imageModelOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded border border-border/80 bg-card shadow-xl z-[60] overflow-hidden animate-fade-in">
                  <div className="px-2.5 py-1.5 border-b border-border/40">
                    <p className="text-[9px] text-muted-foreground/50 tracking-widest font-mono">IMAGE MODEL</p>
                  </div>
                  <div className="py-0.5">
                    {IMAGE_MODELS.map((m) => (
                      <button
                        key={m}
                        onClick={() => { setImageModel(m); setImageModelOpen(false); }}
                        className={cn(
                          "w-full flex items-center justify-between gap-2 px-3 py-2 text-[10px] tracking-wider transition-colors",
                          m === imageModel
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        )}
                      >
                        <span className="font-mono font-bold">{IMAGE_MODEL_DISPLAY[m]?.name ?? m.split("/")[1]}</span>
                        {m === imageModel && <Check className="w-3 h-3 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ModelSelector
              outputMode={outputMode}
              manualModel={manualModel}
              onChange={setManualModel}
              disabled={isRunning}
            />
          )}
        </div>
      </div>

      {/* Mode hint */}
      {outputMode === "agent" && (
        <p className="text-[10px] text-primary/60 tracking-wider mb-2 pl-4 border-l border-primary/30">
          {t("agentMode.agentBuildHint")}
        </p>
      )}
      {outputMode === "qa" && (
        <p className="text-[10px] text-primary/60 tracking-wider mb-2 pl-4 border-l border-primary/30">
          {t("agentMode.qaChatHint")}
        </p>
      )}
      {outputMode === "image" && (
        <p className="text-[10px] text-primary/60 tracking-wider mb-2 pl-4 border-l border-primary/30">
          {t("agentMode.imageGenHint")}
        </p>
      )}

      {/* Intent detection reason badge */}
      {detectedReason && (
        <div className="flex items-center gap-1.5 mb-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 w-fit">
          <Sparkles className="w-2.5 h-2.5 text-primary/60 shrink-0" />
          <span className="text-[10px] text-primary/70 tracking-wide">
            <span className="font-bold">{t("intent.reason")}</span>{detectedReason}
          </span>
        </div>
      )}

      {/* Prompt suggestion chips */}
      <div className="flex items-center gap-1.5 mb-3 min-h-[26px] overflow-x-auto pb-0.5 scrollbar-none">
        {suggestionsLoading ? (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            <Loader className="w-3 h-3 animate-spin" />
            {t("promptSuggestions.loading")}
          </div>
        ) : (
          <>
            <span className="text-[9px] text-muted-foreground/40 tracking-widest font-bold shrink-0">
              {suggestionsAI ? (
                <span className="flex items-center gap-1 text-primary/50">
                  <Sparkles className="w-2.5 h-2.5" />
                  {t("promptSuggestions.aiLabel")}
                </span>
              ) : (
                t("promptSuggestions.label")
              )}
            </span>
            {activeSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(s)}
                disabled={isRunning}
                className="shrink-0 px-2 py-0.5 text-[10px] text-muted-foreground/70 border border-border/60 rounded hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all duration-150 truncate max-w-[200px] sm:max-w-[240px] text-left"
                title={s}
              >
                {s.length > 42 ? s.slice(0, 42) + "…" : s}
              </button>
            ))}
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
                "flex items-center gap-1.5 shrink-0 px-2 py-1 rounded border text-[10px] max-w-[160px]",
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
                title="移除"
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
                "w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/40",
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
                title="上传附件（图片、PDF、TXT…）"
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all duration-200 disabled:opacity-40"
              >
                <Paperclip className="w-3 h-3" />
                <span className="hidden sm:inline tracking-wider">附件</span>
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
              <p className="text-[10px] text-muted-foreground/60 tracking-wider">
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
                    "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-widest rounded border transition-all duration-200",
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
                  {hasLoading ? "处理中…" : outputMode === "qa" ? t("goalInput.send") : outputMode === "image" ? t("goalInput.generate") : t("goalInput.execute")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
