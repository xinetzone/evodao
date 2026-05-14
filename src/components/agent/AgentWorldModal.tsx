import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Copy, Check, ExternalLink, AlertCircle, X } from "lucide-react";
import { useAgentWorld } from "@/hooks/useAgentWorld";
import { Profile } from "@/hooks/useAuth";

interface AgentWorldModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  userId: string | undefined;
  onProfileUpdate: () => void;
}

function maskApiKey(key: string): string {
  if (key.length <= 20) return key;
  return `${key.slice(0, 16)}...${key.slice(-8)}`;
}

export function AgentWorldModal({
  open,
  onClose,
  profile,
  userId,
  onProfileUpdate,
}: AgentWorldModalProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isRegistered, agentProfile, worldProfile, step, error, register, fetchWorldProfile, resetError } =
    useAgentWorld({ profile, userId, onProfileUpdate });

  const isLoading = step === "registering" || step === "solving" || step === "verifying" || step === "saving";
  const isError = step === "error";

  // Auto-fill username from email
  useEffect(() => {
    if (!isRegistered && profile?.email && !username) {
      const suggested = profile.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 30);
      setUsername(suggested);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.email, isRegistered]);

  // Load world profile when opening registered view
  useEffect(() => {
    if (open && isRegistered) {
      fetchWorldProfile();
    }
  }, [open, isRegistered, fetchWorldProfile]);

  // Focus input when opening
  useEffect(() => {
    if (open && !isRegistered && step === "idle") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, isRegistered, step]);

  if (!open) return null;

  const handleRegister = async () => {
    if (!username.trim()) return;
    await register(username.trim(), nickname.trim() || username.trim(), bio.trim());
  };

  const handleCopy = () => {
    if (agentProfile?.apiKey) {
      navigator.clipboard.writeText(agentProfile.apiKey).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      resetError();
      onClose();
    }
  };

  const avatarUrl = worldProfile?.avatarUrl ?? agentProfile?.avatarUrl ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded border border-border bg-card shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded border border-primary/40 flex items-center justify-center bg-primary/5 terminal-glow">
              <Globe className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-[0.2em] text-primary">{t("agentWorld.title")}</h2>
              <p className="text-[10px] text-muted-foreground tracking-wider">{t("agentWorld.subtitle")}</p>
            </div>
          </div>
          {!isLoading && (
            <button
              onClick={handleClose}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* ── REGISTERED / DONE VIEW ───────────────────────────────────── */}
          {isRegistered && agentProfile && (
            <div className="space-y-4">
              {/* Avatar + Identity */}
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={agentProfile.username}
                    className="w-12 h-12 rounded-full border border-border object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-primary/60" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-foreground/90 tracking-wide">
                    {worldProfile?.nickname || agentProfile.username}
                  </p>
                  <p className="text-[11px] text-primary font-mono">@{agentProfile.username}</p>
                  {worldProfile?.bio && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[240px] line-clamp-2">{worldProfile.bio}</p>
                  )}
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground tracking-widest font-bold">
                  {t("agentWorld.registered.apiKey")}
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-muted/20">
                  <code className="flex-1 text-[11px] text-primary font-mono tracking-wider truncate">
                    {maskApiKey(agentProfile.apiKey)}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                    title={t("agentWorld.registered.copyKey")}
                  >
                    {copied ? (
                      <><Check className="w-3.5 h-3.5 text-primary" /><span className="text-primary">{t("agentWorld.registered.copied")}</span></>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /><span>{t("agentWorld.registered.copyKey")}</span></>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/60">{t("agentWorld.registered.apiKeyHint")}</p>
              </div>

              {/* View profile link */}
              <a
                href={`https://world.coze.site/api/agents/profile/${agentProfile.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded border border-border/60 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-all duration-200"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t("agentWorld.registered.viewProfile")}
              </a>
            </div>
          )}

          {/* ── LOADING STATE ────────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border border-primary/40 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="absolute inset-0 animate-spin" style={{ animationDuration: "3s" }}>
                  <div className="w-2 h-2 rounded-full bg-primary/60 absolute -top-1 left-1/2 -translate-x-1/2" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-primary tracking-wider">
                  {t(`agentWorld.steps.${step}`)}
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                  {t("agentWorld.steps.solving")}
                </p>
              </div>
            </div>
          )}

          {/* ── REGISTRATION FORM ───────────────────────────────────────── */}
          {!isRegistered && !isLoading && (
            <div className="space-y-3">
              {isError && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded border border-destructive/30 bg-destructive/10">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs text-destructive">{error}</p>
                    <button
                      onClick={resetError}
                      className="text-[10px] text-muted-foreground hover:text-primary underline underline-offset-2"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed">{t("agentWorld.notRegistered.desc")}</p>

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground tracking-widest font-bold">
                  {t("agentWorld.notRegistered.usernameLabel")}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder={t("agentWorld.notRegistered.usernamePlaceholder")}
                  maxLength={50}
                  className="w-full px-3 py-2 rounded border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors font-mono"
                />
                <p className="text-[10px] text-muted-foreground/60">{t("agentWorld.notRegistered.usernameHint")}</p>
              </div>

              {/* Nickname */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground tracking-widest font-bold">
                  {t("agentWorld.notRegistered.nicknameLabel")}
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t("agentWorld.notRegistered.nicknamePlaceholder")}
                  maxLength={100}
                  className="w-full px-3 py-2 rounded border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground tracking-widest font-bold">
                  {t("agentWorld.notRegistered.bioLabel")}
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t("agentWorld.notRegistered.bioPlaceholder")}
                  maxLength={500}
                  rows={2}
                  className="w-full px-3 py-2 rounded border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors resize-none"
                />
              </div>

              <button
                onClick={handleRegister}
                disabled={!username.trim() || username.length < 2}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded border border-primary bg-primary/10 text-xs font-bold tracking-widest text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                <Globe className="w-3.5 h-3.5" />
                {t("agentWorld.notRegistered.submitBtn")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


interface AgentWorldModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  userId: string | undefined;
  onProfileUpdate: () => void;
}

function maskApiKey(key: string): string {
  if (key.length <= 20) return key;
  return `${key.slice(0, 16)}...${key.slice(-8)}`;
}

const STEP_ORDER: RegistrationStep[] = ["registering", "solving", "verifying", "saving"];

export function AgentWorldModal({
  open,
  onClose,
  profile,
  userId,
  onProfileUpdate,
}: AgentWorldModalProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isRegistered, agentProfile, worldProfile, step, error, register, fetchWorldProfile, resetError } =
    useAgentWorld({ profile, userId, onProfileUpdate });

  // Auto-fill username from email
  useEffect(() => {
    if (!isRegistered && profile?.email && !username) {
      const suggested = profile.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 30);
      setUsername(suggested);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.email, isRegistered]);

  // Load world profile when opening registered view
  useEffect(() => {
    if (open && isRegistered) {
      fetchWorldProfile();
    }
  }, [open, isRegistered, fetchWorldProfile]);

  // Focus input when opening
  useEffect(() => {
    if (open && !isRegistered && step === "idle") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, isRegistered, step]);

  if (!open) return null;

  const isLoading = STEP_ORDER.includes(step as RegistrationStep);
  const isDone = step === "done";
  const isError = step === "error";

  const handleRegister = async () => {
    if (!username.trim()) return;
    await register(username.trim(), nickname.trim() || username.trim(), bio.trim());
  };

  const handleCopy = () => {
    if (agentProfile?.apiKey) {
      navigator.clipboard.writeText(agentProfile.apiKey).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      resetError();
      onClose();
    }
  };

  const currentStepIndex = STEP_ORDER.indexOf(step as RegistrationStep);
  const avatarUrl = worldProfile?.avatarUrl ?? agentProfile?.avatarUrl ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded border border-border bg-card shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded border border-primary/40 flex items-center justify-center bg-primary/5 terminal-glow">
              <Globe className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-[0.2em] text-primary">{t("agentWorld.title")}</h2>
              <p className="text-[10px] text-muted-foreground tracking-wider">{t("agentWorld.subtitle")}</p>
            </div>
          </div>
          {!isLoading && (
            <button
              onClick={handleClose}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* ── REGISTERED VIEW ─────────────────────────────────────────── */}
          {(isRegistered || isDone) && agentProfile && (
            <div className="space-y-4">
              {/* Avatar + Identity */}
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={agentProfile.username}
                    className="w-12 h-12 rounded-full border border-border object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-primary/60" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-foreground/90 tracking-wide">
                    {worldProfile?.nickname || agentProfile.username}
                  </p>
                  <p className="text-[11px] text-primary font-mono">@{agentProfile.username}</p>
                  {worldProfile?.bio && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[240px] line-clamp-2">{worldProfile.bio}</p>
                  )}
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground tracking-widest font-bold">
                  {t("agentWorld.registered.apiKey")}
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-muted/20">
                  <code className="flex-1 text-[11px] text-primary font-mono tracking-wider truncate">
                    {maskApiKey(agentProfile.apiKey)}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                    title={t("agentWorld.registered.copyKey")}
                  >
                    {copied ? (
                      <><Check className="w-3.5 h-3.5 text-primary" /><span className="text-primary">{t("agentWorld.registered.copied")}</span></>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /><span>{t("agentWorld.registered.copyKey")}</span></>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/60">{t("agentWorld.registered.apiKeyHint")}</p>
              </div>

              {/* View profile link */}
              <a
                href={`https://world.coze.site/api/agents/profile/${agentProfile.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded border border-border/60 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-all duration-200"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t("agentWorld.registered.viewProfile")}
              </a>
            </div>
          )}

          {/* ── REGISTRATION FORM ───────────────────────────────────────── */}
          {!isRegistered && !isDone && (
            <>
              {/* Loading / progress steps */}
              {(isLoading || isError) && (
                <div className="space-y-2 py-1">
                  {STEP_ORDER.map((s, i) => {
                    const isCurrent = s === step;
                    const isPast = currentStepIndex > i;
                    const isFuture = currentStepIndex < i;
                    return (
                      <div key={s} className={cn("flex items-center gap-2.5 text-xs transition-all duration-300", isFuture && "opacity-30")}>
                        {isPast ? (
                          <CircleCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                        ) : isCurrent ? (
                          <Loader className="w-3.5 h-3.5 text-yellow-400 shrink-0 animate-spin" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                        )}
                        <span className={cn(
                          "tracking-wide",
                          isCurrent ? "text-yellow-400 font-semibold" : isPast ? "text-primary" : "text-muted-foreground"
                        )}>
                          {t(`agentWorld.steps.${s}`)}
                        </span>
                      </div>
                    );
                  })}

                  {isError && (
                    <div className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded border border-destructive/30 bg-destructive/10">
                      <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs text-destructive">{error}</p>
                        <button
                          onClick={resetError}
                          className="text-[10px] text-muted-foreground hover:text-primary underline underline-offset-2"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form — only shown when idle or error */}
              {(step === "idle" || step === "error") && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("agentWorld.notRegistered.desc")}</p>

                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground tracking-widest font-bold">
                      {t("agentWorld.notRegistered.usernameLabel")}
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      placeholder={t("agentWorld.notRegistered.usernamePlaceholder")}
                      maxLength={50}
                      className="w-full px-3 py-2 rounded border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground/60">{t("agentWorld.notRegistered.usernameHint")}</p>
                  </div>

                  {/* Nickname */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground tracking-widest font-bold">
                      {t("agentWorld.notRegistered.nicknameLabel")}
                    </label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder={t("agentWorld.notRegistered.nicknamePlaceholder")}
                      maxLength={100}
                      className="w-full px-3 py-2 rounded border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors"
                    />
                  </div>

                  {/* Bio */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground tracking-widest font-bold">
                      {t("agentWorld.notRegistered.bioLabel")}
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder={t("agentWorld.notRegistered.bioPlaceholder")}
                      maxLength={500}
                      rows={2}
                      className="w-full px-3 py-2 rounded border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors resize-none"
                    />
                  </div>

                  <button
                    onClick={handleRegister}
                    disabled={!username.trim() || username.length < 2}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded border border-primary bg-primary/10 text-xs font-bold tracking-widest text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {t("agentWorld.notRegistered.submitBtn")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
