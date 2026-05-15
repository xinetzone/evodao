import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, Cpu, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { OutputMode } from "@/hooks/useEvodaoAgent";
import { MODELS, ModelId, getAutoModel, MODEL_DISPLAY } from "@/lib/models";

interface ModelSelectorProps {
  outputMode: OutputMode;
  manualModel: ModelId | null;
  onChange: (model: ModelId | null) => void;
  disabled?: boolean;
}

interface DropdownPos {
  top: number;
  right: number;
  width: number;
}

export function ModelSelector({ outputMode, manualModel, onChange, disabled }: ModelSelectorProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  // triggerRef: for position calculation; dropdownRef: wrapper for outside-click; portalRef: portal content for outside-click
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const activeModel = manualModel ?? getAutoModel(outputMode);
  const isAuto = manualModel === null;

  const modelName = (id: ModelId): string => MODEL_DISPLAY[id]?.name ?? id.split("/")[1];
  const modelDesc = (id: ModelId): string =>
    i18n.language === "zh"
      ? (MODEL_DISPLAY[id]?.descZh ?? "")
      : (MODEL_DISPLAY[id]?.desc ?? "");

  // Compute fixed position when opening — clamp so left edge stays ≥ 8px from viewport
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const width = Math.min(220, vw - 16);          // shrink on very narrow screens
      const idealRight = vw - rect.right;
      const leftEdge = vw - idealRight - width;
      const right = leftEdge < 8 ? Math.max(0, vw - width - 8) : idealRight;
      setDropdownPos({ top: rect.bottom + 6, right: Math.max(0, right), width });
    }
  }, [open]);

  // Close on outside click — check both wrapper and portal content
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = dropdownRef.current?.contains(target);
      const insidePortal = portalRef.current?.contains(target);
      if (!insideWrapper && !insidePortal) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dropdownContent = (
    <div
      ref={portalRef}
      style={{
        position: "fixed",
        top: dropdownPos?.top ?? 0,
        right: dropdownPos?.right ?? 0,
        width: dropdownPos?.width ?? 220,
      }}
      className="z-[200] rounded border border-border bg-card shadow-xl shadow-black/50 overflow-y-auto max-h-[70vh] animate-fade-in"
    >
      {/* AUTO option */}
      <button
        onClick={() => { onChange(null); setOpen(false); }}
        className={cn(
          "w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
          isAuto
            ? "bg-primary/10 text-primary"
            : "text-foreground/70 hover:bg-primary/5 hover:text-foreground"
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-bold tracking-widest">
              {t("modelSelector.auto")}
            </span>
            <span className="text-[8px] px-1 py-px rounded bg-primary/20 text-primary font-bold leading-none uppercase">
              auto
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground/60 leading-tight">
            {t("modelSelector.autoDesc")}
          </div>
        </div>
        {isAuto && <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />}
      </button>

      <div className="mx-3 border-t border-border/40" />

      {/* Model list */}
      {MODELS.map((id) => (
        <button
          key={id}
          onClick={() => { onChange(id); setOpen(false); }}
          className={cn(
            "w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
            manualModel === id
              ? "bg-primary/10 text-primary"
              : "text-foreground/70 hover:bg-primary/5 hover:text-foreground"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold tracking-wider mb-0.5">
              {modelName(id)}
            </div>
            <div className="text-[10px] text-muted-foreground/60 leading-tight">
              {modelDesc(id)}
            </div>
          </div>
          {manualModel === id && <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title={`${t("modelSelector.label")}: ${modelName(activeModel)}${isAuto ? " (AUTO)" : ""}`}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2.5 text-[10px] font-semibold tracking-wider rounded border transition-all duration-150",
          disabled
            ? "border-border/30 text-muted-foreground/30 cursor-not-allowed"
            : open
            ? "border-primary/60 text-primary bg-primary/5"
            : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
        )}
      >
        <Cpu className="w-3 h-3 shrink-0" />
        <span className="max-w-[96px] truncate">{modelName(activeModel)}</span>
        {isAuto && (
          <span className="px-1 py-px rounded text-[8px] bg-primary/20 text-primary font-bold leading-none">
            {t("modelSelector.auto")}
          </span>
        )}
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-150", open && "rotate-180")} />
      </button>

      {/* Dropdown rendered in portal to avoid overflow-y:auto clipping */}
      {open && dropdownPos && createPortal(dropdownContent, document.body)}
    </div>
  );
}
