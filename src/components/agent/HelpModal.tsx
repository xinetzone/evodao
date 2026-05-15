import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  X, Rocket, ListChecks, Code2, MessageSquare, ImageIcon, Lightbulb,
  ChevronRight, Keyboard, Brain, Gauge, Cpu, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "start" | "task" | "agent" | "qa" | "image" | "tips";

const TABS: { id: Tab; icon: React.ElementType; color: string }[] = [
  { id: "start",  icon: Rocket,        color: "text-primary" },
  { id: "task",   icon: ListChecks,    color: "text-blue-500" },
  { id: "agent",  icon: Code2,         color: "text-violet-500" },
  { id: "qa",     icon: MessageSquare, color: "text-emerald-500" },
  { id: "image",  icon: ImageIcon,     color: "text-orange-500" },
  { id: "tips",   icon: Lightbulb,     color: "text-amber-500" },
];

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

/* ── Reusable UI atoms ───────────────────────────────────────────────── */

function StepCard({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[11px] font-bold text-primary font-mono">
        {n}
      </div>
      <div>
        <p className="text-xs font-bold text-foreground/90 mb-0.5">{title}</p>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function UseCaseBullet({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-[11px] text-muted-foreground/70">
      <ChevronRight className="w-3 h-3 text-primary/50 mt-0.5 shrink-0" />
      {text}
    </li>
  );
}

function ExampleChip({ text }: { text: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/50 px-3 py-2 text-[11px] text-muted-foreground/60 italic leading-relaxed font-mono">
      "{text}"
    </div>
  );
}

function TipCard({ title, icon: Icon, desc }: { title: string; icon: React.ElementType; desc: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/30 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-primary/60" />
        <span className="text-[10px] font-bold tracking-widest text-muted-foreground">{title}</span>
      </div>
      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{desc}</p>
    </div>
  );
}

/* ── Tab content panels ──────────────────────────────────────────────── */

function StartTab() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <p className="text-[11px] text-muted-foreground/70 leading-relaxed border-l-2 border-primary/30 pl-3">
        {t("guide.start.intro")}
      </p>
      <div className="space-y-4">
        {([1, 2, 3, 4] as const).map((n) => (
          <StepCard
            key={n}
            n={n}
            title={t(`guide.start.step${n}Title`)}
            desc={t(`guide.start.step${n}Desc`)}
          />
        ))}
      </div>
    </div>
  );
}

function ModeTab({ id, color }: { id: "task" | "agent" | "qa" | "image"; color: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {/* Badge + description */}
      <div>
        <span className={cn("text-[9px] font-bold tracking-widest font-mono border px-2 py-0.5 rounded", color, "border-current/30 bg-current/5")}>
          {t(`guide.${id}.badge`)}
        </span>
        <p className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
          {t(`guide.${id}.desc`)}
        </p>
      </div>

      {/* Use cases */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">USE CASES</p>
        <ul className="space-y-1.5">
          <UseCaseBullet text={t(`guide.${id}.uc1`)} />
          <UseCaseBullet text={t(`guide.${id}.uc2`)} />
          <UseCaseBullet text={t(`guide.${id}.uc3`)} />
        </ul>
      </div>

      {/* Example prompt */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">EXAMPLE</p>
        <ExampleChip text={t(`guide.${id}.example`)} />
      </div>

      {/* Tip */}
      <div className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500/60 mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          {t(`guide.${id}.tip`)}
        </p>
      </div>
    </div>
  );
}

function TipsTab() {
  const { t } = useTranslation();
  const shortcuts: [string, string][] = [
    ["Enter", t("guide.tips.kbEnter")],
    ["Shift + Enter", t("guide.tips.kbShiftEnter")],
    ["Esc", t("guide.tips.kbEsc")],
  ];
  return (
    <div className="space-y-4">
      {/* Keyboard shortcuts */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Keyboard className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
            {t("guide.tips.shortcutsTitle")}
          </span>
        </div>
        <div className="rounded border border-border/60 overflow-hidden">
          {shortcuts.map(([key, desc], i) => (
            <div
              key={key}
              className={cn(
                "flex items-center justify-between px-3 py-2",
                i < shortcuts.length - 1 && "border-b border-border/40",
                "hover:bg-card/30 transition-colors"
              )}
            >
              <code className="text-[11px] font-mono bg-background/60 border border-border/50 px-2 py-0.5 rounded text-primary/70">
                {key}
              </code>
              <span className="text-[11px] text-muted-foreground/60">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div className="space-y-2.5">
        <TipCard title={t("guide.tips.memoryTitle")} icon={Brain} desc={t("guide.tips.memoryDesc")} />
        <TipCard title={t("guide.tips.optimizeTitle")} icon={Wand2} desc={t("guide.tips.optimizeDesc")} />
        <TipCard title={t("guide.tips.modelTitle")} icon={Cpu} desc={t("guide.tips.modelDesc")} />
        <TipCard title={t("guide.tips.quotaTitle")} icon={Gauge} desc={t("guide.tips.quotaDesc")} />
      </div>
    </div>
  );
}

/* ── Main modal ──────────────────────────────────────────────────────── */

export function HelpModal({ open, onClose }: HelpModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("start");

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-lg border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
          <span className="text-xs font-bold tracking-widest text-primary flex-1">
            {t("guide.title")}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-36 shrink-0 border-r border-border/60 py-3 flex flex-col gap-0.5 overflow-y-auto">
            {TABS.map(({ id, icon: Icon, color }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-150 text-[11px] font-semibold tracking-wide",
                  activeTab === id
                    ? "bg-primary/10 border-r-2 border-primary text-foreground"
                    : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-card/40"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5 shrink-0", activeTab === id ? color : "text-muted-foreground/40")} />
                {t(`guide.tabs.${id}`)}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeTab === "start" && <StartTab />}
            {activeTab === "task" && <ModeTab id="task" color="text-blue-500" />}
            {activeTab === "agent" && <ModeTab id="agent" color="text-violet-500" />}
            {activeTab === "qa" && <ModeTab id="qa" color="text-emerald-500" />}
            {activeTab === "image" && <ModeTab id="image" color="text-orange-500" />}
            {activeTab === "tips" && <TipsTab />}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
