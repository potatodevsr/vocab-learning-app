import { expect, test } from "@playwright/test";

import { readInventory } from "../../backend/src/curriculum-inventory";
import {
  getCurriculum,
  getLevelInventory,
  getLevelUnitCount,
  getLevelWordCount,
  getPublishedLevels,
  getUnitNumbers,
  isRealUnit,
  nextUnitAfter,
  resolveUnit,
} from "../../lib/curriculum";
import { SEED } from "../support/fixtures";

/**
 * The grouping itself, with no database and no server.
 *
 * `readInventory` is the one place that turns stored rows into "which units exist". The
 * defect it replaces was not a query bug — the query was never written. Seven callers each
 * inferred the answer from a row count, so what needs pinning is that this function reports
 * what the rows say even when the rows are nothing like twenty to a unit.
 */
const fakePrisma = (rows: { level: string | null; unit: number | null; words: number }[]) =>
  ({ $queryRaw: async () => rows }) as never;

test.describe("readInventory", () => {
  test("counts stored units, whatever size they are", async () => {
    const inventory = await readInventory(
      fakePrisma([
        { level: "A2", unit: 1, words: 3 },
        { level: "A2", unit: 2, words: 3 },
        { level: "A2", unit: 3, words: 3 },
        { level: "A2", unit: 4, words: 3 },
      ]),
      "oxford-3000",
    );

    const a2 = inventory.levels[0];

    expect(a2.unitCount).toBe(4);
    expect(a2.words).toBe(12);
    // The sum divided by twenty is 1. That number must never be the answer again.
    expect(a2.unitCount).not.toBe(Math.max(Math.ceil(a2.words / 20), 1));
    expect(a2.lastUnit).toBe(4);
  });

  test("orders levels by CEFR band and units ascending", async () => {
    const inventory = await readInventory(
      fakePrisma([
        { level: "B1", unit: 2, words: 5 },
        { level: "A1", unit: 3, words: 4 },
        { level: "A1", unit: 1, words: 20 },
        { level: "B1", unit: 1, words: 9 },
      ]),
      "oxford-3000",
    );

    expect(inventory.levels.map((level) => level.level)).toEqual(["A1", "B1"]);
    expect(inventory.levels[0].units.map((unit) => unit.unit)).toEqual([1, 3]);
    expect(inventory.words).toBe(38);
  });

  test("a row with no unit is kept, not dropped", async () => {
    // `unit` is nullable in the schema. Dropping such a row here would hide published
    // content from the map for exactly the reason this whole module exists.
    const inventory = await readInventory(
      fakePrisma([{ level: "A1", unit: null, words: 7 }]),
      "oxford-3000",
    );

    expect(inventory.levels[0].units).toEqual([{ unit: 1, words: 7 }]);
  });

  test("an empty corpus is empty, not one invented unit", async () => {
    const inventory = await readInventory(fakePrisma([]), "oxford-3000");

    expect(inventory.levels).toEqual([]);
    expect(inventory.words).toBe(0);
  });
});

/**
 * The web accessors, against the running API.
 *
 * These are the functions every page now asks instead of doing its own arithmetic, so
 * they are exercised end to end rather than mocked.
 */
test.describe("curriculum accessors", () => {
  const { level, wordCount, unitCount, lastUnit } = SEED.irregularLevel;

  test("report the irregular level exactly as stored", async () => {
    expect(await getLevelWordCount(level)).toBe(wordCount);
    expect(await getLevelUnitCount(level)).toBe(unitCount);
    expect(await getUnitNumbers(level)).toEqual([1, 2, 3, 4]);

    const inventory = await getLevelInventory(level);
    expect(inventory?.lastUnit).toBe(lastUnit);
  });

  test("a real unit resolves and an invented one does not", async () => {
    expect(await isRealUnit(level, lastUnit)).toBe(true);
    expect(await isRealUnit(level, lastUnit + 1)).toBe(false);

    // The old behaviour clamped 99 to the arithmetic ceiling and taught a different unit.
    expect(await resolveUnit(level, lastUnit)).toBe(lastUnit);
    expect(await resolveUnit(level, 99)).toBeNull();
    expect(await resolveUnit(level, undefined)).toBeNull();
  });

  /**
   * The tail of a level has nothing after it, and saying so is the point.
   *
   * The legacy quiz closed this expression with `?? unit`, so finishing the last unit of a
   * level offered "Next unit" pointing back at the unit just finished. The full-stack
   * suite cannot reach that screen for the tail — a quiz needs four ready words and every
   * A2 unit holds two or three — so the boundary is pinned here, against the real
   * inventory rather than a stub.
   */
  test("the unit after the last one is nothing, not the last one again", async () => {
    expect(await nextUnitAfter(level, lastUnit - 1)).toBe(lastUnit);
    expect(await nextUnitAfter(level, lastUnit)).toBeNull();
  });

  test("a unit that does not exist has no successor to offer", async () => {
    expect(await nextUnitAfter(level, 99)).toBeNull();
    expect(await nextUnitAfter("B1", 1)).toBeNull();
  });

  test("the whole inventory is one document every consumer can share", async () => {
    const inventory = await getCurriculum();
    const levels = await getPublishedLevels();

    expect(levels).toEqual(inventory.levels);
    expect(inventory.words).toBe(
      inventory.levels.reduce((total, entry) => total + entry.words, 0),
    );
  });
});
