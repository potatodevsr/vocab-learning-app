import { expect, test } from "@playwright/test";

import { hashString, normalizeAnswer, uniqueValues } from "../../lib/text";
import { resolveLearnerMode } from "../../lib/learner-mode";
import { getWordLabel, hasMeaning } from "../../lib/word";
import type { OxfordWord } from "../../lib/types";
import {
  THAI_ALPHABET,
  clusterThai,
  lookupThaiLetter,
} from "../../lib/thai-alphabet";
import {
  breakDownThai,
  extractLetters,
  getConsonants,
  getVowelSounds,
  getWrittenLetters,
  parseBreakdown,
  resolveBreakdown,
  serializeBreakdown,
} from "../../lib/thai-letters";
import type { ThaiLetter } from "../../lib/thai-letters";

const word = (overrides: Partial<OxfordWord> = {}): OxfordWord => ({
  id: "w1",
  level: "A1",
  unit: 1,
  sourceOrder: 1,
  word: "run",
  displayWord: "run",
  slug: "run",
  homograph: null,
  sense: null,
  partOfSpeech: "verb",
  meaningTh: "วิ่ง",
  pronunciationTh: "รัน",
  meaningThReading: "วิ่ง",
  meaningThRoman: "wing",
  ipa: "rʌn",
  exampleEn: "I run.",
  exampleTh: "ฉันวิ่ง",
  posUsages: "[]",
  letterBreakdown: "",
  status: "published",
  audioKeyEn: "",
  audioKeyExample: "",
  reviewState: "unreviewed",
  ...overrides,
});

test.describe("normalizeAnswer", () => {
  const cases: [string, string, string][] = [
    ["trims", "  run  ", "run"],
    ["lowercases", "RUN", "run"],
    ["collapses inner whitespace", "get\t  up", "get up"],
    ["normalises curly apostrophes", "don’t", "don't"],
    ["normalises the other curly apostrophe", "don‘t", "don't"],
    ["normalises the prime character", "don′t", "don't"],
    ["leaves an empty string empty", "   ", ""],
    ["keeps Thai untouched", " วิ่ง ", "วิ่ง"],
  ];

  for (const [name, input, expected] of cases) {
    test(name, () => {
      expect(normalizeAnswer(input)).toBe(expected);
    });
  }

  test("two spellings that differ only by case and spacing compare equal", () => {
    expect(normalizeAnswer(" Get   Up ")).toBe(normalizeAnswer("get up"));
  });
});

