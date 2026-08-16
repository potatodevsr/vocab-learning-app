import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Google sign-in and magic-link sign-up, against the real Worker and a real database.
 *
 * Only one thing is stubbed: the network round trip to accounts.google.com, which the
 * suite cannot reach. `GOOGLE_AUTH_DEV_MODE` (set by `e2e/scripts/start-api.sh`) swaps
 * that one call for an identity supplied in a request header. State, PKCE, cookies,
 * account creation, linking and session issuing all run exactly as they do in production.
 */
const API = "http://localhost:4100";

const identity = (over: Partial<Record<string, unknown>> = {}) =>
  JSON.stringify({
    sub: `google-sub-${Math.random().toString(36).slice(2)}`,
    email: `g-${Math.random().toString(36).slice(2)}@example.com`,
    emailVerified: true,
    firstName: "Ada",
    lastName: "Lovelace",
    ...over,
  });

/**
 * Drive the real redirect flow: `start` issues the state cookie, the callback is then
 * called with the state it just handed out. Anything less would be testing the stub.
 */
const signInWithGoogle = async (request: APIRequestContext, who: string) => {
  const start = await request.get(`${API}/user/google/start?locale=en`, {
    maxRedirects: 0,
  });

  // Assert rather than tolerate: an unconfigured endpoint answering 503 here once let two
  // of these tests "pass" while never reaching the callback at all.
  expect(start.status(), "google/start must redirect").toBe(302);

  const location = start.headers()["location"] ?? "";
  const state = new URL(location).searchParams.get("state");
  expect(state, "start must issue a state parameter").toBeTruthy();

  const response = await request.get(
    `${API}/user/google/callback?code=stub&state=${state}&locale=en`,
    { maxRedirects: 0, headers: { "x-google-test-identity": who } },
  );

  return { status: response.status(), response };
};

test.describe("Google sign-in", () => {
  test("start redirects to Google with PKCE and a state parameter", async ({ request }) => {
    const start = await request.get(`${API}/user/google/start?locale=en`, {
      maxRedirects: 0,
    });
    expect(start.status()).toBe(302);

    const url = new URL(start.headers()["location"]);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("scope")).toContain("email");
    // The learner must be able to pick an account on a shared device.
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });

  test("a first Google sign-in creates an account and a session", async ({ request }) => {
    const who = identity();
    const { status } = await signInWithGoogle(request, who);
    expect(status).toBe(302);

    const me = await request.get(`${API}/user/me`);
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe(JSON.parse(who).email);
  });

  test("signing in twice reuses the account rather than creating a second", async ({ request }) => {
    const who = identity();

    await signInWithGoogle(request, who);
    const first = await (await request.get(`${API}/user/me`)).json();

    await signInWithGoogle(request, who);
    const second = await (await request.get(`${API}/user/me`)).json();

    expect(second.id).toBe(first.id);
  });

  test("a callback without the issued state is refused", async ({ request }) => {
    const response = await request.get(
      `${API}/user/google/callback?code=stub&state=not-the-issued-state&locale=en`,
      { maxRedirects: 0, headers: { "x-google-test-identity": identity() } },
    );

    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toContain("error=google");
  });

  /**
   * The attack this guards: register the victim's address at a provider that never checks
   * it, then sign in and inherit their account.
   */
  test("an unverified Google email cannot sign in or adopt an account", async ({ request }) => {
    const email = `unverified-${Math.random().toString(36).slice(2)}@example.com`;
    const { response } = await signInWithGoogle(
      request,
      identity({ email, emailVerified: false }),
    );

    expect(response.headers()["location"]).toContain("error=google");

    const me = await request.get(`${API}/user/me`);
    expect(me.status(), "no session may be issued").toBe(401);
  });
});

