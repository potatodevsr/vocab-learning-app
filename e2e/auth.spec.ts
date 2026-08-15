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

  /**
   * An unknown address now receives a sign-up link rather than nothing, so the screen it
   * lands on must be the one a registered address sees — that sameness is the point. It is
   * no longer meaningful to assert the dev link is absent: its absence *was* the tell.
   */
  test("an unknown email gets the same inbox confirmation", async ({ page }) => {
    await page.goto("/en/auth/login");
    await page.fill("#email", `no-account-${Date.now()}@example.com`);
    await page.click('button[type="submit"]');

    await expect(page.getByTestId("magic-link-sent")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("a link sent to a brand-new address creates the account and signs in", async ({
    page,
  }) => {
    const email = `signup-${Date.now()}@example.com`;

    await page.goto("/en/auth/login");
    await page.fill("#email", email);
    await page.click('button[type="submit"]');

    await page.getByTestId("dev-magic-link").click();

    // The link carries no `from`, so verification lands back on the locale root. Wait for
    // that before asserting — the account menu only mounts once the session cookie is set.
    await expect(page).toHaveURL(/\/en$/, { timeout: 20_000 });

    // Landing signed in is the whole point: before this, the only way to create an
    // account was the five-field password form. The username was derived from the
    // address, since nothing asked for one.
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(email.split("@")[0].replace(/-/g, ""))).toBeVisible();
  });

  test("a magic link signs in once and preserves the requested destination", async ({
    page,
    context,
  }) => {
    const user = await registerThroughUi(page);
    await context.clearCookies();

    await page.goto("/en/auth/login?from=%2Fen%2Fprofile");
    await page.fill("#email", user.email);
    await page.click('button[type="submit"]');
    await page.getByTestId("dev-magic-link").click();

    await expect(page).toHaveURL(/\/en\/profile$/, { timeout: 20_000 });
    await expect(page.getByText(user.username)).toBeVisible();
  });

  test("invalid verification links explain recovery in both locales", async ({
    page,
  }) => {
    await page.goto("/en/auth/verify");
    await expect(page.getByTestId("magic-verify-invalid")).toContainText(
      "This link can’t be used",
    );
    await expect(page.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
      "href",
      "/en/auth/login",
    );

    await page.goto("/th/auth/verify");
    await expect(page.getByTestId("magic-verify-invalid")).toContainText(
      "ไม่สามารถใช้ลิงก์นี้ได้",
    );
    await expect(page.getByRole("link", { name: "ขอลิงก์ใหม่" })).toHaveAttribute(
      "href",
      "/th/auth/login",
    );
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
