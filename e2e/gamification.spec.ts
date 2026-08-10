import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
test.describe("mixed-session progress", () => {
  test.beforeEach(async ({ page }) => {
    await registerThroughUi(page);
  });

  test("a unit is studied in one bounded eight-item session", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
    await expect(page.getByTestId("session-pip")).toHaveCount(8);
    await expect(page.getByTestId("session-card")).toHaveAttribute(
      "data-item-type",
      "choose-meaning",
    );
  });
});

test("the lesson card does not show unexplained mastery pips", async ({ page }) => {
  await registerThroughUi(page);
  await page.goto("/en/learn?level=A1&unit=1");
  await expect(page.getByTestId("mastery-pips")).toHaveCount(0);
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

  test("renders in Thai too", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/th/review");

    await expect(
      page.getByRole("heading", { name: "คำที่ตอบผิด", level: 1 }),
    ).toBeVisible();
  });
});
