import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 normally uses `proxy.ts` with the Node.js runtime. OpenNext Cloudflare
// 1.20 cannot bundle Node.js Proxy yet, so the documented `middleware.ts` compatibility
// path keeps this request boundary on its default Edge runtime until adapter support lands.

// Hreflang behaviour lives in `i18n/routing.ts` (`alternateLinks: false`) — it is a
// routing option in next-intl 4, not a middleware argument.
const intlMiddleware = createMiddleware(routing);
const PROTECTED_USER_PATHS = ["/learn", "/quiz", "/profile"];

/**
 * The unit checkpoint is a private graded gate (`docs/LEARNER-LIFECYCLE.md` §3.8) nested
 * under the public unit page, so a flat prefix cannot express it. Its entry point is only
 * shown to signed-in learners, but a directly-typed URL must land on login, not on an
 * immersive shell it will only 401 out of.
 */
const CHECKPOINT_PATH = /^\/(en|th)\/english\/[^/]+\/unit\/[^/]+\/checkpoint(\/|$)/;

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

    return intlMiddleware(request);
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
