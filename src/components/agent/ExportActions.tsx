import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Download, Check } from "lucide-react";
import { Task, TaskStatus } from "@/hooks/useHarnessAgent";
import { buildMarkdown, downloadMarkdown, slugify } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";

interface ExportActionsProps {
  goal: string;
  tasks: Task[];
  taskOutputs: Record<number, string>;
  taskStatuses: Record<number, TaskStatus>;
  /** compact = icon-only buttons, default = icon + label */
  compact?: boolean;
}

export function ExportActions({
  goal,
  tasks,
  taskOutputs,
  taskStatuses,
  compact = false,
}: ExportActionsProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const md = buildMarkdown(goal, tasks, taskOutputs, taskStatuses);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const md = buildMarkdown(goal, tasks, taskOutputs, taskStatuses);
    const filename = `harness-${slugify(goal)}.md`;
    downloadMarkdown(md, filename);
  };

  const btnBase = cn(
    "flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold tracking-widest transition-all duration-200",
    compact && "px-2"
  );

  return (
    <div className="flex items-center gap-2">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className={cn(
          btnBase,
          copied
            ? "border-primary/60 bg-primary/15 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
        )}
        title={t("export.copy")}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            {!compact && <span>{t("export.copied")}</span>}
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            {!compact && <span>{t("export.copy")}</span>}
          </>
        )}
      </button>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className={cn(
          btnBase,
          "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
        )}
        title={t("export.download")}
      >
        <Download className="w-3.5 h-3.5" />
        {!compact && <span>{t("export.download")}</span>}
      </button>
    </div>
  );
}
