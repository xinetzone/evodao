import { useState, useRef } from "react";
import { Play, RotateCcw, Square, Wand2, Loader, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentStatus, OutputMode } from "@/hooks/useHarnessAgent";
import { ModelSelector } from "@/components/agent/ModelSelector";
import { ModelId, getAutoModel } from "@/lib/models";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { cn } from "@/lib/utils";

interface GoalInputProps {
  status: AgentStatus;
  onRun: (goal: string, outputMode: OutputMode, model: string) => void;
  onReset: () => void;
  suggestions?: string[];
  suggestionsLoading?: boolean;
  suggestionsAI?: boolean;
}

export function GoalInput({
  status,
  onRun,
  onReset,
  suggestions = [],
  suggestionsLoading = false,
  suggestionsAI = false,
}: GoalInputProps) {
  const { t } = useTranslation();
  const [goal, setGoal] = useState("");
  const [outputMode, setOutputMode] = useState<OutputMode>("text");
  const [manualModel, setManualModel] = useState<ModelId | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholders: string[] = t("goalInput.placeholders", { returnObjects: true }) as string[];
  const qaPlaceholders: string[] = t("agentMode.qaChatPlaceholders", { returnObjects: true }) as string[];
  const staticSuggestions: string[] = t(
    outputMode === "agent" ? "promptSuggestions.agent"
    : outputMode === "qa" ? "promptSuggestions.qa"
    : "promptSuggestions.text",
    { returnObjects: true }
  ) as string[];
  const [placeholderIndex] = useState(() => Math.floor(Math.random() * 4));

  const activePlaceholders = outputMode === "qa" ? qaPlaceholders : placeholders;
  // AI suggestions override static ones once available
  const activeSuggestions = suggestions.length > 0 ? suggestions : staticSuggestions;

  const isRunning = status === "planning" || status === "executing";
  const isDone = status === "done" || status === "error";
  const isIdle = status === "idle";

  const handleRun = () => {
    if (!goal.trim() || isRunning) return;
    const model = manualModel ?? getAutoModel(outputMode);
    onRun(goal.trim(), outputMode, model);
  };

  const handleReset = () => {
    setGoal("");
    onReset();
    setTimeout(() => textareaRef.current?.focus(), 50);
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

  return (
    <div className="animate-fade-in">
      {/* Mode toggle + prompt header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-primary">$</span>
          <span className="tracking-wider">{t("goalInput.prompt")}</span>
          <span className="text-muted-foreground/40">{t("goalInput.hint")}</span>
        </div>

        {/* Mode toggle pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 rounded border border-border bg-card">
            {(["text", "agent", "qa"] as OutputMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setOutputMode(m)}
                disabled={isRunning}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-semibold tracking-widest rounded transition-all duration-150",
                  outputMode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "text" ? t("agentMode.taskMode") : m === "agent" ? t("agentMode.agentBuild") : t("agentMode.qaChat")}
              </button>
            ))}
          </div>

          {/* Model selector */}
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
        <p className="text-[10px] text-primary/60 tracking-wider mb-2 pl-4 border-l border-primary/30">
          {t("agentMode.agentBuildHint")}
        </p>
      )}
      {outputMode === "qa" && (
        <p className="text-[10px] text-primary/60 tracking-wider mb-2 pl-4 border-l border-primary/30">
          {t("agentMode.qaChatHint")}
        </p>
      )}

      {/* Prompt suggestion chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3 min-h-[26px]">
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
                className="px-2 py-0.5 text-[10px] text-muted-foreground/70 border border-border/60 rounded hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all duration-150 truncate max-w-[240px] text-left"
                title={s}
              >
                {s.length > 42 ? s.slice(0, 42) + "…" : s}
              </button>
            ))}
          </>
        )}
      </div>

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
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground/60 tracking-wider">
              {goal.length > 0
                ? t("goalInput.chars", { count: goal.length })
                : t("goalInput.awaiting")}
            </p>

            <div className="flex items-center gap-2">
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
                  disabled={!goal.trim() || isRunning}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold tracking-widest rounded border transition-all duration-200",
                    goal.trim() && isIdle
                      ? "text-primary-foreground bg-primary border-primary hover:bg-primary/90 terminal-glow"
                      : "text-muted-foreground border-border cursor-not-allowed"
                  )}
                >
                  <Play className="w-3 h-3" />
                  {outputMode === "qa" ? t("goalInput.send") : t("goalInput.execute")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
