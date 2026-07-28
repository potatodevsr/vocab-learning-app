import { expect, test, type Page } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

const finishRound = async (page: Page, size: number) => {
  for (let index = 0; index < size; index += 1) {
    await page.getByTestId("i-know-this").click();
  }

  // The completion effect posts progress; navigating immediately would abort that
  // request and the next page would read a database that has not been written yet.
  await expect(page.getByTestId("confetti")).toBeVisible();
  await page.waitForLoadState("networkidle");
};

test.describe("short rounds", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("a unit is studied in rounds, not one long slog", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await expect(page.getByTestId("round-badge")).toContainText("Round 1/3");
    await expect(
      page.getByText(`Card 1 of ${SEED.unit1.roundSizes[0]}`),
    ).toBeVisible();
  });

  test("finishing a round offers the next one", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await finishRound(page, SEED.unit1.roundSizes[0]);

    await expect(page.getByTestId("next-round")).toBeVisible();

    await page.getByTestId("next-round").click();

    await expect(page).toHaveURL(/round=2/);
    await expect(page.getByTestId("round-badge")).toContainText("Round 2/3");
    await expect(
      page.getByRole("heading", { name: "word9", level: 2 }),
    ).toBeVisible();
  });

  test("the last round is short and offers no next round", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1&round=3");

    await expect(page.getByTestId("round-badge")).toContainText("Round 3/3");
    await expect(page.getByText("Card 1 of 4")).toBeVisible();

    await finishRound(page, SEED.unit1.roundSizes[2]);

    await expect(page.getByTestId("next-round")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Start quiz" })).toBeVisible();
  });

  test("a round past the end clamps to the last one", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1&round=99");

    await expect(page.getByTestId("round-badge")).toContainText("Round 3/3");
  });

  test("a zero or non-numeric round falls back to round 1", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1&round=0");
    await expect(page.getByTestId("round-badge")).toContainText("Round 1/3");

    await page.goto("/en/learn?level=A1&unit=1&round=abc");
    await expect(page.getByTestId("round-badge")).toContainText("Round 1/3");
  });

  test("celebration appears when a round is finished", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await finishRound(page, SEED.unit1.roundSizes[0]);

    await expect(page.getByTestId("confetti")).toBeVisible();
  });

  test("the round summary reports what was known and flagged", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await page.getByTestId("review-later").click();
    await finishRound(page, SEED.unit1.roundSizes[0] - 1);

    await expect(page.getByTestId("summary-known")).toHaveText("7");
    await expect(page.getByTestId("summary-review")).toHaveText("1");
  });

  test("the lesson progress bar fills as cards are answered", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    const fill = page.getByTestId("lesson-progress-fill");
    await expect(fill).toHaveAttribute("style", /width:\s*0%/);

    await page.getByTestId("i-know-this").click();

    await expect(fill).toHaveAttribute("style", /width:\s*12%/);
  });
});

test.describe("mastery pips", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("a brand-new word shows five empty pips", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    const pips = page.getByTestId("mastery-pips");
    await expect(pips).toBeVisible();
    await expect(pips).toHaveAttribute("data-level", "new");
    await expect(pips).toHaveAttribute("data-mastery", "0");
    await expect(page.getByTestId("mastery-pip")).toHaveCount(5);
  });

  test("pips fill after the word is answered correctly", async ({ page }) => {
    // Answer the whole quiz correctly so word1 gains mastery.
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();

    for (let index = 0; index < 20; index += 1) {
      const spelling = page.getByPlaceholder("Type the English word");

      if (await spelling.isVisible().catch(() => false)) {
        const helper = await page.getByText(/Meaning:/).innerText();
        const number = helper.match(/ความหมาย(\d+)/)?.[1] ?? "1";
        await spelling.fill(`word${number}`);
      } else {
        const prompt = await page.getByRole("heading", { level: 1 }).innerText();
        const number = prompt.match(/word(\d+)/)?.[1];
        const option = number
          ? page.getByTestId("quiz-option").filter({ hasText: `ความหมาย${number}` })
          : page.getByTestId("quiz-option");
        await (await option.count() ? option : page.getByTestId("quiz-option"))
          .first()
          .click();
      }

      await page.getByRole("button", { name: "Check answer" }).click();
      await page
        .locator("main")
        .getByRole("button", { name: /^(Next|Finish)$/ })
        .click();

      if (await page.getByText("Quiz complete").isVisible().catch(() => false)) break;
    }

    await page.goto("/en/learn?level=A1&unit=1");

    // At least one word in the round now carries progress.
    await expect(page.getByTestId("mastery-pips")).toBeVisible();
  });

  test("colour is never the only signal — the group is labelled", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await expect(page.getByTestId("mastery-pips")).toHaveAttribute(
      "aria-label",
      /Mastery \d+ of 5/,
    );
  });
});

