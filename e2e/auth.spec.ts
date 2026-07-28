import { expect, test } from "@playwright/test";

import { loginThroughUi, registerThroughUi } from "./support/actions";

test.describe("authentication", () => {
  test("registering writes a real account that can log in again", async ({
    page,
    context,
  }) => {
    const user = await registerThroughUi(page);

    // Registration logs you straight in — the navbar switches to the account menu.
    await expect(page.getByText(user.username)).toBeVisible();

    // Prove the row is really persisted: drop the session and log in fresh.
    await context.clearCookies();
    await loginThroughUi(page, user);

    await page.goto("/en");
    await expect(page.getByText(user.username)).toBeVisible();
  });

  test("wrong password is rejected", async ({ page }) => {
    const user = await registerThroughUi(page);
    await page.context().clearCookies();

    await page.goto("/en/auth/login");
    await page.fill("#email", user.email);
    await page.fill("#password", "Definitely!Wrong9");
    await page.click('button[type="submit"]');

    // SweetAlert2 surfaces the API's message; we stay on the login page.
    await expect(page.locator(".swal2-popup")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("protected routes redirect anonymous visitors to login", async ({
    page,
  }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    await expect(page).toHaveURL(/\/en\/auth\/login\?from=/);
  });

  test("logging out clears the session", async ({ page }) => {
    const user = await registerThroughUi(page);

    await page.getByText(user.username).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();

    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    // And the protected route is protected again.
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
