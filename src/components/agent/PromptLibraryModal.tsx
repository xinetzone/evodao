import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  X, Search, BookOpen, ArrowRight,
  Briefcase, PenLine, BarChart2, Code2, Bot, Palette, GraduationCap,
  FileText, Wrench, MessageSquare, ImageIcon, ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROMPT_THEMES, PromptTheme, PromptItem } from "@/data/promptLibrary";
import { OutputMode } from "@/hooks/useEvodaoAgent";

/* ── Mode filter config ────────────────────────────────────────────────── */
type ModeFilter = OutputMode | "all";

interface ModeTab {
  id: ModeFilter;
  icon: React.ElementType;
  labelZh: string;
  labelEn: string;
  badge: string;
  activeBg: string;
}

const MODE_TABS: ModeTab[] = [
  { id: "all",   icon: BookOpen,      labelZh: "全部",   labelEn: "All",   badge: "", activeBg: "bg-foreground text-background" },
  { id: "text",  icon: FileText,      labelZh: "任务",   labelEn: "Task",  badge: "text-sky-600 dark:text-sky-400",     activeBg: "bg-sky-500 text-white" },
  { id: "agent", icon: Wrench,        labelZh: "构建",   labelEn: "Build", badge: "text-violet-600 dark:text-violet-400", activeBg: "bg-violet-500 text-white" },
  { id: "qa",    icon: MessageSquare, labelZh: "问答",   labelEn: "Q&A",   badge: "text-emerald-600 dark:text-emerald-400", activeBg: "bg-emerald-600 text-white" },
  { id: "image", icon: ImageIcon,     labelZh: "图像",   labelEn: "Image", badge: "text-orange-600 dark:text-orange-400", activeBg: "bg-orange-500 text-white" },
];

/* ── Theme icon map ────────────────────────────────────────────────────── */
const THEME_ICONS: Record<string, React.ElementType> = {
  business:    Briefcase,
  content:     PenLine,
  data:        BarChart2,
  engineering: Code2,
  aieng:       Bot,
  visual:      Palette,
  learning:    GraduationCap,
  culture:     ScrollText,
};

const THEME_COLORS: Record<string, string> = {
  business:    "text-amber-500  border-amber-400/30  bg-amber-400/8",
  content:     "text-sky-500    border-sky-400/30    bg-sky-400/8",
  data:        "text-emerald-500 border-emerald-400/30 bg-emerald-400/8",
  engineering: "text-violet-500 border-violet-400/30 bg-violet-400/8",
  aieng:       "text-rose-500   border-rose-400/30   bg-rose-400/8",
  visual:      "text-orange-500 border-orange-400/30 bg-orange-400/8",
  learning:    "text-teal-500   border-teal-400/30   bg-teal-400/8",
  culture:     "text-lime-700   border-lime-500/30   bg-lime-500/8",
};

/* ── Mode chip on each card ────────────────────────────────────────────── */
const MODE_CHIP: Record<OutputMode, string> = {
  text:  "text-sky-600    bg-sky-100/70    border-sky-300/40    dark:text-sky-400    dark:bg-sky-400/10    dark:border-sky-400/20",
  agent: "text-violet-600 bg-violet-100/70 border-violet-300/40 dark:text-violet-400 dark:bg-violet-400/10 dark:border-violet-400/20",
  qa:    "text-emerald-600 bg-emerald-100/70 border-emerald-300/40 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20",
  image: "text-orange-600 bg-orange-100/70 border-orange-300/40 dark:text-orange-400 dark:bg-orange-400/10 dark:border-orange-400/20",
};

const MODE_LABEL_ZH: Record<OutputMode, string> = { text: "任务", agent: "构建", qa: "问答", image: "图像" };
const MODE_LABEL_EN: Record<OutputMode, string> = { text: "Task", agent: "Build", qa: "Q&A", image: "Image" };

