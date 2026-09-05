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
    const allowed = new Set([
      "Lesson.homograph",
      // The product name, and two badges that are the product name plus a placeholder —
      // `Level.badge`'s {track} is what carries the translated words.
      "Nav.brand",
      "Level.badge",
      "Unit.badge",
      // Pure placeholder composition — the words a reader sees come from the data
      // (`{char}`, `{name}`, `{verb}`), so there is nothing in the string to translate.
      "AlphabetLetter.title",
      "PhrasalVerbs.verbTitle",
    ]);

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
    /**
     * The *argument names* a string consumes, not its literal `{token}` spellings.
     *
     * ICU picks one of several forms from an argument — `{active, plural, =0 {…} other
     * {# days}}` — and a locale is free to need a plural where the other does not: Thai
     * has no plural inflection, so `{active}` is the whole of its version. Matching
     * `\{[a-zA-Z]+\}` called that a mismatch and failed on a correct pair.
     */
    const placeholders = (value: string) =>
      [...new Set((value.match(/\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*[,}]/g) ?? []).map((token) =>
        token.replace(/[{},]/g, "").trim(),
      ))].sort();

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

/**
 * Every key the app asks for must exist, in both locales.
 *
 * Four page families once shipped to production with no namespace at all: the pages
 * rendered `Pronunciation.metaTitle` as their `<title>`, in both locales, and the suite
 * stayed green because nothing asserted that a key resolves. next-intl's fallback is the
 * key itself, which is why the failure is invisible to a smoke test — the page still
 * renders, it just renders the key.
 *
 * This reads the source rather than the rendered page on purpose: it names the missing
 * key and the file that wants it, and it runs without a server. `e2e/i18n-keys.spec.ts`
 * is the other half — it proves nothing key-shaped reaches the rendered DOM.
 */
const SOURCE_DIRS = ["app", "components"];

/**
 * Keys built from a template literal, which no regex over the source can enumerate.
 * Each entry is the prefix and the exhaustive set of values the code can substitute —
 * so a new `ThaiLetterKind` fails here rather than on the page.
 */
const DYNAMIC_KEYS: Array<{ prefix: string; values: string[]; source: string }> = [
  {
    prefix: "AlphabetLetter.kind.",
    values: ["consonant", "vowelSign", "tone", "vowelSound"],
    source: "lib/thai-letters.ts:ThaiLetterKind",
  },
  {
    prefix: "AlphabetLetter.about.",
    values: ["consonant", "vowelSign", "tone", "vowelSound"],
    source: "lib/thai-letters.ts:ThaiLetterKind",
  },
  {
    prefix: "Level.blurb",
    values: ["A1", "A2", "B1", "B2"],
    source: "lib/types.ts:CefrLevel",
  },
  {
    prefix: "Level.track",
    values: ["A1", "A2", "B1", "B2"],
    source: "lib/types.ts:CefrLevel",
  },
];

const readSources = async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const walk = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...(await walk(full)));
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }

    return files;
  };

  const files: Array<{ path: string; source: string }> = [];

  for (const dir of SOURCE_DIRS) {
    for (const path of await walk(dir)) {
      files.push({ path, source: await readFile(path, "utf8") });
    }
  }

  return files;
};