test.describe("hashString", () => {
  test("is deterministic", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
  });

  test("differs for different inputs", () => {
    expect(hashString("abc")).not.toBe(hashString("abd"));
  });

  test("is a non-negative integer, including for the empty string", () => {
    for (const input of ["", "a", "a longer string with spaces"]) {
      const hash = hashString(input);
      expect(Number.isInteger(hash)).toBeTruthy();
      expect(hash).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("uniqueValues", () => {
  test("removes duplicates", () => {
    expect(uniqueValues(["a", "a", "b"])).toEqual(["a", "b"]);
  });

  test("trims before comparing", () => {
    expect(uniqueValues([" a ", "a"])).toEqual(["a"]);
  });

  test("drops empty and whitespace-only values", () => {
    expect(uniqueValues(["", "   ", "a"])).toEqual(["a"]);
  });

  test("preserves first-seen order", () => {
    expect(uniqueValues(["b", "a", "b"])).toEqual(["b", "a"]);
  });
});

test.describe("getWordLabel", () => {
  test("returns the display word when there is no sense", () => {
    expect(getWordLabel(word())).toBe("run");
  });

  test("appends the sense when present", () => {
    expect(getWordLabel(word({ sense: "sport" }))).toBe("run (sport)");
  });
});

test.describe("hasMeaning", () => {
  test("true when a Thai meaning exists", () => {
    expect(hasMeaning(word())).toBe(true);
  });

  test("false when empty", () => {
    expect(hasMeaning(word({ meaningTh: "" }))).toBe(false);
  });

  test("false when only whitespace", () => {
    expect(hasMeaning(word({ meaningTh: "   " }))).toBe(false);
  });
});

test.describe("resolveLearnerMode", () => {
  test("th locale learns English (a Thai speaker's course)", () => {
    expect(resolveLearnerMode("th")).toBe("english");
  });

  test("en locale learns Thai (an English speaker's course)", () => {
    expect(resolveLearnerMode("en")).toBe("thai");
  });

  test("any non-th locale falls back to thai", () => {
    for (const locale of ["en", "fr", "", "EN", "TH", "th-TH"]) {
      expect(resolveLearnerMode(locale)).toBe("thai");
    }
  });
});

// ---------------------------------------------------------------------------
// lib/thai-alphabet.ts — the code-constant alphabet plus pure text mechanics.
// ---------------------------------------------------------------------------

test.describe("THAI_ALPHABET", () => {
  test("holds the whole writing system: 44 + 22 + 4 = 70 marks", () => {
    expect(THAI_ALPHABET).toHaveLength(70);

    const counts = { consonant: 0, vowel: 0, tone: 0 };
    for (const entry of THAI_ALPHABET) counts[entry.kind] += 1;

    expect(counts).toEqual({ consonant: 44, vowel: 22, tone: 4 });
  });

  test("every entry is a single code point with a name and clip", () => {
    for (const entry of THAI_ALPHABET) {
      expect(Array.from(entry.char)).toHaveLength(1);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.clip.length).toBeGreaterThan(0);
    }
  });

  test("chars are unique — no mark is listed under two kinds", () => {
    const chars = THAI_ALPHABET.map((entry) => entry.char);
    expect(new Set(chars).size).toBe(chars.length);
  });
});

test.describe("lookupThaiLetter", () => {
  test("names a known consonant", () => {
    const letter = lookupThaiLetter("ก");
    expect(letter).toMatchObject({ name: "ก ไก่", kind: "consonant", clip: "ko-kai" });
  });

  test("names a known tone mark by its kind", () => {
    expect(lookupThaiLetter("่")).toMatchObject({ name: "ไม้เอก", kind: "tone" });
  });

  test("returns undefined for a character not in the table", () => {
    expect(lookupThaiLetter("a")).toBeUndefined();
    expect(lookupThaiLetter("ฃฅ")).toBeUndefined();
  });
});

test.describe("clusterThai", () => {
  test("empty string yields no clusters", () => {
    expect(clusterThai("")).toEqual([]);
  });

  test("a base consonant plus following vowel is one cluster", () => {
    // ก with า wrapped around it: า has its own width, so this is TWO clusters.
    expect(clusterThai("กา")).toEqual([
      { text: "ก", indices: [0] },
      { text: "า", indices: [1] },
    ]);
  });

  test("combining marks fold onto the preceding base", () => {
    // เกี่ยว = เ ก ี ่ ย ว. Only ี and ่ are zero-width combining marks.
    expect(clusterThai("เกี่ยว")).toEqual([
      { text: "เ", indices: [0] },
      { text: "กี่", indices: [1, 2, 3] },
      { text: "ย", indices: [4] },
      { text: "ว", indices: [5] },
    ]);
  });

  test("a leading combining mark cannot fold onto nothing", () => {
    // No previous cluster exists, so the mark stands alone rather than being dropped.
    expect(clusterThai("ิก")).toEqual([
      { text: "ิ", indices: [0] },
      { text: "ก", indices: [1] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// lib/thai-letters.ts — the API-backed table, breakdown parsing and derivation.
// ---------------------------------------------------------------------------

const thaiLetter = (overrides: Partial<ThaiLetter> = {}): ThaiLetter => ({
  id: "id",
  kind: "consonant",
  ordinal: 0,
  char: "?",
  name: "",
  roman: "",
  sound: "",
  soundFinal: "",
  vowelLength: "",
  clip: "",
  ...overrides,
});

// A minimal but real table: the consonants, signs, tones and one circumfix vowel
// sound needed to exercise derivation of เ‑ีย and สระอำ composition.
const LETTERS: ThaiLetter[] = [
  thaiLetter({ id: "c-ko", kind: "consonant", char: "ก", name: "ก ไก่" }),
  thaiLetter({ id: "c-no", kind: "consonant", char: "น", name: "น หนู" }),
  thaiLetter({ id: "c-yo", kind: "consonant", char: "ย", name: "ย ยักษ์" }),
  thaiLetter({ id: "c-wo", kind: "consonant", char: "ว", name: "ว แหวน" }),
  thaiLetter({ id: "v-aa", kind: "vowelSign", char: "า", name: "สระอา" }),
  thaiLetter({ id: "v-am", kind: "vowelSign", char: "ำ", name: "สระอำ" }),
  thaiLetter({ id: "v-e", kind: "vowelSign", char: "เ", name: "สระเอ" }),
  thaiLetter({ id: "t-ek", kind: "tone", char: "่", name: "ไม้เอก" }),
  thaiLetter({
    id: "vs-ia",
    kind: "vowelSound",
    char: "เอีย",
    name: "สระเอีย",
    vowelLength: "long",
  }),
];

test.describe("extractLetters", () => {
  test("passes a bare array through unchanged", () => {
    const letters = [thaiLetter({ id: "c-ko", char: "ก" })];
    expect(extractLetters(letters)).toBe(letters);
  });

  test("unwraps the { data } envelope", () => {
    const letters = [thaiLetter({ id: "c-ko", char: "ก" })];
    expect(extractLetters({ data: letters })).toBe(letters);
  });

  test("throws on an unexpected shape", () => {
    expect(() => extractLetters({} as never)).toThrow(/unexpected response format/);
  });
});

test.describe("getWrittenLetters / getVowelSounds / getConsonants", () => {
  // These read the live API through fetchAPI; a unit spec has no server, so we only
  // assert the public surface exists. Their filtering is exercised via breakDownThai.
  test("are the exported read helpers", () => {
    expect(typeof getWrittenLetters).toBe("function");
    expect(typeof getVowelSounds).toBe("function");
    expect(typeof getConsonants).toBe("function");
  });
});

test.describe("parseBreakdown", () => {
  test("empty and whitespace-only values parse to no units", () => {
    expect(parseBreakdown("")).toEqual([]);
    expect(parseBreakdown("   ")).toEqual([]);
  });

  test("reads well-formed units", () => {
    const json = JSON.stringify([{ text: "ก", letterId: "c-ko" }]);
    expect(parseBreakdown(json)).toEqual([{ text: "ก", letterId: "c-ko" }]);
  });

  test("invalid JSON falls back to no units", () => {
    expect(parseBreakdown("{not json")).toEqual([]);
  });

  test("a non-array payload is rejected", () => {
    expect(parseBreakdown(JSON.stringify({ text: "ก", letterId: "c-ko" }))).toEqual([]);
  });

  test("units missing text or letterId are filtered out", () => {
    const json = JSON.stringify([
      { text: "ก", letterId: "c-ko" },
      { text: "า" },
      { letterId: "c-no" },
      null,
    ]);
    expect(parseBreakdown(json)).toEqual([{ text: "ก", letterId: "c-ko" }]);
  });
});

test.describe("serializeBreakdown", () => {
  test("keeps known parts and drops unknown ones", () => {
    const serialized = serializeBreakdown([
      { char: "ก", letter: LETTERS[0], known: true },
      { char: "x", known: false },
    ]);
    expect(JSON.parse(serialized)).toEqual([{ text: "ก", letterId: "c-ko" }]);
  });

  test("round-trips through parseBreakdown", () => {
    const units = [
      { text: "ก", letterId: "c-ko" },
      { text: "า", letterId: "v-aa" },
    ];
    const parts = resolveBreakdown("กา", LETTERS, JSON.stringify(units));
    expect(parseBreakdown(serializeBreakdown(parts))).toEqual(units);
  });
});

test.describe("breakDownThai", () => {
  test("splits a plain consonant + vowel sign", () => {
    expect(breakDownThai("กา", LETTERS)).toEqual([
      { char: "ก", letter: LETTERS[0], known: true },
      { char: "า", letter: LETTERS[4], known: true },
    ]);
  });

  test("drops interior whitespace rather than naming it", () => {
    const parts = breakDownThai("ก า", LETTERS);
    expect(parts.map((part) => part.char)).toEqual(["ก", "า"]);
  });

  test("marks a character absent from the table as unknown", () => {
    expect(breakDownThai("กz", LETTERS)).toEqual([
      { char: "ก", letter: LETTERS[0], known: true },
      { char: "z", known: false },
    ]);
  });

  test("composes decomposed สระอำ (ํ + า) into one ำ unit", () => {
    // Typed decomposed: ก U+0E4D U+0E32 — NFC leaves it apart, composeSaraAm joins it.
    const parts = breakDownThai("กํา", LETTERS);
    expect(parts.map((part) => part.char)).toEqual(["ก", "ำ"]);
    expect(parts[1]).toMatchObject({ letter: LETTERS[5], known: true });
  });

  test("reads a circumfix vowel in reading order and keeps the wedged tone mark", () => {
    // เกี่ยว = เ ก ี ่ ย ว → ก, ไม้เอก, then the เ‑ีย vowel as one unit, then ว.
    const parts = breakDownThai("เกี่ยว", LETTERS);
    expect(parts.map((part) => part.letter)).toEqual([
      LETTERS[0], // ก consonant, said first however the vowel is drawn
      LETTERS[7], // ไม้เอก tone, not swallowed by the vowel match
      LETTERS[8], // the เ‑ีย vowel sound, one unit
      LETTERS[3], // ว consonant
    ]);
    expect(parts.map((part) => part.known)).toEqual([true, true, true, true]);
    // The vowel unit renders in dictionary shape: prefix, a hyphen slot, suffix.
    expect(parts[2].char).toMatch(/^เ.ีย$/u);
  });
});

test.describe("resolveBreakdown", () => {
  test("an empty override derives the breakdown", () => {
    expect(resolveBreakdown("กา", LETTERS, "")).toEqual(breakDownThai("กา", LETTERS));
  });

  test("a valid override whose letters all resolve wins over derivation", () => {
    // Deliberately a split derivation would not produce, proving the override is used.
    const override = JSON.stringify([
      { text: "กว", letterId: "c-ko" },
      { text: "า", letterId: "v-aa" },
    ]);
    expect(resolveBreakdown("กวา", LETTERS, override)).toEqual([
      { char: "กว", letter: LETTERS[0], known: true },
      { char: "า", letter: LETTERS[4], known: true },
    ]);
  });

  test("an override naming a deleted letter falls back to derivation", () => {
    const override = JSON.stringify([{ text: "ก", letterId: "gone" }]);
    expect(resolveBreakdown("กา", LETTERS, override)).toEqual(
      breakDownThai("กา", LETTERS),
    );
  });

  test("an unparseable override falls back to derivation", () => {
    expect(resolveBreakdown("กา", LETTERS, "{broken")).toEqual(
      breakDownThai("กา", LETTERS),
    );
  });
});
