import { expect, test } from "@playwright/test";

import { loginThroughUi, registerThroughUi } from "./support/actions";
import { newUser } from "./support/fixtures";

test.describe("authentication", () => {
  test("auth shells are cacheable and keep query state in the client island", async ({
    request,
  }) => {
    for (const path of [
      "/en/auth/login?from=%2Fen%2Fprofile&error=google",
      "/th/auth/register?from=%2Fth%2Fprofile",
    ]) {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);
      expect(response.headers()["cache-control"] ?? "").not.toContain("private");
      expect(response.headers()["cache-control"] ?? "").not.toContain("no-store");
    }
  });

  test("auth shells do not spend Worker CPU prefetching alternative pages", async ({
    page,
  }) => {
    const speculativeRequests: string[] = [];
    page.on("request", (request) => {
      if (request.headers()["next-router-prefetch"] === "1") {
        speculativeRequests.push(request.url());
      }
    });

    await page.goto("/th/auth/login?from=%2Fth%2Fprofile");
    await page.waitForTimeout(1_000);
    await page.goto("/en/auth/register");
    await page.waitForTimeout(1_000);

    expect(speculativeRequests).toEqual([]);
  });

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

  test("a failed email-link delivery explains the password fallback", async ({ page }) => {
    await page.route("**/api/user/magic-link/request", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "unavailable" }),
      }),
    );

    await page.goto("/en/auth/login");
    await page.fill("#email", "delivery-failure@example.com");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(page.getByText("Email links are unavailable right now", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in with password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toHaveCount(0);
  });

  /**
   * An unknown address now receives a sign-up link rather than nothing, so the screen it
   * lands on must be the one a registered address sees — that sameness is the point. It is
   * no longer meaningful to assert the dev link is absent: its absence *was* the tell.
   */
  test("an unknown email gets the same inbox confirmation", async ({ page }) => {
    await page.goto("/en/auth/login");
    await page.fill("#email", `no-account-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(page.getByTestId("magic-link-sent")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("a link sent to a brand-new address creates the account and signs in", async ({
    page,
  }) => {
    const email = `signup-${Date.now()}@example.com`;

    await page.goto("/en/auth/login");
    await page.fill("#email", email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

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
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await page.getByTestId("dev-magic-link").click();

    await expect(page).toHaveURL(/\/en\/profile$/, { timeout: 20_000 });

    // Not `getByText(username)`: the app bar prints the same string once the client's
    // `/user/me` resolves, so that locator resolves to two elements — a strict-mode
    // violation — depending on which side of the race the assertion lands.
    await expect(page.getByTestId("profile-username")).toHaveText(user.username);
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
    await registerThroughUi(page);

    // By role, not by username text: the account menu and the profile page print the same
    // string, and the bar is the control being clicked.
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();

    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    /**
     * The marketing hero coming back is the §8 L2 branch flipping the other way: signed
     * in, `middleware.ts` rewrites `/en` to the Today card; signed out, it serves the
     * cached marketing page. It is also what makes the navigation below deterministic —
     * `handleLogout` ends with `router.push()` + `router.refresh()`
     * (`components/user-navbar.tsx`), and a `goto` issued on top of that in-flight refresh
     * aborts with `net::ERR_ABORTED`.
     */
    await expect(page.getByTestId("home-practice-cta")).toBeVisible();

    // And the protected route is protected again.
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});


/**
 * A controlled form is deaf until React attaches.
 *
 * Between first paint and hydration the markup is real HTML: it accepts typing, and a
 * password manager fills it, and none of that reaches `useState`. The register form's
 * submit is disabled on `isFormValid`, so what a learner on a slow phone saw was five
 * filled fields above a dead button and no explanation. `usePrefilledForm` adopts
 * whatever the DOM already holds on mount.
 */
test.describe("a form filled before hydration", () => {
  test("keeps what was typed and lets the learner submit", async ({ page }) => {
    // Hold every script back long enough to type the whole form into un-hydrated markup.
    await page.route("**/*.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.continue();
    });

    await page.goto("/en/auth/register", { waitUntil: "domcontentloaded" });

    const user = newUser();
    await page.fill("#firstName", user.firstName);
    await page.fill("#lastName", user.lastName);
    await page.fill("#email", user.email);
    await page.fill("#username", user.username);
    await page.fill("#password", user.password);

    await page.unroute("**/*.js");

    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator("#email")).toHaveValue(user.email);
  });
});

/**
 * The bar's own sign-in used to lead nowhere in particular.
 *
 * `middleware.ts` preserves a return path when it *sends* someone to the login wall, but a
 * learner who pressed "log in" in the header — three units into a level, or halfway down a
 * word page — was returned to the home page having lost their place (audit UX-09).
 */
test.describe("signing in from the bar", () => {
  test("comes back to the page the learner was reading", async ({ page }) => {
    await page.goto("/th/english/words/about");

    const links = await page
      .locator("header a[href*='/auth/']")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));

    expect(links.length).toBeGreaterThan(0);
    for (const href of links) {
      expect(href).toContain("from=%2Fth%2Fenglish%2Fwords%2Fabout");
    }
  });
});
