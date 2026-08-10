import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 normally uses `proxy.ts` with the Node.js runtime. OpenNext Cloudflare
// 1.20 cannot bundle Node.js Proxy yet, so the documented `middleware.ts` compatibility
// path keeps this request boundary on its default Edge runtime until adapter support lands.

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

    return new TextEncoder().encode(secret);
};

type Role = "admin" | "user";

const hasRole = async (token: string | undefined, role: Role) => {
    if (!token) return false;

    try {
        const { payload } = await jwtVerify(token, getSecret());
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
