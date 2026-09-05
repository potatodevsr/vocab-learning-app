import { expect, test } from "@playwright/test";

import { createLessonUnits } from "../../lib/level-units";
import type { OxfordWord } from "../../lib/types";

/**
 * The level hub's unit cards, and the one case the full-stack suite structurally cannot
 * reach: a unit the preview covers only *partly*.
 *
 * The level page shows a badge with the unit's real word count and, underneath it, a
 * `first → last` range built from the preview read. Those two came from different sources
 * and nothing made them agree. In production a 758-row level is previewed 100 rows at a
 * time, so most units are covered partly or not at all, and a card could read
 * "20 words" over "word81 → word84" — a range that describes four rows of a twenty-row
 * unit and is simply false. The other branch printed a hardcoded English `"20 words"`,
 * which was both untranslated (AGENTS.md rule 3) and a verbatim repeat of the badge above
 * it.
 *
 * The e2e corpus is 49 published rows against a preview `take` of 100, so every unit is
 * always fully previewed there and no browser test can produce the partial case. Hence a
 * pure function and a unit test.
 */
const word = (unit: number, order: number, displayWord: string): OxfordWord =>
  ({
    id: `w-${order}`,
    level: "A1",
    unit,
    sourceOrder: order,
    word: displayWord,
    displayWord,
    slug: displayWord,
  }) as OxfordWord;

test.describe("createLessonUnits", () => {
  test("shows a range only when the preview holds the whole unit", () => {
    const [complete, partial, missing] = createLessonUnits(
      "A1",
      [
        { unit: 1, words: 2 },
        { unit: 2, words: 20 },
        { unit: 3, words: 7 },
      ],
      [
        word(1, 1, "word1"),
        word(1, 2, "word2"),
        // Four of unit 2's twenty. The old code called this "word3 → word6".
        word(2, 3, "word3"),
        word(2, 4, "word4"),
        word(2, 5, "word5"),
        word(2, 6, "word6"),
      ],
    );

    expect(complete.wordRange).toBe("word1 → word2");
    expect(partial.wordRange, "a partial preview is not a range").toBeNull();
    expect(missing.wordRange, "no preview is not a range either").toBeNull();
  });

  test("the word count is the inventory's, never the preview's", () => {
    const units = createLessonUnits(
      "A1",
      [
        { unit: 1, words: 20 },
        { unit: 2, words: 3 },
      ],
      [word(1, 1, "word1"), word(1, 2, "word2")],
    );

    // Unit 1 is previewed two rows deep and still reports twenty …
    expect(units[0].wordCount).toBe(20);
    expect(units[0].words).toHaveLength(2);
    // … and unit 2 reports the three it really holds, not the `UNIT_SIZE` fallback the
    // badge used to print when a unit had no preview at all.
    expect(units[1].wordCount).toBe(3);
    expect(units[1].words).toHaveLength(0);
  });

  test("units are the inventory's units, in the inventory's order", () => {
    const units = createLessonUnits(
      "A2",
      [
        { unit: 1, words: 2 },
        { unit: 2, words: 2 },
        { unit: 3, words: 2 },
        { unit: 4, words: 3 },
      ],
      [],
    );

    expect(units.map((unit) => unit.number)).toEqual([1, 2, 3, 4]);
    expect(units.map((unit) => unit.wordCount)).toEqual([2, 2, 2, 3]);
    expect(units[3].href).toBe("/english/a2/unit/4/practice");
    expect(units[0].id).toBe("a2-unit-1");
  });

  test("a level that publishes nothing lists no units at all", () => {
    // `Math.max(ceil(total / UNIT_SIZE), 1)` invented one here, so the hub linked to a
    // `unit/1` that answered 404 — a soft-404 hub pointing at a hard 404.
    expect(createLessonUnits("B2", [], [])).toEqual([]);
  });

  test("a row with no stored unit is grouped into unit 1, as the inventory counts it", () => {
    // `COALESCE(unit, 1)` in backend/src/curriculum-inventory.ts. This used to guess
    // `floor((sourceOrder - 1) / UNIT_SIZE) + 1` instead, which disagreed with the count
    // the badge above the range was showing.
    const [first] = createLessonUnits(
      "A1",
      [{ unit: 1, words: 1 }],
      [word(1, 999, "orphan")].map((entry) => ({ ...entry, unit: null })),
    );

    expect(first.words.map((entry) => entry.displayWord)).toEqual(["orphan"]);
    expect(first.wordRange).toBe("orphan → orphan");
  });
});
