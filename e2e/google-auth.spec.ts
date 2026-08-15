import { test, expect, type APIRequestContext } from "@playwright/test";

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