test.describe("translation keys the app actually asks for", () => {
  test("every literal key resolves in both locales", async () => {
    const files = await readSources();
    const missing: string[] = [];

    // `const t = useTranslations("Ns")` — bind the variable, so a file holding two
    // namespaces attributes each call to the right one.
    const bind =
      /(?:const|let)\s+([A-Za-z0-9_]+)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*(?:\{[^}]*namespace:\s*)?["']([A-Za-z0-9_]+)["']/g;

    for (const { path, source } of files) {
      // One file may bind the same name twice — `const t` for `Meta` inside
      // `generateMetadata`, then `const t` for the page's own namespace in the component.
      // Collect every namespace a name is bound to and accept the key under any of them;
      // the failure this guards against is a namespace that exists in no locale at all.
      const namespaces = new Map<string, string[]>();

      for (const match of source.matchAll(bind)) {
        namespaces.set(match[1], [...(namespaces.get(match[1]) ?? []), match[2]]);
      }

      for (const [variable, bound] of namespaces) {
        const call = new RegExp(`\\b${variable}\\(\\s*["']([A-Za-z0-9_.]+)["']`, "g");

        for (const match of source.matchAll(call)) {
          const candidates = bound.map((namespace) => `${namespace}.${match[1]}`);
          const shown = candidates.join(" | ");

          if (!candidates.some((key) => enKeys.includes(key))) {
            missing.push(`${path} → en.${shown}`);
          }

          if (!candidates.some((key) => thKeys.includes(key))) {
            missing.push(`${path} → th.${shown}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  test("every dynamic key family is complete in both locales", () => {
    const missing: string[] = [];

    for (const { prefix, values, source } of DYNAMIC_KEYS) {
      for (const value of values) {
        const key = `${prefix}${value}`;
        if (!enKeys.includes(key)) missing.push(`en.${key} (from ${source})`);
        if (!thKeys.includes(key)) missing.push(`th.${key} (from ${source})`);
      }
    }

    expect(missing).toEqual([]);
  });
});

/**
 * Copy may not promise content the page cannot show.
 *
 * The level hubs, the A–Z index, the letter pages and the unit pages all advertised
 * "ตัวอย่างประโยค" — example sentences — in their `<meta name="description">`, while 29 of
 * 3,082 published rows carry an `exampleEn`. The word page's own description was fixed for
 * exactly this reason and the fix never reached its siblings, so the highest-volume
 * families spent months teaching Google that the result disappoints.
 *
 * When examples exist at scale, delete the entry and restore the promise in the same
 * change — that is the point of listing them by name rather than banning a phrase.
 */
test.describe("copy promises only what the page delivers", () => {
  const PROMISE = /example sentence|ตัวอย่างประโยค/;

  /** Families whose pages are built from corpus rows that mostly have no example. */
  const CORPUS_FAMILIES = [
    "Home",
    "Level",
    "EnglishHub",
    "WordsIndex",
    "WordsLetter",
    "Unit",
    "Word",
    "Lesson",
    "Session",
  ];

  /** Strings that name an example truthfully: a conditional badge, a section heading
   *  rendered only when there is one, and the page that admits there are none. */
  const HONEST = new Set([
    "Unit.listenable",
    "Word.example",
    "Lesson.listenExample",
    "Trust.about.limitsBody",
  ]);

  test("no corpus family advertises example sentences", () => {
    const offenders: string[] = [];

    for (const [name, messages] of [
      ["en", en],
      ["th", th],
    ] as const) {
      for (const key of flatten(messages as Messages)) {
        if (HONEST.has(key)) continue;
        if (!CORPUS_FAMILIES.some((family) => key.startsWith(`${family}.`))) continue;
        if (PROMISE.test(String(valueAt(messages as Messages, key)))) {
          offenders.push(`${name}.${key}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

/**
 * Claims the implementation cannot currently back.
 *
 * Each entry here was live copy that the 2026-08-30 audit paired with the code
 * contradicting it (`todo.md`, "Immediate truth corrections"). Removing the string is a
 * mitigation, not a fix — the behavioural findings stay open — so this suite exists to
 * stop the sentence coming back before the behaviour does. Delete an entry only in the
 * same change that makes its claim true.
 */
test.describe("copy makes no claim the code cannot back", () => {
  const FORBIDDEN: { why: string; finding: string; patterns: RegExp[] }[] = [
    {
      why: "authorship of the Thai fields is unresolved: they were imported through an OCR-backed pipeline whose author, licence and permission are unrecorded",
      finding: "F-06",
      patterns: [/written by us/i, /เราเขียนเอง/],
    },
    {
      why: "no scheduled job deletes inactive accounts, and there is no self-service deletion",
      finding: "F-07",
      patterns: [/12 months/i, /months? of inactivity/i, /12 เดือน/],
    },
    {
      why: "a wrong choice never marks the correct option — the API sends no correct index for choice items",
      finding: "F-04",
      patterns: [/highlighted answer/i, /ไฮไลต์/],
    },
    {
      why: "production publishes no audio, so no session item can ask a learner to listen",
      finding: "F-05 / Stage 09",
      patterns: [/nothing but the sound/i, /บางข้อในบทเรียนจะให้ฟังเสียง/],
    },
  ];

  for (const { why, finding, patterns } of FORBIDDEN) {
    test(`${finding}: ${why}`, () => {
      const offenders: string[] = [];

      for (const [name, messages] of [
        ["en", en],
        ["th", th],
      ] as const) {
        for (const key of flatten(messages as Messages)) {
          const value = String(valueAt(messages as Messages, key));
          if (patterns.some((pattern) => pattern.test(value))) {
            offenders.push(`${name}.${key}`);
          }
        }
      }

      expect(offenders, `${finding}: ${why}`).toEqual([]);
    });
  }
});
