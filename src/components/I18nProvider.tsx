"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { DATE_LOCALES, translate, type Language, type TranslationKey } from "@/lib/i18n";
import type { Locale } from "date-fns";

interface I18nContextValue {
  language: Language;
  dateLocale: Locale;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language;
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      dateLocale: DATE_LOCALES[language],
      setLanguage,
      t: (key, vars) => translate(language, key, vars),
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

