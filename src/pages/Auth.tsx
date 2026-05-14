import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Cpu, Eye, EyeOff, Loader, AlertCircle, CircleCheck } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

type Tab = "login" | "register";

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isLoading, signIn, signUp } = useAuthContext();

  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) navigate("/", { replace: true });
  }, [user, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (tab === "register" && password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      if (tab === "login") {
        const err = await signIn(email, password);
        if (err) {
          setError(t("auth.loginError"));
        }
        // navigation handled by useEffect above
      } else {
        const { data, error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message || t("auth.loginError"));
        } else if (data?.session) {
          // auto_confirm_email is on — user is already signed in, navigate directly
          navigate("/", { replace: true });
        } else {
          // email confirmation required
          setSuccess(t("auth.registerSuccess"));
          setTab("login");
          setPassword("");
          setConfirmPassword("");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      />

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded border border-primary/60 flex items-center justify-center terminal-glow">
              <Cpu className="w-6 h-6 text-primary" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold tracking-[0.3em] text-primary text-glow">
              {t("header.title")}
            </h1>
            <p className="text-[10px] tracking-widest text-muted-foreground mt-0.5">
              {t("header.subtitle")}
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="relative rounded border border-border bg-card">
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-primary/40 rounded-tl" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary/40 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-primary/40 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-primary/40 rounded-br" />

          {/* Tab switcher */}
          <div className="flex border-b border-border">
            {(["login", "register"] as Tab[]).map((t2) => (
              <button
                key={t2}
                onClick={() => { setTab(t2); setError(null); setSuccess(null); }}
                className={cn(
                  "flex-1 py-3 text-xs font-bold tracking-widest transition-all duration-200",
                  tab === t2
                    ? "text-primary border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t2 === "login" ? t("auth.login") : t("auth.register")}
              </button>
            ))}
          </div>

          <div className="p-6">
            <div className="mb-5">
              <p className="text-sm font-bold tracking-wider text-foreground">
                {tab === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 tracking-wider">
                {tab === "login" ? t("auth.loginSubtitle") : t("auth.registerSubtitle")}
              </p>
            </div>

            {/* Success message */}
            {success && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded border border-primary/30 bg-primary/5 text-xs text-primary">
                <CircleCheck className="w-3.5 h-3.5 shrink-0" />
                {success}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 mb-4 rounded border border-destructive/40 bg-destructive/8 text-xs text-destructive animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[10px] text-muted-foreground tracking-widest mb-1.5">
                  {t("auth.email")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50 text-xs">$</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                    className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] text-muted-foreground tracking-widest mb-1.5">
                  {t("auth.password")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50 text-xs">$</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="w-full pl-7 pr-10 py-2.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm password (register only) */}
              {tab === "register" && (
                <div>
                  <label className="block text-[10px] text-muted-foreground tracking-widest mb-1.5">
                    {t("auth.confirmPassword")}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50 text-xs">$</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold tracking-widest rounded border transition-all duration-200 mt-2",
                  submitting
                    ? "border-primary/30 text-primary/40 cursor-not-allowed"
                    : "text-primary-foreground bg-primary border-primary hover:bg-primary/90 terminal-glow"
                )}
              >
                {submitting ? (
                  <><Loader className="w-3.5 h-3.5 animate-spin" />{t("auth.processing")}</>
                ) : (
                  tab === "login" ? t("auth.loginBtn") : t("auth.registerBtn")
                )}
              </button>
            </form>

            {/* Tab switch hint */}
            <p className="text-center text-[10px] text-muted-foreground/50 mt-5">
              {tab === "login" ? t("auth.noAccount") : t("auth.hasAccount")}
              {" "}
              <button
                onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(null); }}
                className="text-primary/70 hover:text-primary underline transition-colors"
              >
                {tab === "login" ? t("auth.register") : t("auth.login")}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
