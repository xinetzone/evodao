import { Brain, Loader } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MemoryItem } from "@/hooks/useMemory";

interface MemoryContextProps {
  memories: MemoryItem[];
  isSearching?: boolean;
}

export function MemoryContext({ memories, isSearching }: MemoryContextProps) {
  const { t } = useTranslation();

  if (!isSearching && memories.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <span className="text-primary">$</span>
        <Brain className="w-3 h-3 text-primary/60" />
        <span className="tracking-wider">{t("memory.heading")}</span>
        {isSearching ? (
          <span className="flex items-center gap-1 text-muted-foreground/50 text-[10px]">
            <Loader className="w-2.5 h-2.5 animate-spin" />
            {t("memory.searching")}
          </span>
        ) : memories.length > 0 ? (
          <span className="text-primary/50 text-[10px]">
            {t("memory.found", { count: memories.length })}
          </span>
        ) : null}
      </div>

      {!isSearching && memories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {memories.slice(0, 3).map((mem, i) => (
            <div
              key={mem.id}
              className="rounded border border-border/40 bg-card/20 p-2.5 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-primary/40 font-mono tracking-widest">
                  MEM [{String(i + 1).padStart(2, "0")}]
                </span>
                {mem.qualityScore != null && (
                  <span className="text-[9px] text-muted-foreground/40 font-mono">
                    ★ {mem.qualityScore}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-foreground/60 truncate mb-1 font-medium">
                {mem.goal.length > 58 ? mem.goal.slice(0, 58) + "…" : mem.goal}
              </p>
              <p className="text-[9px] text-muted-foreground/40 leading-relaxed line-clamp-2">
                {mem.taskSummaries.length > 110
                  ? mem.taskSummaries.slice(0, 110) + "…"
                  : mem.taskSummaries}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
