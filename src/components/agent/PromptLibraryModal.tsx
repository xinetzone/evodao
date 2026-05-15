import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Search, BookOpen, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROMPT_LIBRARY, PromptCategory } from "@/data/promptLibrary";
import { OutputMode } from "@/hooks/useEvodaoAgent";

const MODE_ORDER: (OutputMode | "all")[] = ["text", "agent", "qa", "image", "all"];

function modeLabel(mode: OutputMode | "all", t: (k: string) => string): string {
  if (mode === "all") return t("promptLib.allModes");
  if (mode === "text") return t("agentMode.taskModeShort") || "任务";
  if (mode === "agent") return t("agentMode.agentBuildShort") || "构建";
  if (mode === "qa") return t("agentMode.qaChatShort") || "问答";
  if (mode === "image") return t("agentMode.imageGenShort") || "图像";
  return mode;
}

function modeColor(mode: OutputMode | "all"): string {
  if (mode === "text") return "text-blue-400/70 bg-blue-400/10 border-blue-400/20";
  if (mode === "agent") return "text-violet-400/70 bg-violet-400/10 border-violet-400/20";
  if (mode === "qa") return "text-emerald-400/70 bg-emerald-400/10 border-emerald-400/20";
  if (mode === "image") return "text-orange-400/70 bg-orange-400/10 border-orange-400/20";
  return "text-muted-foreground/60 bg-muted/10 border-border/30";
}

interface PromptLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
  currentMode: OutputMode;
}

export function PromptLibraryModal({ open, onClose, onSelect, currentMode }: PromptLibraryModalProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");

  const [activeCatId, setActiveCatId] = useState<string>(
    () => PROMPT_LIBRARY.find((c) => c.mode === currentMode)?.id ?? PROMPT_LIBRARY[0].id
  );
  const [search, setSearch] = useState("");

  // Reset to current mode's category whenever modal opens
  useEffect(() => {
    if (open) {
      setActiveCatId(PROMPT_LIBRARY.find((c) => c.mode === currentMode)?.id ?? PROMPT_LIBRARY[0].id);
      setSearch("");
    }
  }, [open, currentMode]);

  // Compute filtered prompts
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      const cat = PROMPT_LIBRARY.find((c) => c.id === activeCatId);
      return cat ? cat.items : [];
    }
    // Search across all categories
    const results: { cat: PromptCategory; text: string }[] = [];
    for (const cat of PROMPT_LIBRARY) {
      for (const item of cat.items) {
        const text = isZh ? item.zh : item.en;
        if (text.toLowerCase().includes(q)) {
          results.push({ cat, text });
        }
      }
    }
    return results.map((r) => ({ zh: r.text, en: r.text, _cat: r.cat }));
  }, [activeCatId, search, isZh]);

  const activeCategory = PROMPT_LIBRARY.find((c) => c.id === activeCatId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-3xl max-h-[85vh] flex flex-col rounded-lg border border-border bg-card shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <BookOpen className="w-3.5 h-3.5 text-primary/60 shrink-0" />
          <span className="text-xs font-bold tracking-widest text-primary flex-1">
            {t("promptLib.title")}
          </span>
          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("promptLib.search")}
              className="w-44 sm:w-56 pl-7 pr-3 py-1.5 text-[11px] bg-background/50 border border-border/60 rounded outline-none focus:border-primary/40 placeholder:text-muted-foreground/40 transition-colors"
            />
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Category sidebar — hidden on mobile when searching */}
          {!search && (
            <div className="w-32 sm:w-36 shrink-0 border-r border-border/50 py-2 flex flex-col overflow-y-auto">
              {PROMPT_LIBRARY.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCatId(cat.id)}
                  className={cn(
                    "group flex flex-col gap-0.5 px-3 py-2.5 text-left transition-all duration-150",
                    activeCatId === cat.id
                      ? "bg-primary/8 border-r-2 border-primary"
                      : "hover:bg-card/40"
                  )}
                >
                  <span className={cn(
                    "text-[11px] font-semibold leading-tight",
                    activeCatId === cat.id ? "text-foreground" : "text-muted-foreground/60 group-hover:text-muted-foreground"
                  )}>
                    {isZh ? cat.labelZh : cat.labelEn}
                  </span>
                  <span className={cn(
                    "text-[9px] font-mono font-bold tracking-wider border rounded px-1 py-0 w-fit",
                    modeColor(cat.mode)
                  )}>
                    {modeLabel(cat.mode, t)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Prompt content area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {/* Section header */}
            {!search && activeCategory && (
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-bold text-foreground/80 tracking-wider">
                  {isZh ? activeCategory.labelZh : activeCategory.labelEn}
                </h3>
                <span className={cn(
                  "text-[9px] font-mono font-bold tracking-wider border rounded px-1.5 py-0.5",
                  modeColor(activeCategory.mode)
                )}>
                  {modeLabel(activeCategory.mode, t)}
                </span>
                <span className="text-[9px] text-muted-foreground/40 ml-auto">
                  {filteredItems.length} prompts
                </span>
              </div>
            )}

            {search && (
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-[11px] text-muted-foreground/60">
                  {filteredItems.length > 0
                    ? `${filteredItems.length} ${t("promptLib.results") || "results"}`
                    : t("promptLib.noResults")}
                </span>
              </div>
            )}

            {/* Prompt cards */}
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40">
                <BookOpen className="w-8 h-8 mb-2" />
                <p className="text-xs tracking-wider">{t("promptLib.noResults")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item, i) => {
                  const text = isZh ? item.zh : item.en;
                  return (
                    <button
                      key={i}
                      onClick={() => onSelect(text)}
                      className="group w-full text-left rounded border border-border/60 bg-background/30 hover:border-primary/40 hover:bg-primary/5 transition-all duration-150 overflow-hidden"
                    >
                      <div className="flex items-start gap-3 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-muted-foreground/70 group-hover:text-foreground/80 leading-relaxed line-clamp-2 transition-colors">
                            {text}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary/50 shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border/40 shrink-0">
          <span className="text-[9px] text-muted-foreground/40 tracking-wider">
            {t("promptLib.footer") || "点击任意提示词填入输入框"}
          </span>
        </div>
      </div>
    </div>
  );
}
