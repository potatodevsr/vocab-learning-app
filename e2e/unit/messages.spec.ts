import { expect, test } from "@playwright/test";

import en from "../../messages/en.json";
import th from "../../messages/th.json";
import { routing } from "../../i18n/routing";

/**
 * A malformed `messages/th.json` once threw at request time for every Thai page while the
 * build stayed green, and its `Auth` block shipped as untranslated English. Both are
 * cheap to pin here.
 */
type Messages = Record<string, unknown>;

const flatten = (value: Messages, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === "object"
      ? flatten(child as Messages, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

const valueAt = (value: Messages, path: string) =>
  path.split(".").reduce<unknown>((acc, key) => (acc as Messages)?.[key], value);

const enKeys = flatten(en as Messages);
const thKeys = flatten(th as Messages);

test.describe("translation files", () => {
  test("both locales are valid JSON with content", () => {
    expect(enKeys.length).toBeGreaterThan(50);
    expect(thKeys.length).toBeGreaterThan(50);
  });

  test("every English key exists in Thai", () => {
    expect(enKeys.filter((key) => !thKeys.includes(key))).toEqual([]);
  });

  test("every Thai key exists in English", () => {
    expect(thKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  test("no value is an empty string", () => {
    for (const [name, messages] of [
      ["en", en],
      ["th", th],
    ] as const) {
      for (const key of flatten(messages as Messages)) {
        expect(
          String(valueAt(messages as Messages, key)).trim(),
          `${name}.${key} is empty`,
        ).not.toBe("");
      }
    }
  });

  test("Thai copy is actually Thai, not copied English", () => {
    // Keys whose value is legitimately identical across locales (proper nouns, symbols).
    const allowed = new Set(["Lesson.homograph"]);

    const untranslated = thKeys.filter((key) => {
      if (allowed.has(key)) return false;

      const thValue = String(valueAt(th as Messages, key));
      const enValue = String(valueAt(en as Messages, key));

      if (thValue !== enValue) return false;

      // Identical is fine when there is no letter to translate (e.g. "{level} · {unit}").
      return /[a-z]{3,}/i.test(enValue);
    });

    expect(untranslated).toEqual([]);
  });

  test("interpolation placeholders match between locales", () => {
    const placeholders = (value: string) =>
      (value.match(/\{[a-zA-Z]+\}/g) ?? []).sort();

    for (const key of enKeys) {
      expect(
        placeholders(String(valueAt(th as Messages, key))),
        `placeholders differ for ${key}`,
      ).toEqual(placeholders(String(valueAt(en as Messages, key))));
    }
  });
});

test.describe("i18n routing", () => {
  test("serves exactly the locales the app has files for", () => {
    expect([...routing.locales].sort()).toEqual(["en", "th"]);
  });

  test("has a default locale that is one of them", () => {
    expect(routing.locales).toContain(routing.defaultLocale);
  });
});