test.describe("magic link can create an account", () => {
  test("a link for an unknown address signs up, and a second link signs in to the same account", async ({
    request,
  }) => {
    const email = `newcomer-${Math.random().toString(36).slice(2)}@example.com`;

    const requested = await request.post(`${API}/user/magic-link/request`, {
      data: { email, locale: "en" },
    });
    expect(requested.status()).toBe(202);

    const link = (await requested.json()).devMagicLink as string | undefined;
    expect(link, "dev mode must return the link").toBeTruthy();

    const token = new URL(link!).searchParams.get("token");
    const verified = await request.post(`${API}/user/magic-link/verify`, {
      data: { token },
    });

    expect(verified.status()).toBe(200);
    const created = await verified.json();
    expect(created.email).toBe(email);
    // The username is derived from the address, since no form asked for one.
    expect(created.username).toBeTruthy();

    // Second round trip: the address now has an account, so this is a sign-in.
    const again = await request.post(`${API}/user/magic-link/request`, {
      data: { email, locale: "en" },
      headers: { "x-magic-link-test-bypass-cooldown": "true" },
    });
    const secondToken = new URL((await again.json()).devMagicLink).searchParams.get("token");
    const signedIn = await request.post(`${API}/user/magic-link/verify`, {
      data: { token: secondToken },
    });

    expect(signedIn.status()).toBe(200);
    expect((await signedIn.json()).id).toBe(created.id);
  });

  test("a sign-up link is single use", async ({ request }) => {
    const email = `once-${Math.random().toString(36).slice(2)}@example.com`;

    const requested = await request.post(`${API}/user/magic-link/request`, {
      data: { email, locale: "en" },
    });
    const token = new URL((await requested.json()).devMagicLink).searchParams.get("token");

    expect((await request.post(`${API}/user/magic-link/verify`, { data: { token } })).status()).toBe(200);
    expect((await request.post(`${API}/user/magic-link/verify`, { data: { token } })).status()).toBe(400);
  });

  test("an account with no password cannot be signed into with one", async ({ request }) => {
    const email = `nopass-${Math.random().toString(36).slice(2)}@example.com`;

    const requested = await request.post(`${API}/user/magic-link/request`, {
      data: { email, locale: "en" },
    });
    const token = new URL((await requested.json()).devMagicLink).searchParams.get("token");
    await request.post(`${API}/user/magic-link/verify`, { data: { token } });

    // '' is the stored sentinel for "never set one". It must not be usable as a password.
    for (const password of ["", " ", "password"]) {
      const attempt = await request.post(`${API}/user/login`, {
        data: { email, password },
      });
      expect(attempt.status(), `password ${JSON.stringify(password)} must be refused`).not.toBe(200);
    }
  });
});

/**
 * What the learner actually *sees* when the Google callback bounces them back to the login
 * form. The tests above prove the callback emits the right `error=` code; these prove the
 * form turns each code into the correct recovery or unavailable presentation — and, in the
 * `google_unavailable` case, that it withdraws the button that could only ever fail rather
 * than leaving a dead control on the page.
 *
 * The two codes are the documented query contract of `app/[locale]/auth/login/page.tsx`
 * (`error=google` → `googleFailed`, `error=google_unavailable` → `googleUnavailable`), so
 * driving them through the URL exercises exactly the branch a real callback lands on,
 * without depending on whether OAuth credentials happen to be configured in `.dev.vars`.
 */
const googleSignInLink = (page: Page) =>
  page.locator('a[href*="/api/user/google/start"]');

