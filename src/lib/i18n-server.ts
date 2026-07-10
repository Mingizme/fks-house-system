import { cookies } from "next/headers";
import { DEFAULT_LANGUAGE, DATE_LOCALES, LANGUAGE_COOKIE, isLanguage, translate, type TranslationKey } from "@/lib/i18n";

export function getServerLanguage() {
  const value = cookies().get(LANGUAGE_COOKIE)?.value;
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function getServerTranslator() {
  const language = getServerLanguage();

  return {
    language,
    dateLocale: DATE_LOCALES[language],
    t: (key: TranslationKey, vars?: Record<string, string | number>) => translate(language, key, vars),
  };
}
