import { expect, test, type Page } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

/**
 * The end-of-unit checkpoint (`docs/LEARNER-LIFECYCLE.md` §3.8, §8 L3). These drive the
 * real UI against the real Hono Worker and D1 — the checkpoint rows a test creates are
 * really committed, and every verdict is the server's, never the client's.
 *
 * L3's gate names four recovery paths; this file covers the three that are reachable with
 * the committed e2e seed: the not-ready gate, refresh/resume, and failure→recovery. A
 * *passing* checkpoint additionally requires every published word in the unit to already
 * sit at mastery ≥ 3 (`backend/src/checkpoint.ts` `computeGate`), which for the 20-word
 * seeded unit 1 means many graded sessions with server-chosen correct answers the client
 * is deliberately never told — so it is not deterministically reachable here without a
 * mastery-seeding fixture. See the note at the bottom of this file.
 */

/** Completes one eight-item mixed session in unit 1, creating the UserWordProgress rows a
 *  checkpoint gates on (it counts only words the learner has actually met). */
const completeOneSession = async (page: Page) => {
  await page.goto("/en/learn?level=A1&unit=1");
  await expect(page.getByTestId("session-card")).toBeVisible();
  for (let index = 0; index < 8; index += 1) {
    await expect(page.getByTestId("session-card")).toBeVisible();
    const spelling = page.getByTestId("session-spelling-input");
    if (await spelling.isVisible().catch(() => false)) {
      await spelling.fill("placeholder");
      await page.getByTestId("session-continue").click();
    } else {
      const itemType = await page.getByTestId("session-card").getAttribute("data-item-type");
      await page.getByTestId("session-option").first().click();
      if (itemType === "match-pairs") {
        await page.getByTestId("session-option").first().click();
      }
    }
    await expect(page.getByTestId("session-feedback")).toBeVisible();
    await page.getByTestId("session-continue").click();
  }
  await expect(page.getByTestId("session-result")).toBeVisible();
};

/** Answers one checkpoint item (whichever variant it is) through the real grade + feedback
 *  beat, then presses Continue. */
const answerCheckpointItem = async (page: Page) => {
  await expect(page.getByTestId("checkpoint-card")).toBeVisible();
  const spelling = page.getByTestId("checkpoint-spelling-input");
  if (await spelling.isVisible().catch(() => false)) {
    await spelling.fill("placeholder");
    await page.getByTestId("checkpoint-continue").click();
  } else {
    await page.getByTestId("checkpoint-option").first().click();
  }
  await expect(page.getByTestId("checkpoint-feedback")).toBeVisible();
  await page.getByTestId("checkpoint-continue").click();
};

const CHECKPOINT_URL = "/en/english/a1/unit/1/checkpoint";

