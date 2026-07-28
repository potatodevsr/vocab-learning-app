import { expect, type Page } from "@playwright/test";

import { newUser } from "./fixtures";

/**
 * Registers a brand-new account through the real form. The row is really written to
 * D1, and the app logs the user in and redirects home on success.
 */
export const registerThroughUi = async (page: Page) => {
  const user = newUser();

  await page.goto("/en/auth/register");

  await page.fill("#firstName", user.firstName);
  await page.fill("#lastName", user.lastName);
  await page.fill("#email", user.email);
  await page.fill("#username", user.username);
  await page.fill("#password", user.password);

  await page.click('button[type="submit"]');
  await page.waitForURL("**/en", { timeout: 20_000 });

  return user;
};

export const loginThroughUi = async (
  page: Page,
  user: { email: string; password: string },
) => {
  await page.goto("/en/auth/login");
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), {
    timeout: 20_000,
  });
};

export const loginAsAdmin = async (
  page: Page,
  admin: { username: string; password: string },
) => {
  await page.goto("/admin/login");
  await page.fill("#username", admin.username);
  await page.fill("#password", admin.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin\/(dashboard|vocabulary)/, {
    timeout: 20_000,
  });
};
