import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import {
    ENGLISH_STATIC_CHILDREN,
    isLevelSlug,
    isPositiveInteger,
    isUnroutableFamilyPath,
    MAX_UNIT,
} from "./lib/routes";

// Next.js 16 normally uses `proxy.ts` with the Node.js runtime. OpenNext Cloudflare
// 1.20 cannot bundle Node.js Proxy yet, so the documented `middleware.ts` compatibility
// path keeps this request boundary on its default Edge runtime until adapter support lands.

// Hreflang behaviour lives in `i18n/routing.ts` (`alternateLinks: false`) — it is a
// routing option in next-intl 4, not a middleware argument.
const intlMiddleware = createMiddleware(routing);
const PROTECTED_USER_PATHS = ["/learn", "/quiz", "/profile", "/progress", "/today"];

/**
 * `/en` and `/th` — the localized home page, and the only route that branches on whether
 * the visitor is signed in.
 *
 * No optional trailing slash on purpose. Matching `/en/` here would answer it with the
 * rewrite and the learner would sit on a non-canonical URL forever; letting it fall
 * through instead means Next answers `/en/` with its own `308` to `/en` (verified against
 * the deployed app for both locales), and the redirected request matches this and gets
 * the Today card at the one address the canonical tag names.
 */
const HOME_PATH = /^\/(en|th)$/;

/**
 * The unit checkpoint is a private graded gate (`docs/LEARNER-LIFECYCLE.md` §3.8) nested
 * under the public unit page, so a flat prefix cannot express it. Its entry point is only
 * shown to signed-in learners, but a directly-typed URL must land on login, not on an
 * immersive shell it will only 401 out of.
 */
const CHECKPOINT_PATH = /^\/(en|th)\/english\/[^/]+\/unit\/[^/]+\/checkpoint(\/|$)/;

/**
 * Whether a path under `/{locale}/english/` is a shape no page could ever answer.
 *
 * Judged from the URL alone, before any render — see `lib/routes.ts` for why this cannot
 * live in the page. Everything here is a string test: a segment that *looks* right but
 * turns out to have no data behind it (letter `x`, a unit past the end of a level, an
 * unknown word) is not this function's business and stays a `noindex, follow` 200.
 */
const isUnroutableEnglishPath = (segments: string[]): boolean => {
    // segments is the path split on "/", empty parts removed: ["th", "english", …].
    const [, , child, third, fourth, fifth] = segments;

    // `/english` itself, and anything that is not the English tree.
    if (!child) return false;

    if (child === "words") {
        // `/english/words`, `/english/words/{slug}`.
        if (third !== "letter") return segments.length > 4;

        // `/english/words/letter/{a-z}` and its page 2+.
        if (!fourth || !/^[a-z]$/.test(fourth)) return true;
        if (segments.length === 4) return true; // `/english/words/letter` alone
        if (segments.length === 5) return false;
        if (segments.length > 6) return true;

        // Page 1 has exactly one address — the bare letter URL (SEO-CONTENT §E).
        return !isPositiveInteger(fifth) || Number.parseInt(fifth, 10) < 2;
    }

    if (child === "test") {
        // `/english/test` and `/english/test/{level}`.
        if (segments.length === 3) return false;
        return segments.length > 4 || !isLevelSlug(third);
    }

    // The closed families — pronunciation, minimal pairs, phrasal verbs, plans, printables,
    // flashcards, the word-of-the-day archive. Every member is known from a static list, so
    // an unknown one is a 404 rather than another soft 404 (`lib/routes.ts`).
    if ((ENGLISH_STATIC_CHILDREN as readonly string[]).includes(child)) {
        return isUnroutableFamilyPath(segments);
    }

    // What is left has to be a CEFR level.
    if (!isLevelSlug(child)) return true;
    if (segments.length === 3) return false;

    if (third === "practice") return segments.length > 4;

    if (third === "unit") {
        if (!fourth || !isPositiveInteger(fourth)) return true;
        if (Number.parseInt(fourth, 10) > MAX_UNIT) return true;
        if (segments.length === 5) return false;
        if (segments.length > 6) return true;

        return fifth !== "practice" && fifth !== "checkpoint";
    }

    return true;
};

/**
 * The API signs both cookies with this one secret, so a valid signature proves only that
 * *some* token was issued — not which kind. The `role` claim is what separates them.
 * Without that check a learner could copy their `user_token` into an `admin_token` cookie
 * and walk straight into /admin.
 */
const getSecret = () => {
    const secret = process.env.JWT_SECRET ?? process.env.ADMIN_JWT_SECRET;

    if (!secret) throw new Error("JWT_SECRET is missing");

    return secret;
};

type Role = "admin" | "user";

const decodeBase64Url = (value: string) => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const decodeJson = (value: string) =>
    JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Record<
        string,
        unknown
    >;

/**
 * This boundary only needs HS256 signature + time + role validation. Pulling the full
 * `jose` verifier into middleware made every localized static request initialize that
 * dependency on the Worker's free CPU budget. The API still performs authoritative
 * authorization; this compact WebCrypto check keeps redirects secure and cheap.
 */