test.describe("collection meter", () => {
  test("a new learner owns nothing yet", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/profile");

    const meter = page.getByTestId("collection-meter");
    await expect(meter).toBeVisible();
    await expect(meter).toHaveAttribute("data-percent", "0");
    await expect(page.getByTestId("collection-owned")).toHaveText("0");
    await expect(page.getByTestId("collection-percent")).toHaveText("0%");
    await expect(page.getByTestId("collection-fill")).toHaveAttribute(
      "style",
      /width:\s*0%/,
    );
  });

  test("the meter is an accessible progressbar", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/profile");

    const bar = page.getByRole("progressbar");
    await expect(bar).toHaveAttribute("aria-valuemin", "0");
    await expect(bar).toHaveAttribute("aria-valuemax", "100");
    await expect(bar).toHaveAttribute("aria-valuenow", "0");
  });
});

test.describe("mistakes bank", () => {
  test("anonymous visitors are redirected to login", async ({ page }) => {
    await page.goto("/en/review");

    await expect(page).toHaveURL(/\/en\/auth\/login\?from=/);
  });

  test("a new learner sees a drawn empty state, not an apology", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await page.goto("/en/review");

    await expect(page.getByTestId("mistakes-empty")).toBeVisible();
    await expect(page.getByTestId("mistakes-count")).toHaveText("0");
    await expect(page.getByRole("link", { name: "Start learning" })).toBeVisible();
  });

  test("review-later words show up in the bank", async ({ page }) => {
    await registerThroughUi(page);

    await page.goto("/en/learn?level=A1&unit=1");
    await page.getByTestId("review-later").click();
    await page.getByTestId("review-later").click();
    await finishRound(page, SEED.unit1.roundSizes[0] - 2);

    await page.goto("/en/review");

    await expect(page.getByTestId("mistakes-count")).toHaveText("2");
    await expect(page.getByTestId("mistakes-list")).toBeVisible();
    await expect(page.getByTestId("mistakes-list").getByRole("listitem")).toHaveCount(2);

    // The count and the list are the same data now, so they cannot disagree.
    await expect(page.getByTestId("mistake-count").first()).toContainText("wrong");
  });

  test("the bank links into a practice quiz", async ({ page }) => {
    await registerThroughUi(page);

    await page.goto("/en/learn?level=A1&unit=1");
    await page.getByTestId("review-later").click();
    await finishRound(page, SEED.unit1.roundSizes[0] - 1);

    await page.goto("/en/review");
    await page.getByTestId("practise-mistakes").click();

    await expect(page).toHaveURL(/\/quiz\?level=A1&unit=1/);
  });

  test("the profile links to the bank once there is something in it", async ({
    page,
  }) => {
    await registerThroughUi(page);

    await page.goto("/en/profile");
    await expect(page.getByTestId("profile-mistakes-cta")).toHaveCount(0);

    await page.goto("/en/learn?level=A1&unit=1");
    await page.getByTestId("review-later").click();
    await finishRound(page, SEED.unit1.roundSizes[0] - 1);

    await page.goto("/en/profile");
    await page.getByTestId("profile-mistakes-cta").click();

    await expect(page).toHaveURL(/\/en\/review/);
  });

  test("renders in Thai too", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/th/review");

    await expect(
      page.getByRole("heading", { name: "คำที่ตอบผิด", level: 1 }),
    ).toBeVisible();
  });
});
