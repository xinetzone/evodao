import { X, Copy, Check, ExternalLink, Globe, AlertTriangle, CheckCircle, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface PlatformPanelProps {
  open: boolean;
  onClose: () => void;
}

// C: Static data from memory.md
// DESENSITIZATION_EXEMPTION: These are operational Agent World API keys for
// project-owned accounts, intentionally exposed via this internal operator panel
// so the user can copy them for use on allied sites. See AGENTS.md 2.3c.
const ACCOUNTS = [
  {
    username: "evodao_v2",
    apiKey: "agent-world-92706b8b6c45e7a4ced7f0bf14127c1d496cc3b3526f1922",
    status: "active" as const,
    note: "主账号",
  },
  {
    username: "evodao-link1",
    apiKey: "agent-world-cd2686305de084b88c4d5d80050fb00279b7a2f8307c9c11",
    status: "active" as const,
    note: "备用账号",
  },
  {
    username: "evodao-xp",
    apiKey: "agent-world-18d9eab205dd6b89c52b1fcb3de603e07f5cffe0b3e8a3ae",
    status: "active" as const,
    note: "xiaping 预备",
  },
  {
    username: "evodao-dx",
    apiKey: "agent-world-ebd81aa57c31ea2612f74787ed7223fc7ec54b3af5673bde",
    status: "active" as const,
    note: "DreamX 专用",
  },
];

const PLATFORMS = [
  {
    id: "agent-world",
    name: "Agent World",
    domain: "world.coze.com",
    status: "ok" as const,
    note: "evodao_v2 认证有效",
    agents: null,
    transactions: null,
  },
  {
    id: "dreamx",
    name: "DreamX",
    domain: "dreamx.coze.com",
    status: "blocked" as const,
    note: "401 — verify-key 307 问题",
    agents: 1737,
    transactions: 489,
  },
  {
    id: "xiaping",
    name: "虾评",
    domain: "xiaping.coze.com",
    status: "blocked" as const,
    note: "注册失败 — 后端 307 bug",
    agents: null,
    transactions: null,
  },
  {
    id: "abti",
    name: "ABTI",
    domain: "abti.coze.com",
    status: "blocked" as const,
    note: "401 — verify-key 307 问题",
    agents: null,
    transactions: null,
  },
];

const DREAMX_STATS = { dreams: 12309, agents: 1737, transactions: 489 };

function maskKey(key: string): string {
  if (key.length <= 24) return key;
  return `${key.slice(0, 20)}...${key.slice(-8)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={handle}
      className="p-1 text-muted-foreground hover:text-primary transition-colors"
      title="复制 API Key"
    >
      {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

const statusIcon = {
  ok: <CheckCircle className="w-3.5 h-3.5 text-primary" />,
  blocked: <XCircle className="w-3.5 h-3.5 text-destructive/70" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />,
};

const statusLabel = {
  ok: "OK",
  blocked: "BLOCKED",
  warning: "WARN",
};

const statusClass = {
  ok: "text-primary border-primary/30 bg-primary/5",
  blocked: "text-destructive/70 border-destructive/30 bg-destructive/5",
  warning: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
};

export function PlatformPanel({ open, onClose }: PlatformPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md flex flex-col bg-card border-l border-border shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/80">
          <div className="flex items-center gap-2.5">
            <Globe className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-xs font-bold tracking-[0.25em] text-primary">AGENT WORLD</h2>
              <p className="text-[10px] text-muted-foreground tracking-wider">Platform Status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ── Agent World Accounts ─────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] font-bold tracking-widest text-muted-foreground/60">ACCOUNTS</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <div className="space-y-2">
              {ACCOUNTS.map((acc) => (
                <div
                  key={acc.username}
                  className="rounded border border-border/60 bg-background/40 p-3 flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">
                      {acc.username[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground/80 font-mono">{acc.username}</span>
                      <span className="text-[9px] text-muted-foreground/50 tracking-wider">{acc.note}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 font-mono truncate mt-0.5">
                      {maskKey(acc.apiKey)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <CheckCircle className="w-3 h-3 text-primary/70" />
                    <CopyButton text={acc.apiKey} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Platform Status ───────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] font-bold tracking-widest text-muted-foreground/60">PLATFORMS</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <div className="rounded border border-border/60 overflow-hidden">
              {PLATFORMS.map((p, i) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5",
                    i > 0 && "border-t border-border/30"
                  )}
                >
                  <div className="w-28 shrink-0">
                    <p className="text-xs font-semibold text-foreground/70">{p.name}</p>
                    <p className="text-[9px] text-muted-foreground/40 font-mono truncate">{p.domain}</p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-widest shrink-0",
                    statusClass[p.status]
                  )}>
                    {statusIcon[p.status]}
                    {statusLabel[p.status]}
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 flex-1 min-w-0 truncate">
                    {p.note}
                  </p>
                  <a
                    href={`https://${p.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-muted-foreground/30 hover:text-primary transition-colors shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* ── DreamX Quick Stats ────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] font-bold tracking-widest text-muted-foreground/60">DREAMX STATS</span>
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-[9px] text-muted-foreground/30 font-mono">last sync</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Dreams", value: DREAMX_STATS.dreams.toLocaleString() },
                { label: "Agents", value: DREAMX_STATS.agents.toLocaleString() },
                { label: "Transactions", value: DREAMX_STATS.transactions.toLocaleString() },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded border border-border/40 bg-background/30 px-3 py-2.5 text-center"
                >
                  <p className="text-base font-bold text-primary font-mono">{stat.value}</p>
                  <p className="text-[9px] text-muted-foreground/50 tracking-wider mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Known Issue ───────────────────────────────────────── */}
          <section>
            <div className="rounded border border-yellow-400/20 bg-yellow-400/5 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-yellow-400 tracking-wider mb-1">KNOWN ISSUE</p>
                  <p className="text-[10px] text-foreground/60 leading-relaxed">
                    所有新注册账号在 member sites 均 401。根因：各站后端调用{" "}
                    <code className="font-mono text-yellow-400/70">world.coze.site</code> → 307 → POST body 丢失。
                    等待各站后端更新调用地址为{" "}
                    <code className="font-mono text-primary/70">world.coze.com</code>。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── evodao-dx DreamX key ────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] font-bold tracking-widest text-muted-foreground/60">DREAMX KEY (evodao-dx)</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <div className="rounded border border-border/60 bg-background/30 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground/50 font-mono truncate">
                    agent-world-ebd81aa57c31ea2612f74787...
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Zap className="w-2.5 h-2.5 text-primary/40" />
                    <span className="text-[9px] text-muted-foreground/40">
                      Challenge answer: 81 (seventy + one + ten)
                    </span>
                  </div>
                </div>
                <CopyButton text="agent-world-ebd81aa57c31ea2612f74787ed7223fc7ec54b3af5673bde" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
