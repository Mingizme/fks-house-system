"use client";

import { useRouter } from "next/navigation";
import {
  LANGUAGE_COOKIE,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type Language,
} from "@/lib/i18n";
import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();

  function changeLanguage(next: Language) {
    setLanguage(next);
    document.documentElement.lang = next;
    document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.localStorage.setItem(LANGUAGE_COOKIE, next);
    router.refresh();
  }

  return (
    <label className={`block ${className}`}>
      <span className="sr-only">{t("common.language")}</span>
      <select
        value={language}
        onChange={(event) => changeLanguage(event.target.value as Language)}
        aria-label={t("common.language")}
        className="w-full rounded-lg border border-ink-border bg-ink-surface2 px-3 py-2 text-xs font-mono text-ink-muted outline-none transition-colors hover:text-ink-text focus:border-command"
      >
        {SUPPORTED_LANGUAGES.map((item) => (
          <option key={item} value={item}>
            {LANGUAGE_LABELS[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
