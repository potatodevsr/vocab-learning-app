/**
 * Where the api Worker actually lives, as an absolute origin. Only two callers may use
 * it: the `/api/*` forwarder (`app/api/[...path]/route.ts`) and server-side rendering,
 * which has no origin to be relative to. See AGENTS.md rule 5 and `docs/SPEC.md` §2.1.
 *
 * `API_ORIGIN` is the runtime Worker var (settable without a rebuild);
 * `NEXT_PUBLIC_API_URL` is the build-time value `pnpm dev` and the e2e suite provide.
 * Neither may point back at the web origin — that would make the forwarder call itself.
 */
export const API_ORIGIN =
    process.env.API_ORIGIN ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";

/**
 * The single source of truth for what application code fetches — everything that talks
 * to the API imports this.
 *
 * In the browser it is a **same-origin path**: requests go to the web Worker's `/api/*`
 * forwarder, so there is no CORS preflight, no second hostname, and the API's cookies
 * are first-party. A build that shipped the api origin here is what sent
 * `POST /api/user/register` through the locale middleware and into a 404.
 *
 * On the server there is no page origin to resolve a relative URL against — and at build
 * time no web server is even listening — so server components go straight to the API.
 */
export const API_URL = typeof window === "undefined" ? API_ORIGIN : "/api";