test.describe("Google sign-in recovery presentation", () => {
  test("error=google shows a recoverable alert and keeps both sign-in routes", async ({
    page,
  }) => {
    await page.goto("/en/auth/login?error=google");

    const alert = page.getByTestId("google-error");
    await expect(alert).toBeVisible();
    // A recoverable failure: announced assertively, and it must name the way out.
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(alert).toContainText("Google sign-in did not complete.");

    // "Try again" is only honest if the button the learner would try again with is here.
    await expect(googleSignInLink(page)).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();

    // The page rendered its form, not an error boundary.
    await expect(page.getByTestId("google-unavailable")).toHaveCount(0);
  });

  test("error=google_unavailable explains itself and withdraws the button", async ({
    page,
  }) => {
    await page.goto("/en/auth/login?error=google_unavailable");

    const status = page.getByTestId("google-unavailable");
    await expect(status).toBeVisible();
    // Not a failure the visitor can retry, so it is a status, not an alert.
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toContainText("set up on this site yet.");

    // A button that can only fail is worse than none: it, and the divider that headed it,
    // are gone. The email route is the whole offer, and it is still usable.
    await expect(googleSignInLink(page)).toHaveCount(0);
    await expect(page.getByTestId("google-error")).toHaveCount(0);
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("an unadorned login form shows neither banner", async ({ page }) => {
    // The banners are conditional on the query, not always-on chrome: without an error the
    // Google button leads and neither notice appears.
    await page.goto("/en/auth/login");

    await expect(googleSignInLink(page)).toBeVisible();
    await expect(page.getByTestId("google-error")).toHaveCount(0);
    await expect(page.getByTestId("google-unavailable")).toHaveCount(0);
  });

  test("clicking Google when start refuses lands on the recovery alert", async ({
    page,
  }) => {
    // Narrowly intercept only the redirect entry point and answer as an unconfigured API
    // does — a 302 back to the login form carrying `error=google`. Everything the browser
    // does with that redirect (navigate, re-render the form) is real.
    await page.route("**/api/user/google/start*", (route) =>
      route.fulfill({
        status: 302,
        headers: { location: "/en/auth/login?error=google" },
      }),
    );

    await page.goto("/en/auth/login");
    await googleSignInLink(page).click();

    await expect(page).toHaveURL(/error=google\b/);
    await expect(page.getByTestId("google-error")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});

test.describe("Google links to an existing account", () => {
  test("a verified Google address adopts the account that already owns it", async ({ request }) => {
    const email = `linkme-${Math.random().toString(36).slice(2)}@example.com`;

    // Arrive first by magic link, which creates the account.
    const requested = await request.post(`${API}/user/magic-link/request`, {
      data: { email, locale: "en" },
    });
    const token = new URL((await requested.json()).devMagicLink).searchParams.get("token");
    const original = await (
      await request.post(`${API}/user/magic-link/verify`, { data: { token } })
    ).json();

    // Then come back through Google on the same verified address.
    await request.post(`${API}/user/logout`);
    await signInWithGoogle(request, identity({ email }));

    const me = await request.get(`${API}/user/me`);
    expect(me.status()).toBe(200);
    expect(
      (await me.json()).id,
      "linking must keep the original account, not fork a second one",
    ).toBe(original.id);
  });
});

/**
 * What `start` is allowed to hand a browser.
 *
 * `GOOGLE_AUTH_DEV_MODE` lets this suite exercise the callback without reaching Google,
 * and it also made `start` fall back to a placeholder `client_id=test-client-id`. The
 * suite never followed that redirect so nothing caught it — but a human clicking the
 * button did, straight into Google's own "Error 401: invalid_client" page, which reads as
 * a broken app rather than an unconfigured one. `pnpm dev` no longer sets the flag.
 *
 * Written to hold whether or not credentials happen to exist, because they are read from
 * `backend/.dev.vars`, which the developer's own Google setup also writes to: asserting
 * one branch would make the suite pass or fail on a file that is not in the repository.
 */
test.describe("Google sign-in redirect target", () => {
  test("either goes to Google with a usable redirect_uri, or back to the login form", async ({
    request,
  }) => {
    const start = await request.get(`${API}/user/google/start?locale=th`, {
      maxRedirects: 0,
    });

    expect(start.status()).toBe(302);
    const location = start.headers()["location"] ?? "";

    if (!location.includes("accounts.google.com")) {
      // Unconfigured: back to the sign-in page, which explains itself and offers the
      // email route instead of showing a button that cannot work.
      expect(location).toContain("/auth/login");
      expect(location).toContain("error=google_unavailable");
      return;
    }

    const url = new URL(location);

    /**
     * The callback address, which is the part that is easy to get wrong: it is the *web*
     * origin plus the `/api/*` forwarder, not the API's own port. Registering anything
     * else in Google Cloud Console produces `redirect_uri_mismatch`, so this is the value
     * a human has to copy exactly.
     */
    expect(url.searchParams.get("redirect_uri")).toMatch(
      /^https?:\/\/[^/]+\/api\/user\/google\/callback$/,
    );

    // A placeholder id is only ever acceptable because this suite does not follow the
    // redirect. If it reaches a real browser it is a dead end.
    const clientId = url.searchParams.get("client_id") ?? "";
    expect(clientId.length, "client_id must not be empty").toBeGreaterThan(0);
  });
});
