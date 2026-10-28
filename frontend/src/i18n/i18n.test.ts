import { describe, expect, it } from "vitest";

import { translationProblems } from "./check";
import { bestLanguage, languageName, LANGUAGES } from "./index";
import en from "./locales/en.json";

const files = import.meta.glob<{ default: Record<string, never> }>("./locales/*.json", {
  eager: true,
});

describe("translations", () => {
  it.each(Object.entries(files))("%s matches the English texts", (_, file) => {
    expect(translationProblems(en, file.default)).toEqual([]);
  });

  it("are checked for unknown keys and placeholders", () => {
    const english = { plants: { count_one: "{{count}} plant", count_other: "{{count}} plants" } };
    const translation = {
      plants: {
        count_one: "{{count}} roślina",
        count_few: "{{count}} rośliny",
        count_many: "{{count}} roślin",
        name: "{{nickname}}",
      },
      welcome: "Witaj {{name}}",
    };
    const english2 = { ...english, welcome: "Welcome {{person}}" };

    expect(translationProblems(english2, translation)).toEqual([
      "plants.name: not in English (a typo, or no longer used?)",
      "welcome: uses {{name}} instead of {{person}}",
    ]);
  });
});

describe("languages", () => {
  it("are English, and those with a translation file", () => {
    expect(LANGUAGES).toContain("en");
    expect(LANGUAGES).toEqual(
      Object.keys(files)
        .map((path) => path.slice(10, -5))
        .sort(),
    );
  });

  it("are shown by their own names", () => {
    expect(languageName("en")).toBe("English");
    expect(languageName("de")).toBe("Deutsch");
    expect(languageName("pt-BR")).toBe("Português (Brasil)");
  });

  it("match what people prefer as closely as possible", () => {
    const available = ["en", "nl", "pt-BR"];
    expect(bestLanguage(["nl-BE", "en"], available)).toBe("nl");
    expect(bestLanguage(["pt-br"], available)).toBe("pt-BR");
    expect(bestLanguage(["pt-PT"], available)).toBe("pt-BR");
    expect(bestLanguage(["fr", "en-GB"], available)).toBe("en");
    expect(bestLanguage(["fr"], available)).toBe("en");
  });
});
