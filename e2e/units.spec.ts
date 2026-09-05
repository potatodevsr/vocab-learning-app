import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * Regression cover for a bug the guard shapes exposed: the app used to fetch every word
 * in a level and slice units client-side. Once the API capped a read at 50-100 rows, a
 * 900-word level silently collapsed to two units and most content became unreachable.
 * Units are now fetched by their `unit` column, and the level's shape comes from the
 * curriculum inventory (`lib/curriculum.ts`).
 */
test.describe("unit scoping", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("each unit serves its own 20 words, not a slice of the first page", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    await expect(
      page.getByRole("heading", { name: "word1", level: 2 }),
    ).toBeVisible();

    await page.context().clearCookies();
    await registerThroughUi(page);
    await page.goto("/en/learn?level=A1&unit=2");
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    await expect(
      page.getByRole("heading", { name: "word21", level: 2 }),
    ).toBeVisible();
  });

  /**
   * The tail of an irregular level is studyable — the learner-facing half of F-03.
   *
   * A2 is four units of 2, 2, 2 and 3 published rows. `ceil(9 / 20)` is 1, so while `/learn`
   * clamped a unit hint against that arithmetic, a request for unit 4 was answered with
   * unit 1's words and the last three units of the level could not be studied at all. The
   * hint is now checked against the units that exist, so unit 4 opens unit 4.
   */
  test("the last unit of an irregular level opens that unit", async ({ page }) => {
    const { level, lastUnit, lastUnitFirstWord } = SEED.irregularLevel;

    await page.goto(`/en/learn?level=${level}&unit=${lastUnit}`);

    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    await expect(page.getByTestId("session-prompt")).toHaveText(lastUnitFirstWord);
  });

  /**
   * An unknown unit is answered with a redirect, not silently swapped for a different
   * lesson and not silently ignored.
   *
   * This used to clamp: `Math.min(requested, ceil(published / UNIT_SIZE))`, so unit 99
   * quietly became unit 2 and the learner was taught something they had not asked for
   * with nothing on screen saying so. Dropping the hint during render fixed the lesson but
   * left the address bar claiming `?unit=99` over a session that was nothing of the sort.
   * The level's automatic session now has its own URL, and that is where the learner ends
   * up — the choice handed back to the server, and the address saying so.
   */
  test("a unit that does not exist does not silently teach a different one", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=99");

    await expect(page).toHaveURL("/en/learn?level=A1");
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("draft-only units are not reachable", async ({ page }) => {
    // Orders 41-45 are drafts, so a third unit does not exist even though the rows do.
    // Not a real unit, so the same redirect as any other invented one.
    await page.goto("/en/learn?level=A1&unit=3");

    await expect(page).toHaveURL("/en/learn?level=A1");
    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
    await expect(page.getByText(SEED.draftWord, { exact: true })).toHaveCount(0);
  });
});
