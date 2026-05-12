import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  const toggle = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("harness-lang", lang);
  };

  return (
    <div className="flex items-center gap-0.5 rounded border border-border bg-card p-0.5">
      {(["zh", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => toggle(lang)}
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-semibold tracking-widest transition-all duration-200",
            current === lang
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {lang === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}
