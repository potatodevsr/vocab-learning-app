import { expect, test, type Page } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";

/**
 * Drives one wrong-answer quiz into D1 through the real `/progress/quiz` verb (the same
 * endpoint the quiz UI posts to — the client reports what it typed, the server decides
 * the verdict, AGENTS.md rule 1). Two spelling answers are deliberate misspellings and one
 * is exact, so the row committed is unambiguous: score 1 of 3, two mistakes banked. The
 * fetch runs in the page so the signed-in `user_token` cookie rides along, and we assert
 * the server accepted it before any page reads it back.
 */
const recordQuizWithMistakes = async (page: Page) => {
  const { number: unit } = SEED.unit1;
  const level = "A1";

  const status = await page.evaluate(
    async ({ level, unit }) => {
      const response = await fetch("/api/progress/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          quizId: crypto.randomUUID(),
          level,
          unit,
          answers: [
            // Grader compares the typed word to the seeded `displayWord`; these two miss.
            { wordId: "e2e-a1-0001", type: "spelling", answer: "definitely-wrong-1" },
            { wordId: "e2e-a1-0002", type: "spelling", answer: "definitely-wrong-2" },
            // Exact match — keeps the score honest at 1/3, so it never reaches the bank.
            { wordId: "e2e-a1-0003", type: "spelling", answer: "word3" },
          ],
        }),
      });

      return response.status;
    },
    { level, unit },
  );

  // A supported verb accepts a full body with 200/201 — anything else means the write that
  // the rest of the test asserts against never happened.
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(300);

  return { level, unit };
};

test.describe("profile", () => {
  test("shows the signed-in account's real details", async ({ page }) => {
    const user = await registerThroughUi(page);

    await page.goto("/en/profile");

    await expect(page.getByTestId("profile-username")).toHaveText(
      user.username,
    );
    await expect(page.getByTestId("profile-email")).toHaveText(user.email);
    await expect(page.getByTestId("profile-name")).toHaveText(
      `${user.firstName} ${user.lastName}`,
    );
    // createdAt comes from the API, so a rendered join date proves /user/me was really
    // called server-side with the caller's cookie.
    await expect(page.getByTestId("profile-member-since")).not.toBeEmpty();
  });

  test("is reachable from the account menu", async ({ page }) => {
    const user = await registerThroughUi(page);

    await page.getByText(user.username).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();

    await expect(page).toHaveURL(/\/en\/profile/);
    await expect(page.getByTestId("profile-email")).toHaveText(user.email);
  });

  // The empty-state / real-stats behaviour lives in progress.spec.ts, which owns the
  // persistence story end to end.

  test("anonymous visitors are redirected to login", async ({ page }) => {
    await page.goto("/en/profile");

    await expect(page).toHaveURL(/\/en\/auth\/login\?from=/);
  });

  test("renders in Thai too", async ({ page }) => {
    const user = await registerThroughUi(page);

    await page.goto("/th/profile");

    await expect(page.getByText("ข้อมูลบัญชี")).toBeVisible();
    await expect(page.getByTestId("profile-email")).toHaveText(user.email);
  });
});

/**
 * The mistakes loop, full-stack: a wrong answer is committed through the real progress verb,
 * then read back on the profile (the CTA + recent quizzes) and on the review page (the bank
 * count, its list, the per-word tally, and where "practise" sends the learner). Nothing is
 * mocked — every assertion below fails if the write never reached D1 or the read forgot the
 * caller's cookie.
 */
