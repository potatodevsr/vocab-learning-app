import { expect, test } from "@playwright/test";

test("locale controls wait for query state before becoming interactive", async ({ page }) => {
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/en/auth/login?from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview", { waitUntil: "commit" });
    await expect(page.locator('span[aria-disabled="true"]').filter({ hasText: /^TH$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "TH", exact: true })).toHaveCount(0);
    releaseScripts();
    const switcher = page.getByRole("link", { name: "TH", exact: true });
    await expect(switcher).toHaveAttribute("href", "/th/auth/login?from=%2Fth%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview");
    await switcher.click();
    await expect(page).toHaveURL(/\/th\/auth\/login\?from=/);
    expect(new URL(page.url()).searchParams.get("from")).toBe("/th/learn?level=A1&unit=45&mode=review");
  } finally {
    releaseScripts();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("locale switching keeps search and header authentication intent", async ({ page }) => {
  await page.goto("/en/english/search?q=about");
  const switcher = page.getByRole("banner").getByRole("link", { name: "TH", exact: true });
  await expect(switcher).toHaveAttribute("href", "/th/english/search?q=about");
  await switcher.click();
  await expect(page).toHaveURL(/\/th\/english\/search\?q=about$/);
  const login = page.locator('a[href*="/auth/login?from="]').first();
  await expect(login).toHaveAttribute("href", "/th/auth/login?from=%2Fth%2Fenglish%2Fsearch%3Fq%3Dabout");
});

test("auth language switch localizes and preserves the requested session", async ({ page }) => {
  await page.goto("/en/auth/login?from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview");
  await page.getByRole("link", { name: "TH", exact: true }).click();
  await expect(page).toHaveURL(/\/th\/auth\/login\?from=/);
  expect(new URL(page.url()).searchParams.get("from")).toBe("/th/learn?level=A1&unit=45&mode=review");
  await page.getByRole("link", { name: "TH", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("from")).toBe("/th/learn?level=A1&unit=45&mode=review");
});
