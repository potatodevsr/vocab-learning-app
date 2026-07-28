import { expect, test } from "@playwright/test";

import { roundCount, SESSION_SIZE, sliceRound } from "../../lib/oxford-words";
import { MASTERY_MAX, masteryLevel } from "../../components/play/mastery-pips";

test.describe("session sizing", () => {
  test("a session is eight items", () => {
    expect(SESSION_SIZE).toBe(8);
  });

  const counts: [number, number][] = [
    [0, 1],
    [1, 1],
    [8, 1],
    [9, 2],
    [16, 2],
    [17, 3],
    [20, 3],
  ];

  for (const [total, expected] of counts) {
    test(`${total} words is ${expected} round(s)`, () => {
      expect(roundCount(total)).toBe(expected);
    });
  }
});

test.describe("sliceRound", () => {
  const words = Array.from({ length: 20 }, (_, index) => index + 1);

  test("round 1 is the first eight", () => {
    expect(sliceRound(words, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("round 2 is the next eight", () => {
    expect(sliceRound(words, 2)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  });

  test("the final round is the short remainder", () => {
    expect(sliceRound(words, 3)).toEqual([17, 18, 19, 20]);
  });

  test("rounds partition the unit with no gaps or repeats", () => {
    const rebuilt = [
      ...sliceRound(words, 1),
      ...sliceRound(words, 2),
      ...sliceRound(words, 3),
    ];

    expect(rebuilt).toEqual(words);
  });

  test("a round past the end clamps to the last one", () => {
    expect(sliceRound(words, 99)).toEqual([17, 18, 19, 20]);
  });

  test("round zero or negative clamps to the first", () => {
    expect(sliceRound(words, 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sliceRound(words, -3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("an empty unit yields an empty round", () => {
    expect(sliceRound([], 1)).toEqual([]);
  });

  test("a unit smaller than one session is a single round", () => {
    expect(sliceRound([1, 2, 3], 1)).toEqual([1, 2, 3]);
    expect(roundCount(3)).toBe(1);
  });
});

test.describe("masteryLevel", () => {
  const bands: [number, string][] = [
    [-2, "new"],
    [0, "new"],
    [1, "learning"],
    [2, "learning"],
    [3, "strong"],
    [4, "strong"],
    [5, "mastered"],
    [9, "mastered"],
  ];

  for (const [mastery, expected] of bands) {
    test(`mastery ${mastery} is "${expected}"`, () => {
      expect(masteryLevel(mastery)).toBe(expected);
    });
  }

  test("the ceiling matches the API's mastered threshold", () => {
    // The API side of this invariant is asserted behaviourally in
    // api/gamification.api.spec.ts ("mastery climbs ... and stops at five" and
    // "wordsMastered only counts words at the ceiling"). If they drift, the UI would
    // show five full pips for a word the API does not yet count as mastered.
    expect(MASTERY_MAX).toBe(5);
  });
});

test.describe("MasteryPips rendering", () => {
  test("clamps a negative mastery to empty", () => {
    expect(masteryLevel(-5)).toBe("new");
  });

  test("clamps an over-max mastery to mastered", () => {
    expect(masteryLevel(99)).toBe("mastered");
  });

  test("a non-integer mastery still lands in a band", () => {
    expect(masteryLevel(2.7)).toBe("learning");
    expect(masteryLevel(4.2)).toBe("strong");
  });
});
