import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

export const resources = { en: { translation: en } } as const;

/** The app's other translations, loaded when someone uses them. See docs/translating.md. */
const translations = import.meta.glob<{ default: Record<string, unknown> }>([
  "./locales/*.json",
  "!./locales/en.json",
]);

const codeOf = (path: string) => path.replace(/^.*\/(.+)\.json$/, "$1");

/** The languages the app is translated into, by code (e.g. "en", "pt-BR"). */
export const LANGUAGES: readonly string[] = ["en", ...Object.keys(translations).map(codeOf)].sort();

/** A language's own name for itself, e.g. "Deutsch" for "de". */
export function languageName(code: string): string {
  const name = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}

/** The best of `wanted` (e.g. the browser's languages) the app is translated into. */
export function bestLanguage(wanted: readonly string[], available = LANGUAGES): string {
  for (const code of wanted) {
    const exact = available.find((each) => each.toLowerCase() === code.toLowerCase());
    if (exact) {
      return exact;
    }
    const base = code.split("-")[0]?.toLowerCase();
    const sameBase = available.find((each) => each.split("-")[0]?.toLowerCase() === base);
    if (sameBase) {
      return sameBase;
    }
  }
  return "en";
}

/** Switch the app to a language, loading its translation first. */
export async function setLanguage(code: string): Promise<void> {
  const language = bestLanguage([code]);
  const load = Object.entries(translations).find(([path]) => codeOf(path) === language)?.[1];
  if (load && !i18n.hasResourceBundle(language, "translation")) {
    i18n.addResourceBundle(language, "translation", (await load()).default);
  }
  await i18n.changeLanguage(language);
  document.documentElement.lang = language;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes output
});

// Until someone signs in (and their own choice applies), use the browser's language.
if (typeof navigator !== "undefined" && LANGUAGES.length > 1) {
  void setLanguage(bestLanguage(navigator.languages));
}

export default i18n;
