/**
 * Service worker: make a mid-range Android on a Thai mobile network feel like the app is
 * already installed, and let a lesson survive a lift ride.
 *
 * The rules are deliberately narrow, because the failure mode of an over-eager service
 * worker is worse than the problem it solves — a cached HTML shell from three deploys ago,
 * with no way for the user to know why the app looks wrong.
 *
 *   1. **Immutable assets** (`/_next/static/*`) are cache-first. Their URLs contain a
 *      build hash, so a cached copy can never be the wrong copy.
 *   2. **Audio** (`/api/audio/*`) is cache-first for the same reason: a key names one clip
 *      forever, and re-downloading a word's pronunciation on every card is the single
 *      largest avoidable cost on a metered connection.
 *   3. **Navigations** are network-first with a cached fallback, so a deploy is picked up
 *      on the next online load and a subway ride still renders something.
 *   4. **Everything else — every API call that is not audio — is never cached.** Progress,
 *      sessions, and the learner's own data must not be served from a stale copy, and a
 *      queued mutation replayed later would be a lie about what the learner did.
 */

const VERSION = "v1";
const ASSET_CACHE = `assets-${VERSION}`;
const AUDIO_CACHE = `audio-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;

/** Kept small: this is a fallback for the pages a learner already visited, not a mirror. */
const PAGE_CACHE_LIMIT = 40;

self.addEventListener("install", (event) => {
    // A new worker takes over as soon as it is ready. Waiting for every tab to close means
    // a fix can sit unused for days on the exact device that needed it.
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const names = await caches.keys();
            await Promise.all(
                names
                    .filter((name) => !name.endsWith(VERSION))
                    .map((name) => caches.delete(name)),
            );
            await self.clients.claim();
        })(),
    );
});

const trimCache = async (name, limit) => {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length <= limit) return;
    await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
};

const cacheFirst = async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(request);
    if (hit) return hit;

    const response = await fetch(request);
    // Only complete, same-origin, successful responses. A partial (206) audio response
    // cached whole would be replayed as if it were the entire clip.
    if (response.ok && response.status === 200) {
        cache.put(request, response.clone());
    }
    return response;
};

const networkFirst = async (request) => {
    const cache = await caches.open(PAGE_CACHE);

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
            void trimCache(PAGE_CACHE, PAGE_CACHE_LIMIT);
        }
        return response;
    } catch (error) {
        const hit = await cache.match(request);
        if (hit) return hit;
        throw error;
    }
};

/**
 * A reminder arrived.
 *
 * The push carries no payload (see `backend/src/push.ts`), so the text is fetched here,
 * with the learner's own cookie, at the moment it is shown. That keeps personal wording —
 * "3 words are due" — off the push service entirely, and it means a notification delivered
 * an hour late says what is true an hour late rather than what was true when it was queued.
 *
 * If the fetch fails (signed out, offline, server down) the notification still shows, with
 * generic wording. A push that resolves to nothing visible is worse than a plain one: the
 * platform will show its own "This site has been updated in the background" instead.
 */
self.addEventListener("push", (event) => {
    event.waitUntil(
        (async () => {
            let content = {
                title: "ถึงเวลาฝึกแล้ว",
                body: "บทเรียนสั้น ๆ ใช้เวลาประมาณ 3 นาที",
                url: "/th",
            };

            try {
                const response = await fetch("/api/reminders/preview", {
                    credentials: "include",
                });
                if (response.ok) content = { ...content, ...(await response.json()) };
            } catch {
                // Generic wording it is.
            }

            await self.registration.showNotification(content.title, {
                body: content.body,
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                // One reminder replaces the previous one rather than stacking: three
                // unread nudges is a notification shade to clear, not three reasons to open
                // the app.
                tag: "practice-reminder",
                renotify: false,
                data: { url: content.url },
            });
        })(),
    );
});

/**
 * Opening a notification focuses the tab that is already open when there is one. Spawning a
 * second copy of the app next to the first is a small thing that reads as broken.
 */
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const target = event.notification.data?.url ?? "/th";

    event.waitUntil(
        (async () => {
            const clients = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });

            for (const client of clients) {
                if (client.url.includes(new URL(target, self.location.origin).pathname)) {
                    return client.focus();
                }
            }

            return self.clients.openWindow(target);
        })(),
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Only GET, only this origin. A POST replayed from a cache is a fabricated action.
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith("/_next/static/")) {
        event.respondWith(cacheFirst(request, ASSET_CACHE));
        return;
    }

    if (url.pathname.startsWith("/api/audio/")) {
        event.respondWith(cacheFirst(request, AUDIO_CACHE));
        return;
    }

    // Everything else under /api is the learner's own data. Straight to the network, and
    // if the network is gone the caller gets the failure it needs to handle.
    if (url.pathname.startsWith("/api/")) return;

    // A learner's private pages must never sit in a shared device's cache.
    if (/^\/(en|th)\/(profile|progress|review|learn|quiz|today|auth)/.test(url.pathname)) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
    }
});
