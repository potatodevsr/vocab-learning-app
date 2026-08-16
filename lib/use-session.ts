"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { getMe, type User } from "@/lib/user-api";

/**
 * The `signed_in` hint the API sets alongside the `httpOnly` session token. It carries no
 * identity and is never trusted for authorisation — every protected route still checks
 * `user_token` server-side. It exists so the browser can answer "is anyone signed in?"
 * without asking the server.
 */
const SESSION_HINT = "signed_in";

const hasSessionHint = () =>
    typeof document !== "undefined" &&
    document.cookie.split("; ").some((part) => part.startsWith(`${SESSION_HINT}=`));

/**
 * The current user, or `null`.
 *
 * `undefined` while unknown, so a caller can tell "still loading" from "definitely nobody"
 * and avoid rendering a signed-out bar for a frame to someone who is signed in.
 *
 * The hint check is the point of this hook. `getMe()` used to run on every page load for
 * every visitor, which meant a logged-out reader generated a `GET /api/user/me` — a Worker
 * invocation, a D1 read, and a red 401 in the console — on every single pageview, to
 * establish something the absence of a cookie already established.
 */
export function useSession() {
    const pathname = usePathname();
    const [user, setUser] = useState<User | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        if (!hasSessionHint()) {
            // Resolve on the microtask queue like the authenticated `getMe` branch below.
            // A synchronous state write inside an effect causes a cascading render and is
            // rejected by the React hooks lint rule.
            queueMicrotask(() => {
                if (!cancelled) setUser(null);
            });
            return () => {
                cancelled = true;
            };
        }

        getMe().then((value) => {
            if (!cancelled) setUser(value);
        });

        return () => {
            cancelled = true;
        };
    }, [pathname]);

    /**
     * Drop the session locally, without waiting for a re-read.
     *
     * The effect above is keyed on `pathname`, so signing out while already on the page
     * you are redirected to does not re-run it — the bar kept showing the account menu
     * until something else navigated. The old component-local state cleared itself on
     * logout; lifting it here has to keep that.
     */
    const clear = useCallback(() => setUser(null), []);

    return { user, signedIn: user != null, resolved: user !== undefined, clear };
}
