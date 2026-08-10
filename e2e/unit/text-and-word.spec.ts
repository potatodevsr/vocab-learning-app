import { expect, test } from "@playwright/test";

import { hashString, normalizeAnswer, uniqueValues } from "../../lib/text";
import { getWordLabel, hasMeaning } from "../../lib/word";
import type { OxfordWord } from "../../lib/types";

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
