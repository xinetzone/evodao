import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Download, Check, Package } from "lucide-react";
import { Task, TaskStatus, AgentFile } from "@/hooks/useHarnessAgent";
import { buildMarkdown, downloadMarkdown, downloadZip, slugify } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";

interface ExportActionsProps {
  goal: string;
  tasks: Task[];
  taskOutputs: Record<number, string>;
  taskStatuses: Record<number, TaskStatus>;
  /** Files extracted in agent build mode */
  extractedFiles?: AgentFile[];
  /** compact = icon-only buttons, default = icon + label */
  compact?: boolean;
}

export function ExportActions({
  goal,
  tasks,
  taskOutputs,
  taskStatuses,
  extractedFiles,
  compact = false,
}: ExportActionsProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);

  const handleCopy = async () => {
    const md = buildMarkdown(goal, tasks, taskOutputs, taskStatuses);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => {
    const md = buildMarkdown(goal, tasks, taskOutputs, taskStatuses);
    const filename = `harness-${slugify(goal)}.md`;
    downloadMarkdown(md, filename);
  };

  const handleDownloadZip = async () => {
    if (!extractedFiles?.length) return;
    setZipping(true);
    try {
      await downloadZip(extractedFiles, slugify(goal));
    } finally {
      setZipping(false);
    }
  };

  const btnBase = cn(
    "flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold tracking-widest transition-all duration-200",
    compact && "px-2"
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
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

      {/* Download Markdown button */}
      <button
        onClick={handleDownloadMd}
        className={cn(
          btnBase,
          "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
        )}
        title={t("export.download")}
      >
        <Download className="w-3.5 h-3.5" />
        {!compact && <span>{t("export.download")}</span>}
      </button>

      {/* Download ZIP button — only shown in agent build mode with files */}
      {extractedFiles && extractedFiles.length > 0 && (
        <button
          onClick={handleDownloadZip}
          disabled={zipping}
          className={cn(
            btnBase,
            "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20",
            zipping && "opacity-60 cursor-not-allowed"
          )}
          title={t("export.downloadZip")}
        >
          <Package className="w-3.5 h-3.5" />
          {!compact && (
            <span>{zipping ? t("export.zipping") : t("export.downloadZip")}</span>
          )}
        </button>
      )}
    </div>
  );
}
