import { expect, test } from "@playwright/test";

import { newUser, SEED } from "./support/fixtures";
import { registerThroughUi } from "./support/actions";

const finishTrial = async (page: import("@playwright/test").Page) => {
  for (let index = 0; index < 5; index += 1) {
    await expect(page.getByTestId("practice-counter")).toContainText(`${index + 1} of 5`);
    await page.getByTestId("practice-option").first().click();
    await expect(page.getByTestId("practice-feedback")).toBeVisible();
    await expect(page.getByTestId("practice-pip").nth(index)).toHaveAttribute(
      "data-filled",
      "true",
    );
    await page.getByTestId("practice-continue").click();
  }
  await expect(page.getByTestId("practice-result")).toBeVisible();
};

test.describe("public practice journey", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("feedback speaks the correct Thai meaning by click and keyboard without advancing", async ({ page }) => {
    await page.goto("/en/english/a1/unit/1/practice");
    await expect(page.getByTestId("practice-option")).toHaveCount(4);

    // Observe the browser speech boundary; the question and verdict use the real API.
    await page.evaluate(() => {
      Object.defineProperty(window.speechSynthesis, "speak", {
        configurable: true,
        value: (utterance: SpeechSynthesisUtterance) => {
          document.body.dataset.spokenThai = utterance.text;
          document.body.dataset.spokenLanguage = utterance.lang;
          document.body.dataset.speechCount = String(Number(document.body.dataset.speechCount ?? 0) + 1);
          utterance.onstart?.(new Event("start") as SpeechSynthesisEvent);
        },
      });
      Object.defineProperty(window.speechSynthesis, "cancel", {
        configurable: true,
        value: () => {
          document.body.dataset.cancelCount = String(Number(document.body.dataset.cancelCount ?? 0) + 1);
        },
      });
    });

    for (const [index, answerCorrectly] of [false, true].entries()) {
      await expect(page.getByTestId("practice-counter")).toContainText(`${index + 1} of 5`);
      await expect(page.getByTestId("thai-meaning-audio")).toHaveCount(0);
      const prompt = await page.getByTestId("practice-prompt").innerText();
      const meaning = `ความหมาย${prompt.replace("word", "")}`;
      const options = page.getByTestId("practice-option");
      const meanings = await options.locator('span[lang="th"]').allTextContents();
      const choice = meanings.findIndex(value => answerCorrectly ? value === meaning : value !== meaning);
      expect(choice).toBeGreaterThanOrEqual(0);
      await options.nth(choice).click();

      const feedback = page.getByTestId("practice-feedback");
      const audio = feedback.getByRole("button", { name: `Listen to the Thai “${meaning}”`, exact: true });
      await expect(audio).toBeVisible();
      await audio.click();
      await expect(page.locator("body")).toHaveAttribute("data-spoken-thai", meaning);
      await expect(page.locator("body")).toHaveAttribute("data-spoken-language", "th-TH");
      await expect(audio).toHaveAttribute("aria-pressed", "true");
      await audio.press("Enter");
      await expect(page.locator("body")).toHaveAttribute("data-speech-count", String((index + 1) * 2));
      await expect(page.getByTestId("practice-counter")).toContainText(`${index + 1} of 5`);

      const cancellations = Number(await page.locator("body").getAttribute("data-cancel-count"));
      await page.getByTestId("practice-continue").click();
      await expect(feedback).toHaveCount(0);
      await expect(page.locator("body")).toHaveAttribute("data-cancel-count", String(cancellations + 1));
    }
  });

  test("claim stays visibly saving until the server confirms", async ({ page }) => {
    await registerThroughUi(page);
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/practice/claim", async route => {
      await held;
      await route.continue();
    });
    try {
      await page.goto("/en/english/a1/practice");
      await finishTrial(page);
      await expect(page.getByTestId("practice-claim-status")).toHaveText("Saving your progress…");
      await expect(page.getByTestId("practice-saved")).toHaveCount(0);
    } finally {
      release();
    }
    await expect(page.getByTestId("practice-saved")).toBeVisible();
  });

  test("failed claim is not saved, never auto-loops, and can be retried", async ({ page }) => {
    await registerThroughUi(page);
    let claims = 0;
    await page.route("**/api/practice/claim", async route => {
      claims += 1;
      await route.fulfill({ status: 503, json: { message: "unavailable" } });
    });
    await page.goto("/en/english/a1/practice");
    await finishTrial(page);
    await expect(page.getByTestId("practice-claim-status")).toContainText("could not be saved");
    await expect(page.getByTestId("practice-saved")).toHaveCount(0);
    // Negative timing assertion: the old effect retried on a zero-delay timer forever.
    // Allow that timer several turns before proving no automatic second request happened.
    await page.waitForTimeout(500);
    await expect(page.getByTestId("practice-claim-retry")).toBeVisible();
    expect(claims).toBe(1);
    await page.unroute("**/api/practice/claim");
    await page.getByTestId("practice-claim-retry").click();
    await expect(page.getByTestId("practice-saved")).toBeVisible();
  });

  test("expired claim explains recovery without claiming success", async ({ page }) => {
    await registerThroughUi(page);
    await page.route("**/api/practice/claim", route =>
      route.fulfill({ status: 404, json: { message: "expired" } }));
    await page.goto("/en/english/a1/practice");
    await finishTrial(page);
    await expect(page.getByTestId("practice-claim-status")).toContainText("can no longer be saved");
    await expect(page.getByTestId("practice-saved")).toHaveCount(0);
    await expect(page.getByTestId("practice-claim-retry")).toHaveCount(0);
    await expect(page.getByTestId("practice-result").getByRole("link", { name: "Continue", exact: true })).toBeVisible();
  });

  test("word landing reaches a five-item trial, signup, and one saved claim", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const user = newUser();

    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);
    const cta = page.getByTestId("word-practice-cta");
    await expect(cta).toBeVisible();
    await cta.click();
    // On the shared host the final trace snapshot showed this exact route just after
    // the default 10s deadline. Keep the destination assertion, using the same bounded
    // navigation budget as the signup return below; never retry the click blindly.
    await expect(page).toHaveURL(/\/en\/english\/a1\/unit\/1\/practice$/, { timeout: 20_000 });

    await expect(page.getByTestId("practice-option")).toHaveCount(4);
    await finishTrial(page);
    await expect(page.getByTestId("result-heading")).toContainText("of 5 recalled");

    await page.getByTestId("save-progress-cta").click();
    await expect(page).toHaveURL(/\/en\/auth\/register\?from=/);
    await page.fill("#firstName", user.firstName);
    await page.fill("#lastName", user.lastName);
    await page.fill("#email", user.email);
    await page.fill("#username", user.username);
    await page.fill("#password", user.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/en\/english\/a1\/unit\/1\/practice$/, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("practice-result")).toBeVisible();
    await expect(page.getByTestId("practice-saved")).toBeVisible();

    const summary = await page.evaluate<{ wordsSeen: number }>(async () =>
      fetch("/api/progress/summary", { credentials: "include" }).then((response) =>
        response.json(),
      ),
    );
    expect(summary.wordsSeen).toBe(5);
  });

  test("Thai keyboard answer is server-graded and refresh resumes at the next item", async ({
    page,
  }) => {
    await page.goto("/th/english/a1/practice");
    await expect(page.getByTestId("practice-option").first()).toBeVisible();

    await page.keyboard.press("1");
    await expect(page.getByTestId("practice-feedback")).toBeVisible();
    await expect(page.getByTestId("practice-continue")).toContainText("ดำเนินการต่อ");
    await page.getByTestId("practice-continue").click();

    await page.reload();
    await expect(page.getByTestId("practice-counter")).toContainText("ข้อ 2 จาก 5");
    await expect(page.getByTestId("practice-pip").first()).toHaveAttribute(
      "data-filled",
      "true",
    );

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("practice-close-confirm")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("practice-close-confirm")).toHaveCount(0);
  });

  test("a failed start shows a retry path and does not guess an answer", async ({ page }) => {
    await page.route("**/api/practice/start", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"down"}' }),
    );
    await page.goto("/en/english/a1/practice");
    await expect(page.getByTestId("practice-error")).toBeVisible();
    await expect(page.getByTestId("practice-feedback")).toHaveCount(0);

    await page.unroute("**/api/practice/start");
    await page.getByTestId("practice-retry").click();
    await expect(page.getByTestId("practice-option").first()).toBeVisible();
  });
});

