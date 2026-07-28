import { expect, test } from "@playwright/test";

test("learner pages load the configured Google Analytics tag", async ({ page }) => {
  await page.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ status: 204 }),
  );

  await page.goto("/en");

  await expect(
    page.locator(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-E2ETEST"]',
    ),
  ).toHaveCount(1);
  // Playwright's toContainText reads rendered innerText, which is deliberately empty for
  // script elements. Inspect the script payload itself.
  expect(
    await page.locator("script#google-analytics").textContent(),
  ).toContain("gtag('config', 'G-E2ETEST')");
});

test("admin pages do not load Google Analytics", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(
    page.locator('script[src*="googletagmanager.com/gtag/js"]'),
  ).toHaveCount(0);
  await expect(page.locator("script#google-analytics")).toHaveCount(0);
});
