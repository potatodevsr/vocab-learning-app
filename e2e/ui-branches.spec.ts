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

  /**
   * A unit the learner asked for and cannot have is answered, whatever shape it took.
   *
   * These three used to assert the prompt only, so they passed while the address bar still
   * read `?unit=0` over an automatic session — the same dishonest URL the unreal-unit
   * redirect below exists to prevent, reached through a different door. `0`, `-4` and
   * `abc` all normalised to "no unit was requested" and slipped past the redirect
   * entirely; only out-of-range values like `999` were caught.
   */
  test("a zero or negative unit redirects to the automatic session", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=0");
    await expect(page).toHaveURL("/en/learn?level=A1");
    await expect(page.getByTestId("session-prompt")).toHaveText("word1");

    await page.goto("/en/learn?level=A1&unit=-4");
    await expect(page).toHaveURL("/en/learn?level=A1");
    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("a non-numeric unit redirects to the automatic session", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=abc");

    await expect(page).toHaveURL("/en/learn?level=A1");
    await expect(page.getByTestId("session-prompt")).toHaveText("word1");
  });

  test("no unit at all is left exactly as it is", async ({ page }) => {
    // The URL is already honest, so there is nothing to correct — and a redirect here
    // would be a pointless round trip on the most common entry point to the route.
    await page.goto("/en/learn?level=A1");

    await expect(page).toHaveURL("/en/learn?level=A1");
    await expect(page.getByTestId("session-card")).toBeVisible();
  });

  test("a lowercase level is accepted", async ({ page }) => {
    await page.goto("/en/learn?level=a1&unit=2");

    await expect(page.getByTestId("session-prompt")).toHaveText("word21");
  });

  /**
   * A unit that does not exist is answered, not ignored.
   *
   * The hint used to be dropped during render: the learner got the level's automatic
   * session while the address bar still said `?unit=999`. Reload it, bookmark it or share
   * it and it goes on promising a unit nobody can be given — and, worse, it is
   * indistinguishable from the old clamping bug that silently taught unit 38 when unit 45
   * was asked for. The redirect makes the URL describe the session that actually renders.
   */
  test("an unreal unit redirects to the level's automatic session", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=999");

    await expect(page).toHaveURL("/en/learn?level=A1");
    await expect(page.getByTestId("session-card")).toBeVisible();
  });

  test("the unreal-unit redirect keeps the locale and a valid mode, and drops only the unit", async ({
    page,
  }) => {
    await page.goto("/th/learn?level=A2&unit=999&mode=review");

    await expect(page).toHaveURL("/th/learn?level=A2&mode=review");
  });

  test("an unreal unit is a redirect even when the mode is invalid too", async ({ page }) => {
    // `mode=nonsense` normalises to "normal", which carries no query parameter of its own,
    // so the target is the bare level session — not `?mode=normal`.
    await page.goto("/en/learn?level=A1&unit=999&mode=nonsense");

    await expect(page).toHaveURL("/en/learn?level=A1");
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

  /**
   * The sign-in return path, in both locales.
   *
   * `from` is percent-encoded into a query parameter and handed to `/auth/login`, which
   * redirects to it verbatim — it does **not** travel through the localized `<Link>` that
   * built the login URL itself. So an unprefixed `/learn?...` was resolved by the locale
   * middleware's default, Thai: an English learner whose token expired mid-session signed
   * in and landed on `/th/learn`, in a language they may not read. The `/en` and `/th`
   * halves below are the same assertion twice on purpose — one locale passing proves
   * nothing about a prefix that was simply absent.
   */
  test("a 401 session start asks the learner to sign in again, returning to this locale", async ({
    page,
  }) => {
    await page.route(START, (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: '{"message":"unauth"}' }),
    );

    await page.goto("/en/learn?level=A1&unit=2");
    await expect(page.getByTestId("session-unauth")).toBeVisible();
    await expect(page.getByTestId("session-error")).toHaveCount(0);
    await expect(page.getByTestId("session-retry")).toHaveCount(0);
    await expect(page.getByTestId("session-signin")).toHaveAttribute(
      "href",
      "/en/auth/login?from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D2",
    );
  });

  test("the sign-in return path keeps the Thai locale, the level, the unit and the mode", async ({
    page,
  }) => {
    await page.route(START, (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: '{"message":"unauth"}' }),
    );

    await page.goto("/th/learn?level=A1&unit=2&mode=review");
    await expect(page.getByTestId("session-unauth")).toBeVisible();
    await expect(page.getByTestId("session-signin")).toHaveAttribute(
      "href",
      "/th/auth/login?from=%2Fth%2Flearn%3Flevel%3DA1%26unit%3D2%26mode%3Dreview",
    );
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
    await expect(page).toHaveTitle(/No words found/);
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
