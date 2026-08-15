"use client";

import { useEffect, useState } from "react";
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
        if (!hasSessionHint()) {
            setUser(null);
            return;
        }

        let cancelled = false;
        getMe().then((value) => {
            if (!cancelled) setUser(value);
        });

        return () => {
            cancelled = true;
        };
    }, [pathname]);

    return { user, signedIn: user != null, resolved: user !== undefined };
}