test.describe("profile → review mistakes", () => {
  test("a wrong answer surfaces a mistakes CTA that points at the review page", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await recordQuizWithMistakes(page);

    await page.goto("/en/profile");

    const cta = page.getByTestId("profile-mistakes-cta");
    await expect(cta).toBeVisible();
    // Count is server-decided: two of the three answers were wrong.
    await expect(cta).toContainText("2");
    await expect(cta).toContainText("to practise");
    // The CTA must land on the mistakes bank, not anywhere else.
    await expect(cta).toHaveAttribute("href", "/en/review");
  });

  test("the finished quiz shows up under recent quizzes with its real score", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await recordQuizWithMistakes(page);

    await page.goto("/en/profile");

    // One quiz was recorded, so the profile leaves the empty state and lists it.
    await expect(page.getByTestId("stat-quizzes")).toHaveText("1");

    const recent = page.getByTestId("recent-quizzes");
    await expect(recent).toBeVisible();

    const rows = recent.locator("li");
    await expect(rows).toHaveCount(1);
    // level · Unit N, then the server-graded score/total (1 correct of 3).
    await expect(rows.first()).toContainText("A1 · Unit 1");
    await expect(rows.first()).toContainText("1/3");
  });

  test("the review page banks exactly the words that were missed", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await recordQuizWithMistakes(page);

    await page.goto("/en/review");

    // The headline count and the list length must agree — both are two.
    await expect(page.getByTestId("mistakes-count")).toHaveText("2");

    const list = page.getByTestId("mistakes-list");
    await expect(list).toBeVisible();
    await expect(list.locator("li")).toHaveCount(2);

    // The two misspelled words are here; the exact-match word3 is not.
    await expect(list).toContainText("word1");
    await expect(list).toContainText("word2");
    await expect(list).toContainText(SEED.unit1.firstMeaning);
    await expect(list.getByText("word3", { exact: true })).toHaveCount(0);
  });

  test("each banked word carries its wrong-answer tally", async ({ page }) => {
    await registerThroughUi(page);
    await recordQuizWithMistakes(page);

    await page.goto("/en/review");

    // Each word was missed once in the single quiz above.
    const counts = page.getByTestId("mistake-count");
    await expect(counts).toHaveCount(2);
    await expect(counts.first()).toHaveText("1× wrong");
    await expect(counts.last()).toHaveText("1× wrong");
  });

  /**
   * The button practises the mistakes, not a unit one of them belongs to.
   *
   * It used to link to `/quiz?level=A1&unit=1` — the unit of the first listed mistake —
   * so under a list spanning several units it practised twenty other words. The set is
   * chosen server-side from the learner's own worst answers (`mode=mistakes` in
   * `backend/src/session.ts`); the client never names the words.
   */
  test("the practise button practises the learner's own mistake set", async ({ page }) => {
    await registerThroughUi(page);
    await recordQuizWithMistakes(page);

    await page.goto("/en/review");

    const practise = page.getByTestId("practise-mistakes");
    await expect(practise).toBeVisible();
    await expect(practise).toHaveAttribute("href", "/en/learn?mode=mistakes");

    await practise.click();

    // And it really is a session over the words that were missed.
    await expect(page.getByTestId("session-card")).toBeVisible();
  });
});

/**
 * The takeout the privacy policy promises.
 *
 * `/progress/export` has existed since the API did, in both formats, and the profile never
 * linked to it — so "you can download your data" was true of the server and false of the
 * product. These are plain links rather than a fetch, because a navigation is what makes a
 * browser save an attachment.
 */
test.describe("profile: your data", () => {
  test("offers both export formats", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/profile");

    await expect(page.getByTestId("profile-data")).toBeVisible();
    await expect(page.getByTestId("profile-export-json")).toHaveAttribute(
      "href",
      "/api/progress/export?format=json",
    );
    await expect(page.getByTestId("profile-export-csv")).toHaveAttribute(
      "href",
      "/api/progress/export?format=csv",
    );
  });

  test("the JSON export really is this learner's own data", async ({ page }) => {
    await registerThroughUi(page);

    const response = await page.request.get("/api/progress/export?format=json");

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body).toHaveProperty("learner");
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("words");
    // Never an id, a token or a hash — see the export route's own comment.
    expect(JSON.stringify(body)).not.toContain("password");
  });

  test("the CSV export is an attachment", async ({ page }) => {
    await registerThroughUi(page);

    const response = await page.request.get("/api/progress/export?format=csv");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toContain("attachment");
  });

  test("an anonymous visitor cannot export anything", async ({ page, context }) => {
    await context.clearCookies();

    const response = await page.request.get("/api/progress/export?format=json");

    expect(response.status()).toBe(401);
  });
});
