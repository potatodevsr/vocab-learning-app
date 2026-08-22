import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * Unit unlocking and crowns (SPEC §5.4.2) — the last structural gap in the learner path.
 *
 * The rule is deliberately soft — it is an order the app *recommends*, not one it imposes:
 *
 *   * **Content stays open.** Every unit page is public and linkable; locking hides
 *     nothing, because the whole corpus is browsable without an account and a lock on a
 *     page a crawler can read would be theatre.
 *   * **Navigation is honoured.** A learner who asks for unit 7 gets unit 7. What the
 *     order governs is where the app *points* — `nextUnit` on the Today card and the level
 *     page — not what it serves when someone chooses otherwise.
 */

test.describe("unit states", () => {
  test("a fresh learner has unit 1 open, later units closed, and no crowns", async ({
    page,
  }) => {
    await registerThroughUi(page);

    const res = await page.request.get("/api/progress/units?level=A1");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.crowns).toBe(0);
    expect(body.nextUnit).toBe(1);

    const first = body.units.find((unit: { unit: number }) => unit.unit === 1);
    const second = body.units.find((unit: { unit: number }) => unit.unit === 2);

    expect(first.unlocked, "unit 1 has nothing before it").toBe(true);
    expect(first.complete).toBe(false);
    expect(second?.unlocked, "unit 2 waits for unit 1").toBe(false);
  });

  test("the route is the learner's own", async ({ request }) => {
    const res = await request.get("/api/progress/units?level=A1", {
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(401);
  });
});

test.describe("order is guidance, not enforcement", () => {
  test("an explicitly requested unit is served, even before its turn", async ({ page }) => {
    await registerThroughUi(page);

    const res = await page.request.post("/api/progress/session/start", {
      data: { level: "A1", unit: 2 },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    /**
     * The version of this that silently served unit 1 broke `units.spec` — and that spec
     * was right. "Each unit serves its own twenty words" is the invariant behind AGENTS.md
     * rule 9, and a lesson teaching unit 1 under a unit 2 request is a lie no response
     * field makes honest. Someone who navigates ahead on purpose gets what they asked for.
     */
    expect(body.unit).toBe(2);
    expect(body.items.length).toBeGreaterThan(0);
  });

  test("the path still points at the unit the learner is ready for", async ({ page }) => {
    await registerThroughUi(page);

    // Guidance lives here instead: the read that the Today card and the level page follow.
    const units = await (await page.request.get("/api/progress/units?level=A1")).json();
    expect(units.nextUnit).toBe(SEED.unit1.number);
  });

  test("a locked unit's page is still readable", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto(`/en/english/a1/unit/2`);

    // Public content stays public — the order is advice, and the page is content.
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("crowns on the level page", () => {
  test("appear for a signed-in learner and stay absent for a visitor", async ({
    page,
  }) => {
    await page.goto("/en/english/a1");
    // Anonymous: the page is the same cached document a crawler gets.
    await expect(page.getByTestId("unit-progress")).toHaveCount(0);

    await registerThroughUi(page);
    await page.goto("/en/english/a1");

    await expect(page.getByTestId("unit-progress")).toBeVisible();
    await expect(page.getByTestId("unit-progress-continue")).toContainText("1");

    /**
     * The two conditional badges, checked against the server rather than against a number
     * this fixture happens to produce.
     *
     * `unit-progress-locked` appears only when something is locked and
     * `unit-progress-crowned` only when something is crowned, so asserting either is
     * present would pin whatever the seed does today. What has to hold whatever the seed
     * does is that the badges agree with `/progress/units` — a lock note on a level with
     * nothing locked, or a silent crown list on a learner with no crowns, is the badge
     * lying about progress.
     */
    const units = (await (
      await page.request.get("/api/progress/units?level=A1")
    ).json()) as { units: { unlocked: boolean; crown: boolean }[] };

    const locked = units.units.filter((unit) => !unit.unlocked).length;
    const crowned = units.units.filter((unit) => unit.crown).length;

    expect(
      await page.getByTestId("unit-progress-locked").count(),
      "the lock note disagrees with /progress/units",
    ).toBe(locked > 0 ? 1 : 0);

    expect(
      await page.getByTestId("unit-progress-crowned").count(),
      "the crown list disagrees with /progress/units",
    ).toBe(crowned > 0 ? 1 : 0);
  });
});
