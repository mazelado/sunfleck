/**
 * Checking a translation file against the English one (see docs/translating.md). Keys may be
 * missing, since English is shown instead, but there must be no others (usually a typo or a
 * leftover), and each text must use the same {{placeholders}}.
 */

type Messages = { [key: string]: string | Messages };

// i18next's plural forms: languages use different ones (e.g. "_few" in Polish).
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const flat = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      flat.set(path, value);
    } else {
      for (const [inner, text] of flatten(value, path)) {
        flat.set(inner, text);
      }
    }
  }
  return flat;
}

function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)[^}]*\}\}/g)].map((match) => match[1] ?? ""))]
    .filter((name) => name !== "count")
    .sort();
}

/** The problems with a translation, compared with English; none if it's fine. */
export function translationProblems(english: Messages, translation: Messages): string[] {
  const base = (key: string) => key.replace(PLURAL, "");
  const englishTexts = new Map<string, string[]>();
  for (const [key, text] of flatten(english)) {
    englishTexts.set(base(key), placeholders(text));
  }
  const problems: string[] = [];
  for (const [key, text] of flatten(translation)) {
    const expected = englishTexts.get(base(key));
    if (!expected) {
      problems.push(`${key}: not in English (a typo, or no longer used?)`);
      continue;
    }
    const found = placeholders(text);
    if (found.join() !== expected.join()) {
      problems.push(
        `${key}: uses {{${found.join("}}, {{")}}} instead of {{${expected.join("}}, {{")}}}`,
      );
    }
  }
  return problems;
}
