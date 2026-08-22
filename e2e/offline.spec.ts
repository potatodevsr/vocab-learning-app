import { expect, test } from "@playwright/test";

import { SEED } from "./support/fixtures";

/**
 * The service worker (`public/sw.js`).
 *
 * What is worth testing is not that caching happens — it is *what is allowed into a
 * cache*. A learner's own data must never be served from a stale copy, and a shared phone
 * must not keep someone's profile page around after they sign out. Those are the
 * assertions here; the speed win is the easy part.
 */

// The suite blocks service workers globally (see playwright.config.ts) because a
// controlled page's requests escape `page.route`. This file is the exception: the worker
// is what it tests.
test.use({ serviceWorkers: "allow" });

test.describe("service worker", () => {
  test("is served and takes control of the page", async ({ page }) => {
    await page.goto("/en");

    const controlled = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    });

    expect(controlled).toBe(true);
  });

  test("caches word audio, and never the learner's own data", async ({ page }) => {
    await page.goto(`/en/english/words/${SEED.audio.word}`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.getByTestId("word-audio").click();

    // The clip lands in its own cache…
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const cache = await caches.open("audio-v1");
          const keys = await cache.keys();
          return keys.some((request) => request.url.includes("/api/audio/"));
        }),
      )
      .toBe(true);

    // …and nothing under /api that is not audio is cached anywhere at all.
    const leaked = await page.evaluate(async () => {
      const names = await caches.keys();
      const urls: string[] = [];

      for (const name of names) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(request.url);
      }

      return urls.filter(
        (url) => url.includes("/api/") && !url.includes("/api/audio/"),
      );
    });

    expect(leaked, "API responses other than audio must never be cached").toEqual([]);
  });

  test("keeps private pages out of the page cache", async ({ page }) => {
    await page.goto("/en/english/a1");

    // The first navigation of a fresh context happens *before* any worker is installed —
    // it is what installs one — so it is never intercepted. Wait for control, then load
    // the page again: that second load is the one the worker sees.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();

    // A public page is fair game — it is the same for everyone.
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const cache = await caches.open("pages-v1");
          const keys = await cache.keys();
          return keys.some((request) => request.url.includes("/english/a1"));
        }),
      )
      .toBe(true);

    await page.goto("/en/profile");

    const privateCached = await page.evaluate(async () => {
      const cache = await caches.open("pages-v1");
      const keys = await cache.keys();
      return keys.some((request) => /\/(profile|progress|review|learn|quiz|today|auth)/.test(request.url));
    });

    expect(privateCached, "a shared phone must not keep someone's private pages").toBe(false);
  });
});
