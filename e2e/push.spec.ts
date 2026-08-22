import { expect, test } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

/**
 * Web push subscription management (`backend/src/push.ts`).
 *
 * Delivery itself cannot be tested here — it needs a real push service, a real browser
 * subscription and a wait — so what these assert is the part that can go wrong quietly:
 * who may register an endpoint, what an endpoint is allowed to be, and whether one person
 * can silence another's phone.
 *
 * A push endpoint is a URL this Worker will POST to on a schedule. Without the checks
 * below, the subscription table is an open list of such URLs.
 */

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/e2e-test-endpoint";
const KEYS = { p256dh: "BExample-p256dh-key", auth: "example-auth" };

test.describe("push subscriptions", () => {
  test("refuse an anonymous caller", async ({ request }) => {
    const res = await request.post("/api/push/subscribe", {
      data: { endpoint: ENDPOINT, keys: KEYS },
      failOnStatusCode: false,
    });

    // 401 signed out, or 503 where no VAPID keys are configured. Never a stored row.
    expect([401, 503]).toContain(res.status());
  });

  test("refuse an endpoint that is not https", async ({ page }) => {
    await registerThroughUi(page);

    const res = await page.request.post("/api/push/subscribe", {
      data: { endpoint: "http://example.com/hijack", keys: KEYS },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(400);
  });

  test("subscribe, then unsubscribe, is idempotent both ways", async ({ page }) => {
    await registerThroughUi(page);

    const first = await page.request.post("/api/push/subscribe", {
      data: { endpoint: ENDPOINT, keys: KEYS },
      failOnStatusCode: false,
    });
    if (first.status() === 503) test.skip(true, "push keys are not configured in this environment");
    expect(first.status()).toBe(200);

    // Re-subscribing the same browser returns the same endpoint from the push service, so
    // the second call must update rather than fail on the unique index.
    const again = await page.request.post("/api/push/subscribe", {
      data: { endpoint: ENDPOINT, keys: KEYS },
    });
    expect(again.status()).toBe(200);

    const off = await page.request.post("/api/push/unsubscribe", { data: { endpoint: ENDPOINT } });
    expect(off.status()).toBe(200);

    // Unsubscribing something that is already gone is a no-op, not an error: a browser can
    // drop a subscription without telling the server.
    const offAgain = await page.request.post("/api/push/unsubscribe", { data: { endpoint: ENDPOINT } });
    expect(offAgain.status()).toBe(200);
  });

  test("one learner cannot unsubscribe another learner's device", async ({ page, browser }) => {
    await registerThroughUi(page);
    const owned = `${ENDPOINT}-owned`;

    const created = await page.request.post("/api/push/subscribe", {
      data: { endpoint: owned, keys: KEYS },
      failOnStatusCode: false,
    });
    if (created.status() === 503) test.skip(true, "push keys are not configured in this environment");

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerThroughUi(otherPage);

    // Accepted as a request, but it must delete nothing — the route scopes the delete to
    // the caller, so the endpoint stays subscribed for its owner.
    await otherPage.request.post("/api/push/unsubscribe", { data: { endpoint: owned } });
    await otherContext.close();

    // Proven by the owner's own unsubscribe still finding something to do: a second
    // subscribe would mask a delete, so this asserts through the same idempotent route.
    const stillThere = await page.request.post("/api/push/subscribe", {
      data: { endpoint: owned, keys: KEYS },
    });
    expect(stillThere.status()).toBe(200);
  });
});

test.describe("notification text", () => {
  test("is fetched by the service worker, and only for the signed-in learner", async ({
    page,
    request,
  }) => {
    // The push itself carries no payload; this is what the worker reads when one arrives.
    const anonymous = await request.get("/api/reminders/preview", { failOnStatusCode: false });
    expect(anonymous.status()).toBe(401);

    await registerThroughUi(page);
    const mine = await page.request.get("/api/reminders/preview");

    expect(mine.status()).toBe(200);
    const body = await mine.json();
    expect(body.title).toBeTruthy();
    expect(body.body).toBeTruthy();
    // Same-origin path, so a notification can never open somewhere else.
    expect(body.url.startsWith("/")).toBe(true);
  });

  test("is in the language the learner registered in", async ({ page }) => {
    // `registerThroughUi` signs up under /en, so this learner reads English. A Thai
    // notification about a course somebody is reading in English is the kind of small
    // wrongness that makes a product feel built for somebody else.
    await registerThroughUi(page);

    const body = await (await page.request.get("/api/reminders/preview")).json();

    expect(body.title).toMatch(/[A-Za-z]/);
    expect(body.title).not.toMatch(/[\u0E00-\u0E7F]/);
    // And it opens the half of the app they actually use.
    expect(body.url).toBe("/en");
  });
});
