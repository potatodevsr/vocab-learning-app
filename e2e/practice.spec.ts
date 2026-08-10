import { expect, test } from "@playwright/test";

import { newUser, SEED } from "./support/fixtures";

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

  test("word landing reaches a five-item trial, signup, and one saved claim", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const user = newUser();

    await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);
    const cta = page.getByTestId("word-practice-cta");
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/en\/english\/a1\/unit\/1\/practice$/);

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

    const summary = await page.evaluate(async () =>
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
