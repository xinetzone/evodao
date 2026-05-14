import { useTranslation } from "react-i18next";
import { Dna, Loader, CheckCircle, AlertTriangle, ArrowRight, X, Sparkles } from "lucide-react";
import { ReflectionResult, EvolutionStatus } from "@/hooks/useEvodaoAgent";
import { cn } from "@/lib/utils";

interface EvolutionPanelProps {
  evolutionStatus: EvolutionStatus;
  reflection: ReflectionResult | null;
  evolutionRound: number;
  maxRounds: number;
  onEvolve: () => void;
  onApply: () => void;
  onDismiss: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "hsl(142 100% 50%)" : score >= 50 ? "hsl(45 100% 55%)" : "hsl(0 85% 60%)";

  return (
    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
      <svg className="-rotate-90" width="56" height="56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

export function EvolutionPanel({
  evolutionStatus,
  reflection,
  evolutionRound,
  maxRounds,
  onEvolve,
  onApply,
  onDismiss,
}: EvolutionPanelProps) {
  const { t } = useTranslation();
  const isMaxRounds = evolutionRound >= maxRounds;

  // ── Idle: just the EVOLVE button ─────────────────────────────────────────
  if (evolutionStatus === "idle") {
    return (
      <div className="animate-fade-in flex items-center gap-3 px-4 py-3 rounded border border-border bg-card/60">
        <Dna className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-[11px] text-muted-foreground">
            {isMaxRounds
              ? t("evolution.maxRounds", { max: maxRounds })
              : evolutionRound > 0
              ? t("evolution.roundBadge", { from: evolutionRound, to: evolutionRound + 1 })
              : t("evolution.hint")}
          </p>
        </div>
        {!isMaxRounds && (
          <button
            onClick={onEvolve}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold tracking-widest rounded border border-primary/40 text-primary bg-primary/10 hover:bg-primary/20 transition-all duration-200"
          >
            <Dna className="w-3.5 h-3.5" />
            {t("evolution.evolveBtn")}
          </button>
        )}
      </div>
    );
  }

  // ── Reflecting ────────────────────────────────────────────────────────────
  if (evolutionStatus === "reflecting") {
    return (
      <div className="animate-fade-in flex items-center gap-3 px-4 py-3 rounded border border-primary/30 bg-primary/5 terminal-glow">
        <Loader className="w-4 h-4 text-primary animate-spin shrink-0" />
        <div>
          <p className="text-xs font-bold text-primary tracking-widest">
            {t("evolution.reflecting")}
          </p>
          <p className="text-[10px] text-foreground/50 mt-0.5">{t("evolution.reflectingDesc")}</p>
        </div>
      </div>
    );
  }

  // ── Reflected: full report ────────────────────────────────────────────────
  if (!reflection) return null;

  return (
    <div className="animate-fade-in rounded border border-primary/30 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary/5">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-bold text-primary tracking-widest">
            {t("evolution.reportTitle")}
          </p>
          <p className="text-[10px] text-foreground/50 mt-0.5">
            {t("evolution.roundBadge", { from: evolutionRound, to: evolutionRound + 1 })}
          </p>
        </div>
        <ScoreRing score={reflection.qualityScore} />
        <div className="text-right shrink-0">
          <p className="text-[9px] text-muted-foreground tracking-widest">{t("evolution.qualityScore")}</p>
          <p className="text-[10px] font-bold text-foreground/60">/100</p>
        </div>
        <button onClick={onDismiss} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Strengths */}
        {reflection.strengths.length > 0 && (
          <div>
            <p className="text-[10px] font-bold tracking-widest text-green-400 mb-2 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3" /> {t("evolution.strengths")}
            </p>
            <ul className="space-y-1">
              {reflection.strengths.map((s, i) => (
                <li key={i} className="text-[11px] text-foreground/70 flex items-start gap-2">
                  <span className="text-green-400/60 mt-0.5 shrink-0">▸</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {reflection.weaknesses.length > 0 && (
          <div>
            <p className="text-[10px] font-bold tracking-widest text-yellow-400 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> {t("evolution.weaknesses")}
            </p>
            <ul className="space-y-1">
              {reflection.weaknesses.map((w, i) => (
                <li key={i} className="text-[11px] text-foreground/70 flex items-start gap-2">
                  <span className="text-yellow-400/60 mt-0.5 shrink-0">▸</span>{w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {reflection.improvements.length > 0 && (
          <div>
            <p className="text-[10px] font-bold tracking-widest text-primary mb-2 flex items-center gap-1.5">
              <ArrowRight className="w-3 h-3" /> {t("evolution.improvements")}
            </p>
            <ul className="space-y-1">
              {reflection.improvements.map((imp, i) => (
                <li key={i} className="text-[11px] text-foreground/70 flex items-start gap-2">
                  <span className="text-primary/60 mt-0.5 shrink-0">▸</span>{imp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Evolved goal */}
        <div className={cn(
          "rounded border border-primary/20 bg-primary/5 px-3 py-2.5"
        )}>
          <p className="text-[9px] text-primary/60 tracking-widest font-bold mb-1">
            {t("evolution.evolvedGoal")}
          </p>
          <p className="text-[11px] text-foreground/80 leading-relaxed">
            {reflection.evolvedGoal}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onApply}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold tracking-widest rounded border border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 terminal-glow"
          >
            <Dna className="w-3.5 h-3.5" />
            {t("evolution.applyBtn")}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-2 text-xs text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all duration-200"
          >
            {t("evolution.dismissBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