const hasRole = async (token: string | undefined, role: Role) => {
    if (!token) return false;

    try {
        const [encodedHeader, encodedPayload, encodedSignature, extra] =
            token.split(".");
        if (!encodedHeader || !encodedPayload || !encodedSignature || extra) {
            return false;
        }

        const header = decodeJson(encodedHeader);
        if (header.alg !== "HS256") return false;

        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(getSecret()),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"],
        );
        const valid = await crypto.subtle.verify(
            "HMAC",
            key,
            decodeBase64Url(encodedSignature),
            new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
        );
        if (!valid) return false;

        const payload = decodeJson(encodedPayload);
        const now = Math.floor(Date.now() / 1000);
        if (typeof payload.exp === "number" && payload.exp <= now) return false;
        if (typeof payload.nbf === "number" && payload.nbf > now) return false;

        return payload.role === role;
    } catch {
        return false;
    }
};

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/admin")) {
        if (pathname === "/admin/login") return NextResponse.next();

        const isAdmin = await hasRole(
            request.cookies.get("admin_token")?.value,
            "admin",
        );

        if (!isAdmin) {
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }

        return NextResponse.next();
    }

    /**
     * Soft 404s, answered as real ones.
     *
     * `notFound()` inside a page can no longer set a status — every route here has a
     * `loading.tsx`, so the shell is already on the wire (`lib/routes.ts`). Deciding here
     * costs a string split and closes an unbounded crawl space: before this,
     * `/th/english/<anything>` was a `200`.
     *
     * A rewrite to a path no route matches renders the localized not-found body with a
     * `404` status, so a reader still gets a page and a crawler still gets the truth.
     */
    const segments = pathname.split("/").filter(Boolean);
    const isLocalised = segments[0] === "en" || segments[0] === "th";

    if (isLocalised && segments[1] === "english") {
        /**
         * `/english/A1` used to render the A1 hub with a canonical pointing at
         * `/english/a1` — a second address for one page, linked from our own footer. One
         * permanent redirect is cheaper than asking every crawler to believe the canonical.
         */
        const lowered = [...segments];
        const lower = (index: number) => {
            const value = segments[index];
            if (!value || value === value.toLowerCase()) return;
            lowered[index] = value.toLowerCase();
        };

        if (segments[2] && isLevelSlug(segments[2].toLowerCase())) lower(2);
        if (segments[2] === "words" && segments[3] === "letter") lower(4);

        if (lowered.join("/") !== segments.join("/")) {
            const url = request.nextUrl.clone();
            url.pathname = `/${lowered.join("/")}`;

            return NextResponse.redirect(url, 308);
        }

        if (isUnroutableEnglishPath(segments)) {
            return NextResponse.rewrite(
                new URL(`/${segments[0]}/__not-found`, request.url),
            );
        }
    }

    /**
     * `/thai-alphabet/{id}` takes a letter id (`ko-kai`, `mai-ek`). Anything deeper, or
     * anything that is not a slug, is a shape no route answers (SEO-CONTENT §W).
     */
    if (
        isLocalised &&
        segments[1] === "thai-alphabet" &&
        segments.length > 2 &&
        (segments.length > 3 || !/^[a-z][a-z0-9-]*$/.test(segments[2]))
    ) {
        return NextResponse.rewrite(
            new URL(`/${segments[0]}/__not-found`, request.url),
        );
    }

    /**
     * The §8 L2 gate, moved out of the page.
     *
     * `app/[locale]/page.tsx` used to read `cookies()` to decide between the marketing
     * page and the learner's Today card. That made the site's most-requested URL dynamic
     * for everyone, so every anonymous visit and every crawler hit re-rendered ~140 KB of
     * identical HTML on the Worker — one of the loads that pushed the isolate into
     * `1102 Worker exceeded resource limits`. Deciding here keeps `/` a cacheable ISR
     * entry for the anonymous case, and a rewrite (not a redirect) means the signed-in
     * learner still sees `/` in the address bar.
     */
    const home = pathname.match(HOME_PATH);

    if (home) {
        const isUser = await hasRole(
            request.cookies.get("user_token")?.value,
            "user",
        );

        if (isUser) {
            const url = request.nextUrl.clone();
            url.pathname = `/${home[1]}/today`;

            return NextResponse.rewrite(url);
        }
    }

    const isProtected =
        CHECKPOINT_PATH.test(pathname) ||
        PROTECTED_USER_PATHS.some((path) =>
            pathname.match(new RegExp(`^/(en|th)${path}`)),
        );

    if (isProtected) {
        const isUser = await hasRole(
            request.cookies.get("user_token")?.value,
            "user",
        );

        if (!isUser) {
            const locale = pathname.split("/")[1] || "en";
            const from = encodeURIComponent(pathname);

            return NextResponse.redirect(
                new URL(`/${locale}/auth/login?from=${from}`, request.url),
            );
        }
    }

    const response = intlMiddleware(request);

    /**
     * A path with no locale prefix is answered by content negotiation — bare `/` sends a
     * Thai browser to `/th` and an English one to `/en`. That makes `Accept-Language` part
     * of the cache key, and without saying so a shared cache is free to hand one audience
     * the other's locale. Googlebot crawls without a Thai preference, so it is the visitor
     * most likely to be handed the wrong one.
     */
    if (!/^\/(en|th)(\/|$)/.test(pathname)) {
        response.headers.append("Vary", "Accept-Language");
    }

    return response;
}

export const config = {
    // `api` is excluded deliberately: the forwarder in `app/api/[...path]/route.ts` is
    // not a page and has no locale. Letting the intl middleware see it turned
    // `POST /api/user/register` into a 307 to `/en/api/user/register`, i.e. a 404 —
    // and a redirected POST is not something a fetch caller can recover from.
    matcher: [
        "/((?!admin|api|_next|.*\\..*).*)",
        "/admin/:path*",
    ],
};