test.describe("unit checkpoint", () => {
  test("a learner who hasn't met enough words sees the not-ready gate, not an error", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await page.goto(CHECKPOINT_URL);

    // 422 from the server becomes a "practise a little more" screen with a route onward —
    // a lock is never a dead end (§3.8).
    await expect(page.getByTestId("checkpoint-not-ready")).toBeVisible();
    await expect(page.getByTestId("checkpoint-not-ready-body")).toBeVisible();
    await expect(page.getByTestId("checkpoint-error")).toHaveCount(0);

    const practise = page.getByTestId("checkpoint-practice-cta");
    await expect(practise).toBeVisible();
    await expect(practise).toHaveAttribute("href", "/en/english/a1/unit/1/practice");
  });

  test("refresh resumes the checkpoint at the item the learner left off at", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await completeOneSession(page);

    await page.goto(CHECKPOINT_URL);
    await expect(page.getByTestId("checkpoint-card")).toBeVisible();
    await expect(page.getByTestId("checkpoint-counter")).toHaveText("1 of 5");

    // Answer the first two items, then reload mid-checkpoint.
    await answerCheckpointItem(page);
    await answerCheckpointItem(page);
    await expect(page.getByTestId("checkpoint-counter")).toHaveText("3 of 5");

    await page.reload();

    // Server-confirmed state, not the browser's: the reload lands back on item 3 with the
    // first two pips already filled.
    await expect(page.getByTestId("checkpoint-card")).toBeVisible();
    await expect(page.getByTestId("checkpoint-counter")).toHaveText("3 of 5");
    await expect(page.locator('[data-testid="checkpoint-pip"][data-filled="true"]')).toHaveCount(2);
  });

  test("a failed checkpoint gives a recovery route and keeps prior progress", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await completeOneSession(page);

    await page.goto(CHECKPOINT_URL);
    await expect(page.getByTestId("checkpoint-card")).toBeVisible();

    for (let index = 0; index < 5; index += 1) {
      await answerCheckpointItem(page);
    }

    // One session leaves the unit's words well below the mastery bar, so the gate fails
    // regardless of the score — and the result is a focused recovery round, not a wall.
    const result = page.getByTestId("checkpoint-result");
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute("data-passed", "false");

    await expect(page.getByTestId("checkpoint-result-heading")).toBeVisible();
    await expect(
      page.getByTestId("checkpoint-result-pips").getByTestId("checkpoint-result-pip"),
    ).toHaveCount(5);

    const recovery = page.getByTestId("checkpoint-recovery-cta");
    await expect(recovery).toBeVisible();
    await expect(recovery).toHaveAttribute("href", "/en/english/a1/unit/1/practice");

    // The gate never writes mastery, so the session's progress is untouched: the profile
    // still shows the finished lesson.
    await page.goto("/en/profile");
    await expect(page.getByTestId("stat-lessons")).toHaveText("1");
  });

  test("the checkpoint route is behind auth", async ({ page }) => {
    await page.goto(CHECKPOINT_URL);
    await expect(page).toHaveURL(/\/en\/auth\/login/);
  });

  const START = "**/api/progress/checkpoint/start";

  test("the loading spinner shows while the checkpoint is prepared", async ({ page }) => {
    await registerThroughUi(page);
    await page.route(START, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await page.goto(CHECKPOINT_URL);
    await expect(page.getByTestId("checkpoint-loading")).toBeVisible();
    // A fresh learner hasn't met enough words, so the settled state is the not-ready gate.
    await expect(page.getByTestId("checkpoint-not-ready")).toBeVisible();
  });

  test("a 401 from the server shows the sign-in screen, not a crash", async ({ page }) => {
    await registerThroughUi(page);
    await page.route(START, (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: '{"message":"unauth"}' }),
    );

    await page.goto(CHECKPOINT_URL);
    await expect(page.getByTestId("checkpoint-unauth")).toBeVisible();
    const signin = page.getByTestId("checkpoint-signin");
    await expect(signin).toBeVisible();
    await expect(signin).toHaveAttribute("href", /\/auth\/login\?from=/);
  });

  test("a failed checkpoint start shows a retry that recovers", async ({ page }) => {
    await registerThroughUi(page);
    await page.route(START, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"down"}' }),
    );

    await page.goto(CHECKPOINT_URL);
    await expect(page.getByTestId("checkpoint-error")).toBeVisible();

    await page.unroute(START);
    await page.getByTestId("checkpoint-retry").click();
    await expect(page.getByTestId("checkpoint-not-ready")).toBeVisible();
  });

  test("an in-progress checkpoint closes through its confirmation dialog", async ({ page }) => {
    await registerThroughUi(page);
    await completeOneSession(page);

    await page.goto(CHECKPOINT_URL);
    await expect(page.getByTestId("checkpoint-card")).toBeVisible();
    await expect(page.getByTestId("checkpoint-prompt")).toBeVisible();

    await page.getByTestId("checkpoint-close").click();
    await expect(page.getByTestId("checkpoint-close-confirm")).toBeVisible();
    await page.getByTestId("checkpoint-close-confirm-cancel").click();
    await expect(page.getByTestId("checkpoint-close-confirm")).toHaveCount(0);

    await page.getByTestId("checkpoint-close").click();
    await expect(page.getByTestId("checkpoint-close-confirm-save")).toHaveAttribute(
      "href",
      "/en/english/a1/unit/1",
    );
  });

  test("a passing checkpoint celebrates and routes back to the unit", async ({ page }) => {
    await registerThroughUi(page);
    await completeOneSession(page);

    // A genuine pass needs every published unit word at mastery >= 3, which one session
    // cannot reach (see the note at the bottom of this file). Flip only the gate outcome on
    // the settling answer — every per-item verdict is still the real server's — so the
    // celebratory result branch and its "back to unit" continue can be exercised.
    await page.route("**/api/progress/checkpoint/answer", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: body.done ? { ...body, passed: true } : body });
    });

    await page.goto(CHECKPOINT_URL);
    await expect(page.getByTestId("checkpoint-card")).toBeVisible();
    for (let index = 0; index < 5; index += 1) {
      await answerCheckpointItem(page);
    }

    const result = page.getByTestId("checkpoint-result");
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute("data-passed", "true");
    await expect(page.getByTestId("checkpoint-result-heading")).toBeVisible();
    await expect(page.getByTestId("checkpoint-result-continue")).toHaveAttribute(
      "href",
      "/en/english/a1/unit/1",
    );
  });
});

test.describe("unit checkpoint entry point", () => {
  test("the unit page offers the checkpoint to a signed-in learner", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/english/a1/unit/1");

    const entry = page.getByTestId("unit-checkpoint-entry");
    await expect(entry).toBeVisible();
    await expect(page.getByTestId("unit-checkpoint-cta")).toHaveAttribute(
      "href",
      CHECKPOINT_URL,
    );
  });

  test("a logged-out visitor sees no checkpoint entry on the unit page", async ({ page }) => {
    await page.goto("/en/english/a1/unit/1");
    await expect(page.getByTestId("unit-word-list")).toBeVisible();
    await expect(page.getByTestId("unit-checkpoint-entry")).toHaveCount(0);
  });
});
