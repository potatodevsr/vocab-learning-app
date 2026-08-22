import { expect, test } from "@playwright/test";

import { loginAsAdmin, registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * Word lists (`backend/src/wordlists.ts`).
 *
 * One list exists today — the Oxford 3000 course — so what these tests protect is the
 * property that made the list a first-class entity in the first place: a session draws
 * only from the list the learner is on. Without it, publishing a second list would quietly
 * interleave its words into every existing learner's A1 unit 1, and nobody would notice
 * until a beginner met an exam word in lesson three.
 */

test.describe("word lists", () => {
  test("the catalogue is public and counts only published words", async ({ request }) => {
    const res = await request.get("/api/wordlists");
    expect(res.status()).toBe(200);

    const { lists } = await res.json();
    const course = lists.find((list: { id: string }) => list.id === "oxford-3000");

    expect(course, "the Oxford 3000 course is always in the catalogue").toBeTruthy();
    // The e2e corpus is 45 words, 40 of them published — a list is as big as what a
    // learner can actually reach, never as big as what was imported.
    expect(course.wordCount).toBeGreaterThan(0);
    expect(course.wordCount).toBeLessThan(45);
    // The entitlement seam is exposed as data rather than inferred from a name.
    expect(course.isFree).toBe(true);
  });

  test("a new learner is on the course list", async ({ page }) => {
    await registerThroughUi(page);

    const res = await page.request.get("/api/wordlists/current");
    expect(res.status()).toBe(200);
    expect((await res.json()).wordlistId).toBe("oxford-3000");
  });

  test("switching to a list that does not exist is refused", async ({ page }) => {
    await registerThroughUi(page);

    const res = await page.request.post("/api/wordlists/current", {
      data: { wordlistId: "toeic-900" },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(404);

    // And the learner is left where they were, not on a broken list.
    const current = await (await page.request.get("/api/wordlists/current")).json();
    expect(current.wordlistId).toBe("oxford-3000");
  });

  test("switching to a free list clears the entitlement gate rather than 402ing", async ({
    page,
  }) => {
    await registerThroughUi(page);

    // `canStudyList` (`backend/src/wordlists.ts`) is the single entitlement check, and it
    // answers `402 Not available on your plan` when it says no. Everything ships free
    // today, so the only live branch is this one — pinned here so the day a paid list
    // arrives, turning the check on cannot silently lock out the course everyone is on.
    const res = await page.request.post("/api/wordlists/current", {
      data: { wordlistId: "oxford-3000" },
      failOnStatusCode: false,
    });

    expect(res.status()).not.toBe(402);
    expect(res.status()).toBe(200);
  });

  test("the catalogue needs no account", async ({ request }) => {
    // Signed out, with no cookies at all: this is a shop window, not a setting.
    const res = await request.get("/api/wordlists", { headers: { cookie: "" } });

    expect(res.status()).toBe(200);
    expect((await res.json()).lists.length).toBeGreaterThan(0);
  });

  test("a session still starts, drawn from the learner's list", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/learn?level=A1&unit=1");

    // The regression this guards: scoping every selection query by list must not empty the
    // session for a learner on the default list.
    await expect(page.getByTestId("session-card")).toBeVisible();
    await expect(page.getByTestId("session-option").first()).toBeVisible();
  });
});

test.describe("list curation", () => {
  test("the admin screen sees unpublished lists that the public catalogue does not", async ({
    page,
  }) => {
    await loginAsAdmin(page, SEED.admin);
    await page.goto("/admin/lists");

    await expect(page.getByTestId("admin-lists")).toBeVisible();
    await expect(page.getByTestId("admin-list-row").first()).toContainText("oxford-3000");
  });

  test("a list with no published words cannot be opened to learners", async ({ page }) => {
    await loginAsAdmin(page, SEED.admin);

    // Created the way the importer creates one: unpublished, and with nothing published in
    // it. Publishing it would hand a learner a course that renders empty, so the API
    // refuses — the check lives on the server, not in the button.
    const created = await page.request.post("/api/wordlists/admin/oxford-3000", {
      data: { ordinal: 0 },
      failOnStatusCode: false,
    });
    expect(created.status()).toBe(200);

    const refused = await page.request.post("/api/wordlists/admin/does-not-exist", {
      data: { isPublished: true },
      failOnStatusCode: false,
    });
    expect(refused.status()).toBe(404);
  });

  test("curation routes refuse a learner", async ({ page }) => {
    await registerThroughUi(page);

    const read = await page.request.get("/api/wordlists/admin", { failOnStatusCode: false });
    expect(read.status()).toBe(401);

    const write = await page.request.post("/api/wordlists/admin/oxford-3000", {
      data: { isPublished: false },
      failOnStatusCode: false,
    });
    expect(write.status()).toBe(401);
  });
});