/**
 * The `PracticeSession` render branches the happy-path journey above never dwells on: the
 * loading spinner, the 429 "already in progress elsewhere" block, and the full result
 * summary (insight line, per-item pips, and the next-unit preview).
 */
test.describe("public practice UI branches", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the loading spinner shows while the trial is being prepared", async ({ page }) => {
    // Hold the start response open long enough to observe the loading branch, then let it
    // through so the real trial renders — no mocked payload.
    await page.route("**/api/practice/start", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    await page.goto("/en/english/a1/practice");
    await expect(page.getByTestId("practice-loading")).toBeVisible();
    await expect(page.getByTestId("practice-card")).toBeVisible();
  });

  test("a 429 start shows the already-in-progress block, not an error", async ({ page }) => {
    await page.route("**/api/practice/start", (route) =>
      route.fulfill({ status: 429, contentType: "application/json", body: '{"message":"rate limited"}' }),
    );

    await page.goto("/en/english/a1/practice");
    await expect(page.getByTestId("practice-blocked")).toBeVisible();
    await expect(page.getByTestId("practice-error")).toHaveCount(0);
  });

  test("the trial renders its card and prompt and the full result summary", async ({ page }) => {
    await page.goto("/en/english/a1/practice");
    await expect(page.getByTestId("practice-card")).toBeVisible();
    await expect(page.getByTestId("practice-prompt")).toBeVisible();

    for (let index = 0; index < 5; index += 1) {
      await page.getByTestId("practice-option").first().click();
      await expect(page.getByTestId("practice-feedback")).toBeVisible();
      await page.getByTestId("practice-continue").click();
    }

    await expect(page.getByTestId("practice-result")).toBeVisible();
    await expect(page.getByTestId("result-insight")).toBeVisible();
    await expect(page.getByTestId("result-next-preview")).toBeVisible();
    await expect(
      page.getByTestId("result-pips").getByTestId("result-pip"),
    ).toHaveCount(5);
  });
});

/**
 * The practice landing copy that satisfies the search query and the substance floor
 * before any interactive trial (docs/LEARNER-LIFECYCLE.md §5.3): the "no signup needed"
 * reassurance, the sample-words preview, and the explore-the-level link. All public.
 */
test.describe("public practice landing content", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the level practice page reassures, previews words, and links back to the level", async ({
    page,
  }) => {
    await page.goto("/en/english/a1/practice");

    await expect(page.getByTestId("no-signup-clause")).toBeVisible();

    // The preview is a real list built from published words — never empty, or the
    // substance floor is unmet.
    const samples = page.getByTestId("practice-sample-words");
    await expect(samples).toBeVisible();
    expect(await samples.locator("li").count()).toBeGreaterThan(0);

    const explore = page.getByTestId("explore-level-link");
    await expect(explore).toBeVisible();
    await expect(explore).toHaveAttribute("href", /\/english\/a1$/);
  });

  test("the unit practice page carries the same no-signup reassurance", async ({
    page,
  }) => {
    await page.goto(`/en/english/a1/unit/${SEED.unit1.number}/practice`);

    await expect(page.getByTestId("no-signup-clause")).toBeVisible();
  });
});
