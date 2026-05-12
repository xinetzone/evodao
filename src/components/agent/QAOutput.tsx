import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Copy, Check, MessageSquare } from "lucide-react";
import { QAMessage } from "@/hooks/useHarnessAgent";
import { cn } from "@/lib/utils";

interface QAOutputProps {
  messages: QAMessage[];
  onClear: () => void;
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 text-[10px] text-muted-foreground border border-border rounded hover:border-primary/40 hover:text-foreground transition-all duration-150"
    >
      {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
      {copied ? t("qaOutput.copied") : t("qaOutput.copy")}
    </button>
  );
}

/** Render markdown-ish text as terminal-styled HTML blocks */
function TerminalText({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const lines = content.split("\n");
  let inCode = false;
  let codeLang = "";
  const codeLines: string[] = [];

  const blocks: React.ReactNode[] = [];
  let blockKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fence start/end
    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines.length = 0;
      } else {
        // end of code block
        inCode = false;
        blocks.push(
          <div key={blockKey++} className="my-2 rounded border border-border overflow-hidden">
            {codeLang && (
              <div className="px-3 py-1 bg-card/80 border-b border-border text-[9px] text-primary/60 tracking-widest font-mono">
                {codeLang.toUpperCase()}
              </div>
            )}
            <pre className="px-3 py-2 text-[11px] font-mono leading-relaxed text-foreground/80 overflow-x-auto bg-background/50">
              {codeLines.join("\n")}
            </pre>
          </div>
        );
        codeLang = "";
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Heading
    if (line.startsWith("### ")) {
      blocks.push(<p key={blockKey++} className="text-[11px] font-bold text-primary/80 tracking-wider mt-3 mb-1">{line.slice(4)}</p>);
    } else if (line.startsWith("## ")) {
      blocks.push(<p key={blockKey++} className="text-xs font-bold text-primary tracking-widest mt-4 mb-1">{line.slice(3)}</p>);
    } else if (line.startsWith("# ")) {
      blocks.push(<p key={blockKey++} className="text-xs font-bold text-primary tracking-widest mt-4 mb-1 border-b border-primary/20 pb-1">{line.slice(2)}</p>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      // Bullet
      blocks.push(
        <p key={blockKey++} className="text-[11px] text-foreground/75 leading-relaxed flex gap-2">
          <span className="text-primary/50 shrink-0 mt-0.5">▸</span>
          <span>{renderInline(line.slice(2))}</span>
        </p>
      );
    } else if (/^\d+\.\s/.test(line)) {
      // Numbered list
      const match = line.match(/^(\d+)\.\s(.*)/);
      if (match) {
        blocks.push(
          <p key={blockKey++} className="text-[11px] text-foreground/75 leading-relaxed flex gap-2">
            <span className="text-primary/50 shrink-0 font-mono text-[10px] mt-0.5">{match[1]}.</span>
            <span>{renderInline(match[2])}</span>
          </p>
        );
      }
    } else if (line.trim() === "") {
      blocks.push(<div key={blockKey++} className="h-2" />);
    } else {
      blocks.push(
        <p key={blockKey++} className="text-[11px] text-foreground/75 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }

  // If still inside code block when content ends (streaming)
  if (inCode && codeLines.length > 0) {
    blocks.push(
      <div key={blockKey++} className="my-2 rounded border border-border overflow-hidden">
        {codeLang && (
          <div className="px-3 py-1 bg-card/80 border-b border-border text-[9px] text-primary/60 tracking-widest font-mono">
            {codeLang.toUpperCase()}
          </div>
        )}
        <pre className="px-3 py-2 text-[11px] font-mono leading-relaxed text-foreground/80 overflow-x-auto bg-background/50">
          {codeLines.join("\n")}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {blocks}
      {isStreaming && (
        <span className="inline-block w-1.5 h-3 bg-primary animate-pulse rounded-sm ml-0.5 align-middle" />
      )}
    </div>
  );
}

/** Very lightweight inline markdown: bold, code */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    const raw = match[0];
    if (raw.startsWith("`")) {
      parts.push(
        <code key={key++} className="px-1 py-0.5 text-[10px] font-mono bg-primary/10 text-primary rounded">
          {raw.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(<strong key={key++} className="font-bold text-foreground/90">{raw.slice(2, -2)}</strong>);
    }
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts.length > 0 ? parts : text;
}

export function QAOutput({ messages, onClear }: QAOutputProps) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="animate-fade-in rounded border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/80">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold text-primary tracking-widest">
            {t("qaOutput.title")}
          </span>
          <span className="text-[9px] text-muted-foreground/50">
            — {Math.floor(messages.filter(m => m.role === "assistant").length)} {messages.filter(m => m.role === "assistant").length === 1 ? "reply" : "replies"}
          </span>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-muted-foreground border border-border rounded hover:border-destructive/40 hover:text-destructive transition-all duration-150"
        >
          <Trash2 className="w-3 h-3" />
          {t("qaOutput.clearChat")}
        </button>
      </div>

      {/* Messages */}
      <div className="divide-y divide-border/50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "px-4 py-3 group",
              msg.role === "user" ? "bg-primary/5" : "bg-background/30"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Role label */}
              <span
                className={cn(
                  "shrink-0 text-[9px] font-bold tracking-widest mt-0.5 pt-[1px] font-mono",
                  msg.role === "user" ? "text-primary/60" : "text-muted-foreground/50"
                )}
              >
                {msg.role === "user" ? t("qaOutput.you") : t("qaOutput.assistant")}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {msg.role === "user" ? (
                  <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                ) : msg.content === "" && msg.streaming ? (
                  <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </p>
                ) : (
                  <TerminalText content={msg.content} isStreaming={msg.streaming} />
                )}
              </div>

              {/* Copy button for assistant messages */}
              {msg.role === "assistant" && !msg.streaming && msg.content && (
                <CopyButton text={msg.content} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
