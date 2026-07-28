import { expect, test } from "@playwright/test";

import { UNIT_SIZE } from "../../lib/oxford-words";

/**
 * `extractWords` is not exported, so its branches are covered through the API specs.
 * What is worth pinning here is the unit-size constant every page derives from: change
 * it and unit boundaries shift under learners who already finished a unit.
 */
test.describe("unit sizing", () => {
  test("a unit is twenty words", () => {
    expect(UNIT_SIZE).toBe(20);
  });

  test("unit count is a ceiling, so a partial unit still counts", () => {
    const unitCount = (total: number) =>
      Math.max(Math.ceil(total / UNIT_SIZE), 1);

    expect(unitCount(0)).toBe(1);
    expect(unitCount(1)).toBe(1);
    expect(unitCount(20)).toBe(1);
    expect(unitCount(21)).toBe(2);
    expect(unitCount(40)).toBe(2);
    expect(unitCount(899)).toBe(45);
  });

  test("a requested unit is clamped into range", () => {
    const clamp = (requested: number, total: number) =>
      Math.min(requested, Math.max(Math.ceil(total / UNIT_SIZE), 1));

    expect(clamp(99, 40)).toBe(2);
    expect(clamp(1, 40)).toBe(1);
    expect(clamp(2, 40)).toBe(2);
    expect(clamp(1, 0)).toBe(1);
  });
});
