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

  /**
   * The query string is part of "where you were going".
   *
   * `from` was built from `pathname` alone, and every protected route that means anything
   * carries its scope in the query. A learner who followed a unit's CTA into the sign-in
   * wall came back to a bare `/en/learn` — the default lesson — rather than the unit,
   * level and mode they asked for, and `/en/profile` above could never notice because it
   * has no query to lose. Both locales, and every parameter each route uses.
   */
  for (const { locale, target } of [
    { locale: "en", target: "/learn?level=A2&unit=4&mode=review" },
    { locale: "th", target: "/learn?level=A2&unit=4&mode=review" },
    { locale: "en", target: "/quiz?level=A1&unit=2" },
    { locale: "th", target: "/quiz?level=A1&unit=2" },
  ]) {
    test(`the redirect keeps the whole query for /${locale}${target}`, async ({ page }) => {
      await page.goto(`/${locale}${target}`);

      await expect(page).toHaveURL(new RegExp(`/${locale}/auth/login\\?from=`));
      expect(decodeURIComponent(page.url())).toContain(`from=/${locale}${target}`);
    });
  }

  test("signing in from the wall lands back on the exact unit that was asked for", async ({
    page,
    context,
  }) => {
    // The whole point of `from`, driven end to end rather than asserted on a URL: register,
    // drop the session, hit a scoped private route, sign in, and check where you land.
    const user = await registerThroughUi(page);
    await context.clearCookies();

    await page.goto("/en/learn?level=A1&unit=2");
    await expect(page).toHaveURL(/\/en\/auth\/login\?from=/);

    await page.fill("#email", user.email);
    await page.fill("#password", user.password);
    await page.getByRole("button", { name: "Log in with password" }).click();

    await expect(page).toHaveURL("/en/learn?level=A1&unit=2", { timeout: 20_000 });
    // Unit 2, not the default lesson: `word21` is its first published row.
    await expect(page.getByTestId("session-prompt")).toHaveText("word21");
  });

  test("a protected route with no query is unchanged by that", async ({ page }) => {
    // The no-query case must stay byte-identical: `nextUrl.search` is "" here, so the
    // encoded value has no trailing "?" bolted onto it.
    await page.goto("/en/today");

    expect(decodeURIComponent(page.url())).toContain("from=/en/today");
    expect(page.url()).not.toContain("%3F");
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

/**
 * The signed-in shell.
 *
 * `user_token` is `httpOnly`; `signed_in` is the readable hint `lib/use-session.ts` uses to
 * decide whether to ask the API who the visitor is. They are set together at sign-in and
 * can come apart — a session opened before the hint existed carries only the token, and a
 * browser or extension that prunes non-`httpOnly` cookies produces the same state.
 *
 * The visible failure was a learner reading their own Today card — private content, which
 * only renders because middleware verified the token — under an app bar offering Login and
 * Signup. Middleware re-issues the hint on any request whose token it has just verified.
 */
test.describe("proxy: session hint", () => {
  const dropHint = async (context: import("@playwright/test").BrowserContext) => {
    const cookies = await context.cookies();
    await context.clearCookies();
    await context.addCookies(cookies.filter((cookie) => cookie.name !== "signed_in"));
  };

  test("a token without the hint still renders the signed-in home", async ({
    page,
    context,
  }) => {
    await registerThroughUi(page);
    await dropHint(context);

    await page.goto("/en");

    // The private half of `/` — proof the token was accepted.
    await expect(page.getByTestId("today-card")).toBeVisible();

    // And the bar agrees with it.
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign up" })).toHaveCount(0);
  });

  test("the hint is re-issued rather than left missing", async ({ page, context }) => {
    await registerThroughUi(page);
    await dropHint(context);

    expect(
      (await context.cookies()).some((cookie) => cookie.name === "signed_in"),
    ).toBe(false);

    await page.goto("/en/profile");

    const healed = (await context.cookies()).find(
      (cookie) => cookie.name === "signed_in",
    );

    expect(healed?.value).toBe("1");
    // Readable on purpose: the hook is a client component.
    expect(healed?.httpOnly).toBe(false);
  });

  test("an anonymous visitor is never given a session hint", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/en");

    expect(
      (await context.cookies()).some((cookie) => cookie.name === "signed_in"),
    ).toBe(false);
  });
});
