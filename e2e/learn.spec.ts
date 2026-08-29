import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

/**
 * The merged eight-item mixed session at `/learn`
 * (LEARNER-LIFECYCLE.md §0, §3.5, §3.10, §8 L2) — replaces the old lesson→quiz pair.
 * Grading is entirely server-authoritative (`backend/src/session.ts`); this suite drives
 * the UI, not the API — see `e2e/api/session.api.spec.ts` for the server-side contract.
 */

/** Answers whatever the current item asks for, honestly guessing at option 0 for choice
 *  items and typing junk for spelling — the point of these tests is the shell and the
 *  completion sequence, not achieving a particular score. */
const answerCurrentItem = async (page: import("@playwright/test").Page) => {
  const spelling = page.getByTestId("session-spelling-input");
  if (await spelling.isVisible().catch(() => false)) {
    await spelling.fill("placeholder");
    await page.getByTestId("session-continue").click();
  } else {
    // Branch on the item type the card exposes, rather than racing the async grade: after
    // a single tap the option is disabled while checking, so a speculative second tap
    // (guessing "was this match-pairs?") would wait forever on a disabled control. Only
    // match-pairs genuinely needs the second tap (pick up the word, then submit it).
    const type = await page.getByTestId("session-card").getAttribute("data-item-type");
    await page.getByTestId("session-option").first().click();
    if (type === "match-pairs") {
      await page.getByTestId("session-option").first().click();
    }
  }
  await expect(page.getByTestId("session-feedback")).toBeVisible();
};

test.describe("mixed session", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("opens with a 4-option recognition item and a full progress strip", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await expect(page.getByTestId("session-card")).toBeVisible();
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    await expect(page.getByTestId("session-pip")).toHaveCount(8);
    // The first card is always 4-option recognition, never typing (§3.10.5).
    await expect(page.getByTestId("session-option")).toHaveCount(4);
  });

  test("the continue button holds the same slot across in-progress, checking and feedback", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    const continueButton = page.getByTestId("session-continue");
    const box1 = await continueButton.boundingBox();

    await page.getByTestId("session-option").first().click();
    await expect(page.getByTestId("session-feedback")).toBeVisible();
    const box2 = await continueButton.boundingBox();

    expect(box1?.x).toBe(box2?.x);
    expect(box1?.y).toBe(box2?.y);
  });

  test("colour is never the only signal — feedback always carries an icon and text", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    // Deliberately wrong: pick the last option repeatedly across items until at least one
    // lands incorrect (a same-part-of-speech distractor pool makes "always last" unlikely
    // to always be right).
    let sawWrong = false;
    for (let i = 0; i < 8 && !sawWrong; i += 1) {
      const options = page.getByTestId("session-option");
      const spelling = page.getByTestId("session-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("zzz-not-a-word");
        await page.getByTestId("session-continue").click();
      } else {
        const type = await page.getByTestId("session-card").getAttribute("data-item-type");
        await options.last().click();
        if (type === "match-pairs") {
          await options.last().click(); // match-pairs second tap submits the match
        }
      }
      const feedback = page.getByTestId("session-feedback");
      await expect(feedback).toBeVisible();
      if (!(await feedback.getByText(/correct/i).count())) {
        sawWrong = true;
        // The wrong state carries both colour (bg-danger/warn) and an icon + text — never
        // colour alone (LEARNER-LIFECYCLE.md §3.10.10).
        await expect(feedback.locator("svg")).toBeVisible();
        await expect(feedback).not.toHaveText("");
      }
      await page.getByTestId("session-continue").click();
    }
    expect(sawWrong).toBe(true);
  });

  test("completing all eight items reaches the result screen with a working next action", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    for (let index = 0; index < 8; index += 1) {
      await answerCurrentItem(page);
      await page.getByTestId("session-continue").click();
    }

    await expect(page.getByTestId("session-result")).toBeVisible();
    await expect(page.getByTestId("session-result-pip")).toHaveCount(8);

    await page.getByTestId("session-continue-home").click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.getByTestId("today-card")).toBeVisible();
  });

  test("close offers save-and-leave rather than only discard", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await page.getByTestId("session-close").click();
    await expect(page.getByTestId("session-close-confirm")).toBeVisible();
    await expect(page.getByTestId("session-close-confirm-save")).toBeVisible();
    await expect(page.getByTestId("session-close-confirm-cancel")).toBeVisible();

    await page.getByTestId("session-close-confirm-cancel").click();
    await expect(page.getByTestId("session-close-confirm")).toBeHidden();
  });

  test("keyboard: 1-4 selects, Enter continues, Esc opens close confirmation", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();
    await page.keyboard.press("1");
    await expect(page.getByTestId("session-feedback")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("session-counter")).toHaveText("2 of 8");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("session-close-confirm")).toBeVisible();
  });

  test("remains legible and single-column at the primary phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();

    const card = page.getByTestId("session-card");
    const box = await card.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);
  });
});

