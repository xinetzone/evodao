import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Search, BookOpen, ArrowRight, FileText, Code2, MessageSquare, ImageIcon, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROMPT_LIBRARY, PromptCategory } from "@/data/promptLibrary";
import { OutputMode } from "@/hooks/useEvodaoAgent";

/* ── Mode metadata ─────────────────────────────────────────────────────── */
interface ModeStyle {
  label: (t: (k: string) => string) => string;
  icon: React.ElementType;
  badge: string;   // tailwind classes for the badge chip
  accent: string;  // tailwind classes for active sidebar highlight
  card: string;    // subtle tint on hover for prompt cards
}

const MODE_STYLES: Record<OutputMode | "all", ModeStyle> = {
  text: {
    label: (t) => t("agentMode.taskModeShort") || "任务",
    icon: FileText,
    badge: "text-sky-600 bg-sky-100/80 border-sky-300/50 dark:text-sky-400 dark:bg-sky-400/10 dark:border-sky-400/20",
    accent: "border-sky-500 bg-sky-50/60",
    card: "hover:border-sky-400/50 hover:bg-sky-50/30",
  },
  agent: {
    label: (t) => t("agentMode.agentBuildShort") || "构建",
    icon: Code2,
    badge: "text-violet-600 bg-violet-100/80 border-violet-300/50 dark:text-violet-400 dark:bg-violet-400/10 dark:border-violet-400/20",
    accent: "border-violet-500 bg-violet-50/60",
    card: "hover:border-violet-400/50 hover:bg-violet-50/30",
  },
  qa: {
    label: (t) => t("agentMode.qaChatShort") || "问答",
    icon: MessageSquare,
    badge: "text-emerald-600 bg-emerald-100/80 border-emerald-300/50 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20",
    accent: "border-emerald-500 bg-emerald-50/60",
    card: "hover:border-emerald-400/50 hover:bg-emerald-50/30",
  },
  image: {
    label: (t) => t("agentMode.imageGenShort") || "图像",
    icon: ImageIcon,
    badge: "text-orange-600 bg-orange-100/80 border-orange-300/50 dark:text-orange-400 dark:bg-orange-400/10 dark:border-orange-400/20",
    accent: "border-orange-500 bg-orange-50/60",
    card: "hover:border-orange-400/50 hover:bg-orange-50/30",
  },
  all: {
    label: (t) => t("promptLib.allModes") || "全部",
    icon: Layers,
    badge: "text-muted-foreground bg-muted/40 border-border/40",
    accent: "border-primary bg-primary/5",
    card: "hover:border-primary/40 hover:bg-primary/5",
  },
};

function ModeBadge({ mode, t }: { mode: OutputMode | "all"; t: (k: string) => string }) {
  const style = MODE_STYLES[mode];
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wider border rounded px-1.5 py-0.5 leading-none",
      style.badge
    )}>
      {style.label(t)}
    </span>
  );
}

/* ── Props ─────────────────────────────────────────────────────────────── */
interface PromptLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
  currentMode: OutputMode;
}

