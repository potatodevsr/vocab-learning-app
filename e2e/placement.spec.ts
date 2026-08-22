import { expect, test } from "@playwright/test";

/**
 * The public placement test (`docs/LEARNER-LIFECYCLE.md` §3.4).
 *
 * Two things have to hold, and they pull in opposite directions: it must be usable with no
 * account at all, and it must still be graded by the server. So the assertions here are
 * about the wall that is not there (no login, no cookie, a public page at the end) and
 * about the answer key that never reaches the browser.
 */

test.describe("placement test", () => {
  test("is public, indexable, and works with no account", async ({ page }) => {
    await page.goto("/en/english/test");

    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? "").join(","));
    expect(robots).not.toContain("noindex");

    // The visitor is told what they are about to do before they start it — the intro is
    // where the "no account needed" promise is made.
    await expect(page.getByTestId("placement-intro")).toBeVisible();

    await page.getByTestId("placement-begin").click();
    await expect(page.getByTestId("placement-question")).toBeVisible();

    // The card says what it is asking and which band it drew from. Both matter after the
    // fact: a recommendation nobody can trace back to the questions that produced it is a
    // number, not a placement.
    await expect(page.getByTestId("placement-prompt")).not.toBeEmpty();
    await expect(page.getByTestId("placement-item-level")).toHaveText(/A1|A2|B1|B2/);

    // Answer every question with the first option. Whatever that scores, it scores.
    //
    // The counter is the loop bound rather than a fixed number: how many questions there
    // are depends on how many levels have enough published content, and the last click
    // unmounts the card while the score is in flight — so each step waits for the *next*
    // question rather than clicking blind into a disabled button.
    const counter = page.getByTestId("placement-question").getByText(/ of \d+$/);
    const total = Number((await counter.textContent())?.match(/of (\d+)/)?.[1] ?? 0);
    expect(total).toBeGreaterThan(0);

    for (let index = 0; index < total; index += 1) {
      await page.getByTestId("placement-option").first().click();

      if (index < total - 1) {
        await expect(counter).toHaveText(new RegExp(`^${index + 2} of `));
      }
    }

    await expect(page.getByTestId("placement-result")).toBeVisible();
    await expect(page.getByTestId("placement-level")).toHaveText(/A1|A2|B1|B2/);

    // The result ends somewhere the visitor can actually go without signing up.
    await page.getByTestId("placement-start-level").click();
    await expect(page).toHaveURL(/\/english\/(a1|a2|b1|b2)$/);
  });

  test("the browser is never sent the answer key", async ({ page, request }) => {
    const started = await request.post("/api/placement/start");
    expect(started.status()).toBe(200);

    const body = await started.json();
    expect(body.items.length).toBeGreaterThan(0);

    // Every item is a word and four meanings — and nothing that says which one is right.
    const serialised = JSON.stringify(body.items);
    expect(serialised).not.toContain("correct");

    // The token carries the key, signed. Tampering with it is refused rather than scored.
    const forged = await request.post("/api/placement/score", {
      data: { token: `${body.token}x`, answers: [0] },
      failOnStatusCode: false,
    });
    expect(forged.status()).toBe(400);
  });

  test("grades against the server's key, not the client's claim", async ({ request }) => {
    const started = await (await request.post("/api/placement/start")).json();

    // All answers wrong-by-construction is impossible to guarantee from here, so assert
    // the shape instead: a real score over the real item count, with per-level detail.
    const scored = await (
      await request.post("/api/placement/score", {
        data: { token: started.token, answers: new Array(started.itemCount).fill(0) },
      })
    ).json();

    expect(scored.itemCount).toBe(started.itemCount);
    expect(scored.correctCount).toBeLessThanOrEqual(scored.itemCount);
    expect(scored.levels.length).toBeGreaterThan(0);
    expect(["A1", "A2", "B1", "B2"]).toContain(scored.recommendedLevel);

    // An unanswered item scores as wrong rather than being skipped — the recommendation
    // has to describe what the learner demonstrated.
    const blank = await (
      await request.post("/api/placement/score", {
        data: { token: started.token, answers: [] },
      })
    ).json();
    expect(blank.correctCount).toBe(0);
    expect(blank.recommendedLevel).toBe("A1");
  });
});

test("the landing page offers the test to a visitor who does not know where to start", async ({
  page,
}) => {
  await page.goto("/en");

  // The question that stops a first-time visitor from starting at all was only answerable
  // from the footer until this link existed.
  await page.getByTestId("home-level-test").click();
  await expect(page).toHaveURL(/\/english\/test$/);
  await expect(page.getByTestId("placement-intro")).toBeVisible();
});

test.describe("level-scoped test", () => {
  test("asks about one level only, and offers the full test beside it", async ({ page }) => {
    await page.goto("/en/english/test/a1");

    // Indexable in its own right: it answers its own query ("A2 level test"), which the
    // generic page cannot.
    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? "").join(","));
    expect(robots).not.toContain("noindex");

    await page.getByTestId("placement-begin").click();
    await expect(page.getByTestId("placement-question")).toBeVisible();

    // Every question is from the level in the URL — a question labelled A1 on the A1 page.
    await expect(page.getByTestId("placement-item-level")).toHaveText("A1");

    const counter = page.getByTestId("placement-question").getByText(/ of \d+$/);
    const total = Number((await counter.textContent())?.match(/of (\d+)/)?.[1] ?? 0);
    // Six rather than three: with no other level to compare against, three answers is too
    // thin a basis for a yes/no.
    expect(total).toBe(6);
  });

  test("an unknown level is a 404, not an empty test", async ({ page }) => {
    const response = await page.goto("/en/english/test/c1");

    expect(response?.status()).toBe(404);
  });
});
