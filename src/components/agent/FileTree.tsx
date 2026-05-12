import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Folder, FileCode, ChevronRight, Copy, Check } from "lucide-react";
import { AgentFile } from "@/hooks/useHarnessAgent";
import { cn } from "@/lib/utils";

const LANG_COLORS: Record<string, string> = {
  python: "text-green-400 border-green-400/30 bg-green-400/10",
  typescript: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  javascript: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  json: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
  yaml: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  markdown: "text-foreground/60 border-border bg-card",
  html: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  css: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  bash: "text-primary border-primary/30 bg-primary/10",
  sh: "text-primary border-primary/30 bg-primary/10",
  toml: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  dockerfile: "text-blue-400 border-blue-400/30 bg-blue-400/10",
};

function getLangColor(lang: string) {
  return LANG_COLORS[lang] ?? "text-muted-foreground border-border bg-card";
}

interface FileRowProps {
  file: AgentFile;
}

function FileRow({ file }: FileRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-primary/5 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-[11px] font-mono text-foreground/80 truncate">
          {file.path}
        </span>
        <span
          className={cn(
            "shrink-0 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded border",
            getLangColor(file.language)
          )}
        >
          {file.language}
        </span>
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
            expanded && "rotate-90"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border bg-background/80 relative group/code">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover/code:opacity-100 transition-opacity bg-card border border-border text-muted-foreground hover:text-foreground"
            title={t("fileTree.copy")}
          >
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
          </button>
          <pre className="text-[11px] font-mono text-foreground/70 leading-relaxed p-3 pr-8 overflow-x-auto max-h-64 whitespace-pre">
            {file.content}
          </pre>
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  files: AgentFile[];
  tasks: Array<{ id: number; title: string }>;
}

export function FileTree({ files, tasks }: FileTreeProps) {
  const { t } = useTranslation();

  if (files.length === 0) return null;

  // Group by taskId
  const byTask: Record<number, AgentFile[]> = {};
  files.forEach((f) => {
    if (!byTask[f.taskId]) byTask[f.taskId] = [];
    byTask[f.taskId].push(f);
  });

  const taskMap: Record<number, string> = {};
  tasks.forEach((t) => { taskMap[t.id] = t.title; });

  return (
    <div className="animate-fade-in space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Folder className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold tracking-widest text-primary">
          {t("fileTree.title")}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">
          {files.length}
        </span>
      </div>

      {/* Files grouped by task */}
      {Object.entries(byTask).map(([taskIdStr, taskFiles]) => {
        const taskId = Number(taskIdStr);
        return (
          <div key={taskId} className="space-y-1.5">
            {/* Task label */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-[9px] font-bold text-primary/50 tracking-widest">
                TASK {String(taskId).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {taskMap[taskId] || ""}
              </span>
            </div>
            {taskFiles.map((file) => (
              <FileRow key={`${file.taskId}-${file.path}`} file={file} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
