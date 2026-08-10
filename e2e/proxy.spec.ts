import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";
import { loginAsAdmin } from "./support/actions";

/**
 * Route protection in the request middleware. Every branch of the matcher and both role checks — this
 * is the file where a missing `role` check let a learner into /admin.
 */
test.describe("proxy: learner-protected paths", () => {
  for (const path of ["/learn?level=A1&unit=1", "/quiz?level=A1&unit=1", "/profile"]) {
    test(`anonymous is redirected away from ${path.split("?")[0]}`, async ({
      page,
    }) => {
      await page.goto(`/en${path}`);

      await expect(page).toHaveURL(/\/en\/auth\/login\?from=/);
    });
  }

  test("the redirect preserves where you were going", async ({ page }) => {
    await page.goto("/en/profile");

    expect(decodeURIComponent(page.url())).toContain("from=/en/profile");
  });

  test("the same protection applies under the Thai locale", async ({ page }) => {
    await page.goto("/th/profile");

    await expect(page).toHaveURL(/\/th\/auth\/login\?from=/);
  });

  test("a signed-in learner passes through", async ({ page }) => {
    await registerThroughUi(page);

    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();
    await expect(page.getByTestId("session-counter")).toHaveText("1 of 8");
  });

  test("a tampered learner cookie is not accepted", async ({ page, context }) => {
    await registerThroughUi(page);

    const cookies = await context.cookies();
    const token = cookies.find((c) => c.name === "user_token")?.value as string;

    await context.clearCookies();
    await context.addCookies([
      {
        name: "user_token",
        value: `${token.slice(0, -4)}AAAA`,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/en/profile");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("proxy: public paths", () => {
  for (const path of ["/en", "/th", "/en/english/a1", "/en/auth/login", "/en/auth/register"]) {
    test(`${path} is reachable without a session`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      expect(page.url()).not.toContain("/auth/login?from=");
    });
  }

  test("an unknown locale prefix is not treated as protected", async ({ page }) => {
    // Only /en and /th are matched; anything else falls through to next-intl.
    const response = await page.goto("/fr/learn");

    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("proxy: admin paths", () => {
  test("the login page is reachable without a cookie", async ({ page }) => {
    const response = await page.goto("/admin/login");

    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/admin/login");
  });

  for (const path of ["/admin/dashboard", "/admin/vocabulary", "/admin/users"]) {
    test(`anonymous is redirected away from ${path}`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/admin\/login/);
    });
  }

  test("an admin passes through", async ({ page }) => {
    await loginAsAdmin(page, SEED.admin);

    await page.goto("/admin/vocabulary");
    await expect(page).toHaveURL(/\/admin\/vocabulary/);
  });

  test("a tampered admin cookie is rejected", async ({ page, context }) => {
    await loginAsAdmin(page, SEED.admin);

    const cookies = await context.cookies();
    const token = cookies.find((c) => c.name === "admin_token")?.value as string;

    await context.clearCookies();
    await context.addCookies([
      {
        name: "admin_token",
        value: `${token.slice(0, -4)}AAAA`,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/admin/vocabulary");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