/* ── Prompt card ───────────────────────────────────────────────────────── */
function PromptCard({ item, isZh, onSelect }: { item: PromptItem; isZh: boolean; onSelect: (t: string) => void }) {
  const text = isZh ? item.zh : item.en;
  const modeLabel = isZh ? MODE_LABEL_ZH[item.mode] : MODE_LABEL_EN[item.mode];
  return (
    <button
      onClick={() => onSelect(text)}
      className="group w-full text-left rounded-lg border border-border/60 bg-background/50 hover:border-primary/40 hover:bg-primary/4 hover:shadow-sm transition-all duration-200 overflow-hidden"
    >
      <div className="p-3">
        {/* Mode chip */}
        <span className={cn(
          "inline-flex items-center text-[9px] font-bold tracking-wider border rounded px-1.5 py-0.5 mb-2 leading-none",
          MODE_CHIP[item.mode]
        )}>
          {modeLabel}
        </span>
        {/* Prompt text */}
        <p className="text-[11px] text-muted-foreground/65 group-hover:text-foreground/75 leading-relaxed line-clamp-3 transition-colors duration-150">
          {text}
        </p>
      </div>
      {/* Hover action bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border/30 bg-primary/3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className="text-[9px] text-primary/60 tracking-wider font-semibold flex-1">
          {isZh ? "使用此提示词" : "Use this prompt"}
        </span>
        <ArrowRight className="w-3 h-3 text-primary/50" />
      </div>
    </button>
  );
}

/* ── Theme section ─────────────────────────────────────────────────────── */
function ThemeSection({
  theme, items, isZh, onSelect,
}: {
  theme: PromptTheme;
  items: PromptItem[];
  isZh: boolean;
  onSelect: (t: string) => void;
}) {
  const Icon = THEME_ICONS[theme.id] ?? BookOpen;
  const color = THEME_COLORS[theme.id] ?? "text-primary border-primary/20 bg-primary/5";
  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn("w-6 h-6 rounded-md border flex items-center justify-center shrink-0", color)}>
          <Icon className="w-3 h-3" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold text-foreground/80 tracking-wide">
            {isZh ? theme.labelZh : theme.labelEn}
          </span>
          <span className="ml-2 text-[9px] text-muted-foreground/40">
            {isZh ? theme.descZh : theme.descEn}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground/30 font-mono shrink-0">{items.length}</span>
      </div>
      {/* 2-col grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item, i) => (
          <PromptCard key={i} item={item} isZh={isZh} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/* ── Modal ─────────────────────────────────────────────────────────────── */
interface PromptLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
  currentMode: OutputMode;
}

export function PromptLibraryModal({ open, onClose, onSelect, currentMode }: PromptLibraryModalProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const searchRef = useRef<HTMLInputElement>(null);

  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setModeFilter("all");
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open, currentMode]);

  const totalPrompts = PROMPT_THEMES.reduce((n, t) => n + t.items.length, 0);

  // Build filtered theme→items map
  const visibleThemes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PROMPT_THEMES.map((theme) => {
      let items = theme.items;
      if (modeFilter !== "all") items = items.filter((p) => p.mode === modeFilter);
      if (q) items = items.filter((p) => (isZh ? p.zh : p.en).toLowerCase().includes(q));
      return { theme, items };
    }).filter(({ items }) => items.length > 0);
  }, [modeFilter, search, isZh]);

  const totalVisible = visibleThemes.reduce((n, { items }) => n + items.length, 0);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[72px] px-4 pb-4"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-3xl flex flex-col rounded-xl border border-border bg-card overflow-hidden"
        style={{ maxHeight: "calc(100vh - 88px)", boxShadow: "0 20px 60px hsl(0 0% 0% / 0.15), 0 0 0 1px hsl(var(--border))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
          <BookOpen className="w-4 h-4 text-primary/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold tracking-widest text-foreground/80">
              {t("promptLib.title")}
            </span>
            <span className="ml-2 text-[9px] text-muted-foreground/40 font-mono">
              {totalPrompts} prompts
            </span>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("promptLib.search")}
              className="w-36 sm:w-48 pl-7 pr-3 py-1.5 text-[11px] bg-background border border-border/70 rounded-full outline-none focus:border-primary/50 placeholder:text-muted-foreground/35 transition-colors"
            />
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-border/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Mode filter tabs ────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 shrink-0 overflow-x-auto scrollbar-none">
          {MODE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = modeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setModeFilter(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all duration-150 border",
                  isActive
                    ? cn(tab.activeBg, "border-transparent shadow-sm")
                    : "text-muted-foreground/60 border-border/50 hover:text-foreground/70 hover:bg-card/80"
                )}
              >
                <Icon className="w-3 h-3 shrink-0" />
                {isZh ? tab.labelZh : tab.labelEn}
              </button>
            );
          })}
          {/* Match count */}
          {(search || modeFilter !== "all") && (
            <span className="ml-auto text-[9px] text-muted-foreground/35 font-mono shrink-0 pl-2">
              {totalVisible}
            </span>
          )}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {visibleThemes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-border/20 flex items-center justify-center">
                <Search className="w-5 h-5 text-muted-foreground/25" />
              </div>
              <p className="text-xs text-muted-foreground/40">{t("promptLib.noResults")}</p>
            </div>
          ) : (
            visibleThemes.map(({ theme, items }) => (
              <ThemeSection
                key={theme.id}
                theme={theme}
                items={items}
                isZh={isZh}
                onSelect={(text) => { onSelect(text); onClose(); }}
              />
            ))
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-border/40 shrink-0">
          <span className="text-[9px] text-muted-foreground/30 tracking-wider">{t("promptLib.footer")}</span>
          <kbd className="text-[9px] text-muted-foreground/25 font-mono border border-border/30 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
      </div>
    </div>
  , document.body);
}
