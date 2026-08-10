"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

/**
 * Fires GA4's `page_view` manually, once per route change, from `usePathname()` alone.
 * `usePathname()` structurally cannot contain a query string or a fragment — it is the
 * matched route path, nothing else — so this can never forward a magic-link `token` or a
 * `from` redirect target the way GA4's built-in automatic page_view (which reads
 * `document.location.href` verbatim) would on `/auth/verify?token=…`.
 *
 * `components/google-analytics.tsx` disables the automatic page_view (`send_page_view:
 * false`) so this is the only page_view source; without both halves, the app would either
 * leak query strings (automatic page_view left on) or under-count navigation (automatic
 * page_view off with no replacement).
 */
export function GaPageViewTracker() {
    const pathname = usePathname();

    useEffect(() => {
        const win = window as GtagWindow;
        if (typeof win.gtag !== "function") return;

        win.gtag("event", "page_view", {
            page_location: `${window.location.origin}${pathname}`,
            page_path: pathname,
        });
    }, [pathname]);

    return null;
}
