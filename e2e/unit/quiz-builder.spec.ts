import { expect, test } from "@playwright/test";

import { buildQuestions, filterReadyWords } from "../../lib/quiz";
import { normalizeAnswer } from "../../lib/text";
import type { OxfordWord } from "../../lib/types";

/** Stands in for next-intl: returns the key plus its interpolated values. */
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${Object.values(values).join("|")}` : key;

const makeWord = (index: number, overrides: Partial<OxfordWord> = {}): OxfordWord => ({
  id: `w${index}`,
  level: "A1",
  unit: 1,
  sourceOrder: index,
  word: `word${index}`,
  displayWord: `word${index}`,
  slug: `word${index}`,
  homograph: null,
  sense: null,
  partOfSpeech: "noun",
  meaningTh: `ความหมาย${index}`,
  pronunciationTh: `คำอ่าน${index}`,
  meaningThReading: `ความ-หมาย-${index}`,
  meaningThRoman: `khwam-mai-${index}`,
  ipa: "",
  exampleEn: "",
  exampleTh: "",
  posUsages: "[]",
  letterBreakdown: "",
  status: "published",
  audioKeyEn: "",
  audioKeyExample: "",
  reviewState: "unreviewed",
  ...overrides,
});

const words = (count: number) =>
  Array.from({ length: count }, (_, index) => makeWord(index + 1));

test.describe("filterReadyWords", () => {
  test("keeps only words with a Thai meaning", () => {
    const input = [makeWord(1), makeWord(2, { meaningTh: "" }), makeWord(3)];

    expect(filterReadyWords(input).map((w) => w.id)).toEqual(["w1", "w3"]);
  });

  test("returns an empty list when nothing is ready", () => {
    expect(filterReadyWords([makeWord(1, { meaningTh: "  " })])).toEqual([]);
  });
});

test.describe("buildQuestions", () => {
  test("produces nothing when no word has a meaning", () => {
    expect(buildQuestions([makeWord(1, { meaningTh: "" })], t)).toEqual([]);
  });

  test("produces nothing for an empty unit", () => {
    expect(buildQuestions([], t)).toEqual([]);
  });

  test("builds the full ten-question plan when there is enough material", () => {
    expect(buildQuestions(words(10), t)).toHaveLength(10);
  });

  test("covers all three question types", () => {
    const types = new Set(buildQuestions(words(10), t).map((q) => q.type));

    expect(types).toEqual(
      new Set(["meaning-choice", "reverse-choice", "spelling"]),
    );
  });

  test("every choice question includes its own correct answer", () => {
    for (const question of buildQuestions(words(10), t)) {
      if (question.type === "spelling") continue;

      const normalised = question.options.map(normalizeAnswer);
      expect(normalised).toContain(normalizeAnswer(question.correctAnswer));
    }
  });

  test("choice questions never repeat an option", () => {
    for (const question of buildQuestions(words(10), t)) {
      if (question.type === "spelling") continue;

      expect(new Set(question.options).size).toBe(question.options.length);
    }
  });

  test("choice questions offer at least two options", () => {
    for (const question of buildQuestions(words(10), t)) {
      if (question.type === "spelling") continue;

      expect(question.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("spelling answers are the display word and carry no options", () => {
    const spelling = buildQuestions(words(10), t).filter(
      (q) => q.type === "spelling",
    );

    expect(spelling.length).toBeGreaterThan(0);

    for (const question of spelling) {
      expect(question.correctAnswer).toBe(question.word.displayWord);
      expect(question.options).toEqual([]);
    }
  });

  test("a single ready word cannot make a choice question", () => {
    // One word means no distractor, so only spelling survives.
    const built = buildQuestions([makeWord(1)], t);

    expect(built.every((q) => q.type === "spelling")).toBeTruthy();
  });

  test("words sharing one meaning do not produce an unanswerable question", () => {
    // Two entries of the same word (different senses) share a meaning — the distractor
    // pool must not offer the correct answer twice or drop below two options.
    const duplicated = [
      makeWord(1, { meaningTh: "เกี่ยวกับ" }),
      makeWord(2, { meaningTh: "เกี่ยวกับ" }),
      makeWord(3),
      makeWord(4),
    ];

    for (const question of buildQuestions(duplicated, t)) {
      if (question.type === "spelling") continue;

      expect(new Set(question.options).size).toBe(question.options.length);
      expect(question.options.map(normalizeAnswer)).toContain(
        normalizeAnswer(question.correctAnswer),
      );
    }
  });

  test("is deterministic for the same input", () => {
    const first = buildQuestions(words(10), t);
    const second = buildQuestions(words(10), t);

    expect(second.map((q) => `${q.id}:${q.options.join(",")}`)).toEqual(
      first.map((q) => `${q.id}:${q.options.join(",")}`),
    );
  });

  test("uses the pronunciation helper only when a pronunciation exists", () => {
    const withPron = buildQuestions(words(4), t).find(
      (q) => q.type === "reverse-choice",
    );
    const withoutPron = buildQuestions(
      words(4).map((w) => ({ ...w, pronunciationTh: "" })),
      t,
    ).find((q) => q.type === "reverse-choice");

    expect(withPron?.helper).toContain("helperReverseChoiceWithPron");
    expect(withoutPron?.helper).toBe("helperReverseChoice");
  });
});
