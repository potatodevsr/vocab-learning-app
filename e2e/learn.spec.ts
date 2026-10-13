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
    // Every choice, including matching, submits on one tap.

    await page.getByTestId("session-option").first().click();
  }
  await expect(page.getByTestId("session-feedback")).toBeVisible();
};

test.describe("mixed session", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("replayed answers have neutral option styling after a failed resume read", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await answerCurrentItem(page);
    await page.route(/\/api\/progress\/session\/[^/]+$/, route => {
      if (route.request().method() === "GET") return route.fulfill({ status: 503, json: { message: "down" } });
      return route.continue();
    });
    await page.reload();
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    const option = page.getByTestId("session-option").nth(1);
    await option.click();
    await expect(page.getByTestId("session-feedback")).toHaveAttribute("data-already-answered", "true");
    await expect(option).not.toHaveClass(/bg-success|bg-danger/);
    await expect(option.locator("svg")).toHaveCount(0);
  });

  test("matching follows its instruction with one tap", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    for (let i = 0; i < 8; i += 1) {
      if (await page.getByTestId("session-card").getAttribute("data-item-type") === "match-pairs") {
        await expect(page.getByText("Choose the matching meaning.")).toBeVisible();
        await page.getByTestId("session-option").first().click();
        await expect(page.getByTestId("session-feedback")).toBeVisible();
        return;
      }
      await answerCurrentItem(page);
      await page.getByTestId("session-continue").click();
    }
    throw new Error("No matching item was exercised");
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

        await options.last().click();
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

  /**
   * Leaving a session and coming back is the promise the close dialog makes in words
   * ("your answers are saved — come back later"), and it was the one thing the client
   * could not do. `POST /progress/session/start` returns the open session with all eight
   * items and no answer state, so a reload redrew it from item 1 and re-asked questions
   * the server had already graded. Answering one of those replayed its stored verdict:
   * a *wrong* pick on an item answered correctly yesterday was met with "Correct!" and a
   * green tick on the wrong meaning.
   */
  test("returning to an open session resumes at the first unanswered item", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await answerCurrentItem(page);
    await page.getByTestId("session-continue").click();
    await expect(page.getByTestId("session-counter")).toHaveText("2 of 8");
    const secondItemWord = await page.getByTestId("session-card").innerText();

    await page.reload();

    await expect(page.getByTestId("session-card")).toBeVisible();
    await expect(page.getByTestId("session-counter")).toHaveText("2 of 8");
    expect(await page.getByTestId("session-card").innerText()).toBe(secondItemWord);
  });

  test("an item answered before this visit is drawn as done, not as right or wrong", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await answerCurrentItem(page);
    await page.getByTestId("session-continue").click();

    await page.reload();
    await expect(page.getByTestId("session-card")).toBeVisible();

    // The resumed pip is filled — that item is behind the learner — but this client never
    // saw its verdict, and `answeredCount` does not carry one. Nothing may claim it did.
    const firstPip = page.getByTestId("session-pip").first();
    await expect(firstPip).toHaveAttribute("data-filled", "true");
    const pipClass = (await firstPip.getAttribute("class")) ?? "";
    expect(pipClass).not.toContain("bg-success");
    expect(pipClass).not.toContain("bg-danger");
  });

  /**
   * Every session carries exactly one typed item, and `Enter` is the key the three cards
   * before it have just taught as "continue". The keyboard branch had none of the
   * emptiness guard the Check button carries, so that muscle-memory press posted an empty
   * answer, the server graded it wrong, and the word lost a mastery rung — on the one item
   * type that cannot degrade away.
   */
  test("Enter does not spend a spelling item on an empty answer", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    const input = page.getByTestId("session-spelling-input");
    for (let index = 0; index < 8; index += 1) {
      if (await input.isVisible().catch(() => false)) break;
      await answerCurrentItem(page);
      await page.getByTestId("session-continue").click();
    }

    await expect(input).toBeVisible();
    const counterBefore = await page.getByTestId("session-counter").textContent();

    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    await expect(page.getByTestId("session-feedback")).toBeHidden();
    await expect(page.getByTestId("session-counter")).toHaveText(counterBefore ?? "");

    // The same key still works the moment there is something to submit.
    await input.fill("something");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("session-feedback")).toBeVisible();
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
