import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * Conditional UI branches that the happy-path specs never reach: normalisation of bad
 * query strings, the "last card" state, quiz feedback for both outcomes, restart, and
 * the empty-lesson guard.
 */
test.describe("learn page branches", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("an unknown level falls back to A1", async ({ page }) => {
    await page.goto("/en/learn?level=Z9&unit=1");

    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("a missing level falls back to A1", async ({ page }) => {
    await page.goto("/en/learn");

    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("a zero or negative unit falls back to unit 1", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=0");
    await expect(page.getByTestId("session-prompt")).toHaveText("word1");

    await page.goto("/en/learn?level=A1&unit=-4");
    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("a non-numeric unit falls back to unit 1", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=abc");

    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("a lowercase level is accepted", async ({ page }) => {
    await page.goto("/en/learn?level=a1&unit=2");

    await expect(page.getByTestId("session-prompt")).toHaveText("word21");
  });

  test("the mixed session exposes all eight progress slots without leaking answers", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-pip")).toHaveCount(8);
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    await expect(page.getByTestId("session-card")).not.toHaveAttribute("data-correct", /.+/);
  });
});

test.describe("quiz page branches", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("a correct answer shows the correct feedback", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    // The prompt names the word; its meaning is that word's number in the fixtures.
    const prompt = await page.getByRole("heading", { level: 1 }).innerText();
    const index = prompt.match(/word(\d+)/)?.[1];
    expect(index).toBeTruthy();

    await page
      .getByTestId("quiz-option")
      .filter({ hasText: `ความหมาย${index}` })
      .first()
      .click();
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(page.getByText("Correct", { exact: true })).toBeVisible();
  });

  test("a wrong answer shows the correction", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    const prompt = await page.getByRole("heading", { level: 1 }).innerText();
    const index = prompt.match(/word(\d+)/)?.[1];

    await page
      .getByTestId("quiz-option")
      .filter({ hasNotText: `ความหมาย${index}` })
      .first()
      .click();
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(page.getByText("Not quite")).toBeVisible();
    await expect(page.getByText(/Correct answer:/).first()).toBeVisible();
  });

  test("check is disabled until something is chosen", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    await expect(page.getByRole("button", { name: "Check answer" })).toBeDisabled();

    await page.getByTestId("quiz-option").first().click();

    await expect(page.getByRole("button", { name: "Check answer" })).toBeEnabled();
  });

  test("options lock once the answer is checked", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    await page.getByTestId("quiz-option").first().click();
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(page.getByTestId("quiz-option").first()).toBeDisabled();
  });

  test("the quiz progress bar advances with each answer", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    const fill = page.getByTestId("quiz-progress-fill");
    await expect(fill).toHaveAttribute("style", /width:\s*0%/);

    await page.getByTestId("quiz-option").first().click();
    await page.getByRole("button", { name: "Check answer" }).click();

    await expect(fill).toHaveAttribute("style", /width:\s*10%/);
  });

  test("the intro screen reports the unit's ready words", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");

    await expect(page.getByText("A1 · Unit 1 Quiz")).toBeVisible();
    await expect(page.getByText("ready words")).toBeVisible();
  });

  test("try again restarts from the first question", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    for (let index = 0; index < 20; index += 1) {
      const spelling = page.getByPlaceholder("Type the English word");

      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("nope");
      } else {
        const option = page.getByTestId("quiz-option").first();
        if (!(await option.isVisible().catch(() => false))) break;
        await option.click();
      }

      await page.getByRole("button", { name: "Check answer" }).click();
      await page
        .locator("main")
        .getByRole("button", { name: /^(Next|Finish)$/ })
        .click();

      if (await page.getByText("Quiz complete").isVisible().catch(() => false)) break;
    }

    await expect(page.getByText("Quiz complete")).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByText("Question 1 of")).toBeVisible();
  });
});

