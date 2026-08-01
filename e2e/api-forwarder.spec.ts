import { expect, test } from "@playwright/test";

import { API_ORIGIN, API_URL } from "../constants/config";
import { SEED, newUser } from "./support/fixtures";

/**
 * The `/api/*` forwarder (`app/api/[...path]/route.ts`) and the one rule that makes it
 * work: the browser talks to the web origin and nothing else.
 *
 * This file exists because production shipped without it. `NEXT_PUBLIC_API_URL` pointed
 * at the web Worker's own `/api` path, no route served it, and the locale middleware
 * answered `POST /api/user/register` with `307 → /en/api/user/register` — a 404 page.
 * Sign-up was dead for every visitor while every test was green, because the suite let
 * the browser call the API's own origin directly.
 *
 * Each test below fails on a different way of reintroducing that: a locale redirect on
 * `/api`, a missing forwarder, a dropped cookie, a swallowed status, or a client bundle
 * that learned a second origin.
 */

const REGISTER = "/api/user/register";

test.describe("the /api forwarder", () => {
  test("the middleware never locale-redirects /api", async ({ request }) => {
    // maxRedirects: 0 — following the redirect is what hid this in the first place.
    const response = await request.post(REGISTER, {
      data: {},
      maxRedirects: 0,
    });

    expect(response.status()).not.toBe(307);
    expect(response.status()).not.toBe(308);
    expect(response.headers()["location"]).toBeUndefined();
    // The API's own validation answer, proving the request reached it.
    expect(response.status()).toBe(400);
  });

  test("a GET reaches the API and returns its JSON, not a Next page", async ({
    request,
  }) => {
    const response = await request.get("/api/health", { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(await response.json()).toEqual({ ok: true });
  });

  test("an unknown API path answers as the API, not as the web app", async ({
    request,
  }) => {
    const response = await request.get("/api/definitely-not-a-route", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(404);
    // A Next 404 is `text/html`. If this ever passes with HTML, the forwarder is gone
    // and the app router is answering instead.
    expect(response.headers()["content-type"] ?? "").not.toContain("text/html");
  });

  test("query strings survive the hop", async ({ request }) => {
    const response = await request.get("/api/vocabword/paginated?take=1", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.total).toBe(SEED.publishedWordCount);
    // A dropped `take` would return the whole page of words, not one.
    expect(body.data).toHaveLength(1);
  });

  test("registering through the forwarder relays the status and the session cookie", async ({
    playwright,
  }) => {
    // A jar of its own: this asserts on exactly the cookies this exchange sets.
    const ctx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    });
    const user = newUser();

    const created = await ctx.post(REGISTER, { data: user, maxRedirects: 0 });
    expect(created.status()).toBe(200);
    expect((await created.json()).id).toBeTruthy();

    const login = await ctx.post("/api/user/login", {
      data: { email: user.email, password: user.password },
      maxRedirects: 0,
    });
    expect(login.status()).toBe(200);

    // The cookie the API set has to arrive at the *web* origin, or the learner is
    // signed out the moment they navigate.
    const { cookies } = await ctx.storageState();
    const session = cookies.find((cookie) => cookie.name === "user_token");
    expect(session?.value).toBeTruthy();
    expect(session?.httpOnly).toBe(true);

    // And it is honoured on the way back through.
    const me = await ctx.get("/api/user/me", { maxRedirects: 0 });
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe(user.email);

    await ctx.dispose();
  });

  test("an API error keeps its status and message", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    });
    const user = newUser();

    expect((await ctx.post(REGISTER, { data: user })).status()).toBe(200);

    const duplicate = await ctx.post(REGISTER, { data: user, maxRedirects: 0 });
    expect(duplicate.status()).toBe(409);
    // The register form renders this string; a generic 500 would replace it.
    expect((await duplicate.json()).message).toContain("ถูกใช้แล้ว");

    await ctx.dispose();
  });

  test("the browser only ever calls the web origin", async ({
    page,
    baseURL,
  }) => {
    const user = newUser();
    const apiCalls: string[] = [];

    page.on("request", (request) => {
      if (/\/user\/(register|login|me)/.test(request.url())) {
        apiCalls.push(request.url());
      }
    });

    await page.goto("/en/auth/register");
    await page.fill("#firstName", user.firstName);
    await page.fill("#lastName", user.lastName);
    await page.fill("#email", user.email);
    await page.fill("#username", user.username);
    await page.fill("#password", user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/en", { timeout: 20_000 });

    expect(apiCalls.length).toBeGreaterThan(0);

    for (const url of apiCalls) {
      expect(url.startsWith(`${baseURL}/api/`)).toBe(true);
      // The failure this file is named after: a locale prefix in front of /api.
      expect(url).not.toContain("/en/api/");
      // And the failure that hid it: a client bundle that knows the API's own origin.
      expect(url.startsWith(API_ORIGIN)).toBe(false);
    }
  });

  test("the client-side API base is same-origin, the server-side one is not", () => {
    // `API_URL` resolves per environment. This spec runs in Node, so it must read as the
    // API's own origin here — while the browser must only ever see the "/api" path,
    // which the test above proves against real network traffic.
    expect(API_URL).toBe(API_ORIGIN);
    expect(API_ORIGIN).toBe("http://localhost:4100");
    expect(API_ORIGIN.startsWith("http")).toBe(true);
  });
});