/* ── Component ─────────────────────────────────────────────────────────── */
export function PromptLibraryModal({ open, onClose, onSelect, currentMode }: PromptLibraryModalProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");

  const [activeCatId, setActiveCatId] = useState<string>(
    () => PROMPT_LIBRARY.find((c) => c.mode === currentMode)?.id ?? PROMPT_LIBRARY[0].id
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setActiveCatId(PROMPT_LIBRARY.find((c) => c.mode === currentMode)?.id ?? PROMPT_LIBRARY[0].id);
      setSearch("");
    }
  }, [open, currentMode]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      const cat = PROMPT_LIBRARY.find((c) => c.id === activeCatId);
      return cat ? cat.items.map((item) => ({ item, cat })) : [];
    }
    const results: { item: { zh: string; en: string }; cat: PromptCategory }[] = [];
    for (const cat of PROMPT_LIBRARY) {
      for (const item of cat.items) {
        const text = isZh ? item.zh : item.en;
        if (text.toLowerCase().includes(q)) results.push({ item, cat });
      }
    }
    return results;
  }, [activeCatId, search, isZh]);

  const activeCategory = PROMPT_LIBRARY.find((c) => c.id === activeCatId);
  const activeModeStyle = activeCategory ? MODE_STYLES[activeCategory.mode] : MODE_STYLES.all;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 pb-4"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" onClick={onClose} />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-3xl flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden"
        style={{ maxHeight: "calc(100vh - 100px)", boxShadow: "0 8px 40px hsl(36 30% 20% / 0.18), 0 0 0 1px hsl(38 22% 76% / 0.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 border-b border-border/60 shrink-0"
          style={{ background: "var(--gradient-hero), var(--gradient-card)" }}
        >
          {/* Icon */}
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-primary/70" />
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold tracking-widest text-foreground/80">
              {t("promptLib.title")}
            </span>
            <p className="text-[9px] text-muted-foreground/50 tracking-wider leading-tight mt-0.5">
              {PROMPT_LIBRARY.length} {isZh ? "个分类" : "categories"} · {PROMPT_LIBRARY.reduce((n, c) => n + c.items.length, 0)} {isZh ? "条提示词" : "prompts"}
            </p>
          </div>

          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("promptLib.search")}
              className="w-40 sm:w-52 pl-8 pr-3 py-1.5 text-[11px] bg-background/70 border border-border/60 rounded-full outline-none focus:border-primary/50 focus:bg-background/90 placeholder:text-muted-foreground/40 transition-all duration-200"
            />
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-border/30 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Sidebar */}
          {!search && (
            <div className="w-36 shrink-0 border-r border-border/50 overflow-y-auto bg-muted/20">
              {PROMPT_LIBRARY.map((cat, idx) => {
                const isActive = activeCatId === cat.id;
                const catStyle = MODE_STYLES[cat.mode];
                // Add a subtle divider between mode groups
                const prevCat = PROMPT_LIBRARY[idx - 1];
                const showDivider = idx > 0 && prevCat && prevCat.mode !== cat.mode;
                return (
                  <div key={cat.id}>
                    {showDivider && <div className="mx-3 my-1 border-t border-border/40" />}
                    <button
                      onClick={() => setActiveCatId(cat.id)}
                      className={cn(
                        "group w-full flex flex-col gap-1 px-3 py-2.5 text-left transition-all duration-150 border-l-2",
                        isActive
                          ? cn("border-l-2", catStyle.accent)
                          : "border-transparent hover:bg-card/60 hover:border-border/40"
                      )}
                    >
                      <span className={cn(
                        "text-[11px] font-semibold leading-tight transition-colors",
                        isActive ? "text-foreground" : "text-muted-foreground/60 group-hover:text-foreground/70"
                      )}>
                        {isZh ? cat.labelZh : cat.labelEn}
                      </span>
                      <ModeBadge mode={cat.mode} t={t} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Content header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-card/80 backdrop-blur-sm">
              {search ? (
                <>
                  <Search className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                  <span className="text-[10px] text-muted-foreground/60 flex-1">
                    {filteredItems.length > 0
                      ? `${filteredItems.length} ${t("promptLib.results") || "results"}`
                      : t("promptLib.noResults")}
                  </span>
                </>
              ) : activeCategory && (
                <>
                  <h3 className="text-[11px] font-bold text-foreground/75 tracking-wider flex-1">
                    {isZh ? activeCategory.labelZh : activeCategory.labelEn}
                  </h3>
                  <ModeBadge mode={activeCategory.mode} t={t} />
                  <span className="text-[9px] text-muted-foreground/35 font-mono">
                    {filteredItems.length}
                  </span>
                </>
              )}
            </div>

            {/* Prompt list */}
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-xl bg-border/20 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground/40 tracking-wider">{t("promptLib.noResults")}</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {filteredItems.map(({ item, cat }, i) => {
                  const text = isZh ? item.zh : item.en;
                  const cardStyle = MODE_STYLES[cat.mode];
                  return (
                    <button
                      key={i}
                      onClick={() => onSelect(text)}
                      className={cn(
                        "group w-full text-left rounded-lg border border-border/50 bg-card",
                        "transition-all duration-200",
                        search ? cn(cardStyle.card) : cn(activeModeStyle.card)
                      )}
                    >
                      <div className="flex items-start gap-3 p-3.5">
                        {/* Left accent bar */}
                        <div className={cn(
                          "w-0.5 self-stretch rounded-full shrink-0 mt-0.5 transition-opacity duration-200",
                          "opacity-0 group-hover:opacity-100",
                          "bg-primary"
                        )} />

                        <div className="flex-1 min-w-0">
                          {/* Search result: show category badge */}
                          {search && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <ModeBadge mode={cat.mode} t={t} />
                              <span className="text-[9px] text-muted-foreground/40">
                                {isZh ? cat.labelZh : cat.labelEn}
                              </span>
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground/65 group-hover:text-foreground/80 leading-relaxed line-clamp-2 transition-colors duration-150">
                            {text}
                          </p>
                        </div>

                        {/* Arrow — visible on hover */}
                        <div className="shrink-0 flex items-center self-center">
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-primary/50 translate-x-0 group-hover:translate-x-0.5 transition-all duration-150" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-background/20 shrink-0">
          <span className="text-[9px] text-muted-foreground/35 tracking-wider">
            {t("promptLib.footer")}
          </span>
          <kbd className="text-[9px] text-muted-foreground/30 font-mono border border-border/30 rounded px-1.5 py-0.5 bg-background/30">
            ESC
          </kbd>
        </div>
      </div>
    </div>
  );
}
