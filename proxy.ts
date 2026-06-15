import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const PROTECTED_USER_PATHS = ["/learn", "/quiz"];

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/admin")) {
        if (pathname === "/admin/login") return NextResponse.next();
        const token = request.cookies.get("admin_token")?.value;
        if (!token) return NextResponse.redirect(new URL("/admin/login", request.url));
        try {
            const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);
            await jwtVerify(token, secret);
            return NextResponse.next();
        } catch {
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }
    }

    const isProtected = PROTECTED_USER_PATHS.some((p) =>
        pathname.match(new RegExp(`^/(en|th)${p}`))
    );

    if (isProtected) {
        const token = request.cookies.get("user_token")?.value;
        if (!token) {
            const locale = pathname.split("/")[1] || "en";
            const from = encodeURIComponent(pathname);
            return NextResponse.redirect(
                new URL(`/${locale}/auth/login?from=${from}`, request.url)
            );
        }
        try {
            const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);
            await jwtVerify(token, secret);
        } catch {
            const locale = pathname.split("/")[1] || "en";
            return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
        }
    }

    return intlMiddleware(request);
}

export const config = {
    matcher: [
        "/((?!admin|_next|.*\\..*).*)",
        "/admin/:path*",
    ],
};