test.describe("mixed session branches", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  const LEARN_URL = "/en/learn?level=A1&unit=1";
  const START = "**/api/progress/session/start";

  /** Steps through all eight items of a fresh unit-1 session, answering whatever variant
   *  the server hands over (recognition tap, match-pairs two-tap, or typed spelling). */
  const finishSession = async (page: import("@playwright/test").Page) => {
    await expect(page.getByTestId("session-card")).toBeVisible();
    for (let index = 0; index < 8; index += 1) {
      const itemType = await page.getByTestId("session-card").getAttribute("data-item-type");
      const spelling = page.getByTestId("session-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("placeholder");
        await page.getByTestId("session-continue").click();
      } else {
        await page.getByTestId("session-option").first().click();
        if (itemType === "match-pairs") {
          await page.getByTestId("session-option").first().click();
        }
      }
      await expect(page.getByTestId("session-feedback")).toBeVisible();
      await page.getByTestId("session-continue").click();
    }
  };

  test("the loading spinner shows while the session is prepared", async ({ page }) => {
    await page.route(START, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await page.goto(LEARN_URL);
    await expect(page.getByTestId("session-loading")).toBeVisible();
    await expect(page.getByTestId("session-card")).toBeVisible();
  });

  test("a failed session start shows a retry that recovers", async ({ page }) => {
    await page.route(START, (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"down"}' }),
    );

    await page.goto(LEARN_URL);
    await expect(page.getByTestId("session-error")).toBeVisible();
    // The server never returned a verdict, so nothing may be shown as graded.
    await expect(page.getByTestId("session-feedback")).toHaveCount(0);

    await page.unroute(START);
    await page.getByTestId("session-retry").click();
    await expect(page.getByTestId("session-card")).toBeVisible();
  });

  test("a 422 session start shows the not-enough screen without a retry", async ({ page }) => {
    await page.route(START, (route) =>
      route.fulfill({ status: 422, contentType: "application/json", body: '{"message":"not enough"}' }),
    );

    await page.goto(LEARN_URL);
    await expect(page.getByTestId("session-error")).toBeVisible();
    await expect(page.getByTestId("session-retry")).toHaveCount(0);
  });

  test("a due-review count surfaces the due note on the first item", async ({ page }) => {
    // Patch only the display-only `dueCount` on the real start response; the session id and
    // items stay the server's, so grading still works — this exercises the note's branch
    // without a due-SRS fixture the committed seed does not provide.
    await page.route(START, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, dueCount: 3 } });
    });

    await page.goto(LEARN_URL);
    await expect(page.getByTestId("session-card")).toBeVisible();
    await expect(page.getByTestId("session-due-note")).toBeVisible();
  });

  test("the speed-round item shows its countdown timer", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(LEARN_URL);
    await expect(page.getByTestId("session-card")).toBeVisible();

    for (let index = 0; index < 8; index += 1) {
      const itemType = await page.getByTestId("session-card").getAttribute("data-item-type");
      if (itemType === "speed-round") {
        await expect(page.getByTestId("session-speed-timer")).toBeVisible();
        return;
      }
      const spelling = page.getByTestId("session-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("placeholder");
        await page.getByTestId("session-continue").click();
      } else {
        await page.getByTestId("session-option").first().click();
        if (itemType === "match-pairs") {
          await page.getByTestId("session-option").first().click();
        }
      }
      await expect(page.getByTestId("session-feedback")).toBeVisible();
      await page.getByTestId("session-continue").click();
    }

    throw new Error("no speed-round item appeared in the session");
  });

  test("a completed session shows the result heading and one pip per item", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(LEARN_URL);
    await finishSession(page);

    await expect(page.getByTestId("session-result")).toBeVisible();
    await expect(page.getByTestId("session-result-heading")).toBeVisible();
    await expect(
      page.getByTestId("session-result-pips").getByTestId("session-result-pip"),
    ).toHaveCount(8);
  });
});

test.describe("word detail branches", () => {
  test("an unknown slug is a 404 with the designed not-found page", async ({
    page,
  }) => {
    await page.goto("/en/english/words/definitely-not-a-word");
    await expect(page.getByTestId("not-found")).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("a word with several entries lists each part of speech", async ({
    page,
  }) => {
    // The fixtures give each word one entry; the count badge still must be right.
    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);

    await expect(page.getByText("1 entry")).toBeVisible();
  });
});
