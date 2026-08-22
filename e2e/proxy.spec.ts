import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";
import { loginAsAdmin } from "./support/actions";

/**
 * Route protection in the request middleware. Every branch of the matcher and both role checks — this
 * is the file where a missing `role` check let a learner into /admin.
 */
test.describe("proxy: learner-protected paths", () => {
  // `/today` is the signed-in half of `/`, reached only by an internal rewrite. Typing it
  // directly must behave like every other private route rather than exposing the shell.
  for (const path of ["/learn?level=A1&unit=1", "/quiz?level=A1&unit=1", "/profile", "/today"]) {
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

/**
 * The home page's session branch, and the caching it exists to protect.
 *
 * `app/[locale]/page.tsx` used to read `cookies()` so it could serve a signed-in learner
 * their Today card. That made the site's most-requested URL dynamic for everyone, and a
 * Worker that re-renders ~140 KB of identical HTML per visit is a Worker that answers
 * `1102 Worker exceeded resource limits` as soon as a few heavy requests overlap. The
 * branch now lives in the middleware as a rewrite, so `/` stays one URL with two renders:
 * a cacheable one and a private one.
 */
test.describe("proxy: the home page session branch", () => {
  test("an anonymous / is served as cacheable content, not a per-visitor render", async ({
    page,
  }) => {
    const response = await page.goto("/en");

    expect(response?.status()).toBe(200);
    // The exact directive Next.js emits for a dynamic render. Its return here would mean
    // the page has started reading cookies or headers again.
    expect(response?.headers()["cache-control"]).not.toContain("no-store");
    expect(response?.headers()["cache-control"]).toContain("s-maxage");
  });

  test("a signed-in / renders the Today card without leaving /", async ({ page }) => {
    await registerThroughUi(page);

    await page.goto("/en");

    // A rewrite, not a redirect: the learner is on `/en`, looking at `/en/today`.
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByTestId("today-card")).toBeVisible();
  });

  test("a trailing slash still lands on the Today card, at the canonical URL", async ({
    page,
  }) => {
    await registerThroughUi(page);

    await page.goto("/en/");

    // `HOME_PATH` deliberately does not match `/en/`, so this is two hops: Next's own 308
    // to the canonical `/en`, and then the rewrite. Matching the slash in the middleware
    // would serve the card and leave the learner on a URL no canonical tag names.
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByTestId("today-card")).toBeVisible();
  });

  test("the same branch applies under the Thai locale", async ({ page }) => {
    await registerThroughUi(page);

    await page.goto("/th");

    await expect(page).toHaveURL(/\/th$/);
    await expect(page.getByTestId("today-card")).toBeVisible();
  });
});