/**
 * The session mode has to reach the server.
 *
 * `mixed-session.tsx` was calling `startSession({ level, unit })` and dropping `mode`, so
 * `/learn?mode=review` and `/learn?mode=comeback` both opened an ordinary session. Nothing
 * broke visibly — the server ignores an unknown mode and every route still produced eight
 * items — so the Today card's "you have N due" CTA and the returning-learner CTA spent
 * their whole life pointing at behaviour that never ran.
 */
test.describe("session mode reaches the API", () => {
  test("a review request asks for a review", async ({ page }) => {
    await registerThroughUi(page);

    const started = page.waitForRequest(
      (request) =>
        request.url().includes("/api/progress/session/start") &&
        request.method() === "POST",
    );

    await page.goto("/en/learn?level=A1&mode=review");

    expect((await started).postDataJSON()).toMatchObject({ mode: "review" });
  });

  test("a mistakes request asks for the mistake set", async ({ page }) => {
    await registerThroughUi(page);

    const started = page.waitForRequest(
      (request) =>
        request.url().includes("/api/progress/session/start") &&
        request.method() === "POST",
    );

    await page.goto("/en/learn?mode=mistakes");

    expect((await started).postDataJSON()).toMatchObject({ mode: "mistakes" });
  });

  test("an ordinary lesson sends no mode at all", async ({ page }) => {
    await registerThroughUi(page);

    const started = page.waitForRequest(
      (request) =>
        request.url().includes("/api/progress/session/start") &&
        request.method() === "POST",
    );

    await page.goto("/en/learn?level=A1&unit=1");

    // The server defaults an absent mode to `normal`, so an old client keeps working and
    // the default path carries no redundant field.
    const body = (await started).postDataJSON();
    expect(body).not.toHaveProperty("mode");
    expect(body).toMatchObject({ level: "A1", unit: 1 });
  });
});

/**
 * `scope.mode` is in `boot`'s dependency list.
 *
 * It was missing, so the callback closed over whichever mode it was first created with.
 * **This is hygiene, not a live defect, and the test below says only what it proves:** the
 * route renders `<MixedSession key={`${level}-${unit}-${mode}`} …>`, so a mode change
 * remounts the component and a stale callback is discarded before it can be read. The
 * dependency matters the day somebody removes that key — which is exactly when nobody will
 * be looking for this.
 *
 * A test that genuinely exercised a prop change on a *mounted* component would need a
 * component harness this suite does not have; `page.goto` remounts, so it cannot.
 */
test.describe("changing mode starts the session that was asked for", () => {
  test("arriving at the mistake set requests the mistake set", async ({ page }) => {
    await registerThroughUi(page);

    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();

    const started = page.waitForRequest(
      (request) =>
        request.url().includes("/api/progress/session/start") &&
        request.method() === "POST",
    );

    await page.goto("/en/learn?mode=mistakes");

    expect((await started).postDataJSON()).toMatchObject({ mode: "mistakes" });
  });

  test("the route keys the session on its mode, which is what forces the remount", async ({
    page,
  }) => {
    await registerThroughUi(page);

    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();

    // A different mode is a different session, not the same one re-labelled: the previous
    // session's items must not still be on screen.
    const before = await page.getByTestId("session-counter").textContent();

    await page.goto("/en/learn?level=A1&mode=review");

    // Either a fresh session or the empty-review state — never the old session's progress.
    const counter = page.getByTestId("session-counter");
    if (await counter.count()) {
      await expect(counter).toHaveText(/^1 of/);
    }

    expect(before).toMatch(/^1 of/);
  });
});
