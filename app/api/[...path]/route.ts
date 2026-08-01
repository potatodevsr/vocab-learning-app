import type { NextRequest } from "next/server";

import { API_ORIGIN } from "@/constants/config";

/**
 * The `/api/*` forwarder (`docs/SPEC.md` §2.1, binding table §3.3).
 *
 * The browser only ever talks to this origin. Everything under `/api` is handed to the
 * api Worker — over the `API` service binding when one is bound (the request never
 * leaves Cloudflare's network), and over plain HTTP to {@link API_ORIGIN} otherwise,
 * which is how `next dev` and the e2e suite run.
 *
 * Without this route `/api/user/register` fell through to the locale middleware, which
 * redirected it to `/en/api/user/register` — a page that does not exist. Every learner
 * saw sign-up answer 404.
 */

// A proxy must never be prerendered or cached: the response depends on cookies.
export const dynamic = "force-dynamic";

/** The shape of a service binding, without a `@cloudflare/workers-types` dependency. */
type ServiceBinding = { fetch: (request: Request) => Promise<Response> };

declare global {
    interface CloudflareEnv {
        /** Service binding to the api Worker. Absent under `next dev` and in e2e. */
        API?: ServiceBinding;
        /** Runtime override for the api Worker's origin, used when `API` is unbound. */
        API_ORIGIN?: string;
    }
}

/**
 * Hop-by-hop and body-length headers. `fetch` recomputes them for the connection it
 * actually opens, so a copied value is at best redundant and at worst a lie — a relayed
 * `content-encoding: gzip` on an already-decoded body breaks the client.
 */
const DROPPED_REQUEST_HEADERS = [
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
    "accept-encoding",
];

const DROPPED_RESPONSE_HEADERS = [
    "content-encoding",
    "content-length",
    "transfer-encoding",
];

/**
 * The api Worker's binding, or null when there is nothing to bind.
 *
 * The workerd check is not decoration. Off a Worker, `getCloudflareContext({async})`
 * falls back to a platform proxy that reads `wrangler.jsonc` — so under `next start` it
 * happily hands back the *production* `API_ORIGIN`, and the e2e suite would test the
 * deployed API instead of the disposable one on :4100.
 */
const serviceBinding = async (): Promise<ServiceBinding | null> => {
    if (globalThis.navigator?.userAgent !== "Cloudflare-Workers") return null;

    try {
        const { getCloudflareContext } = await import("@opennextjs/cloudflare");

        return (await getCloudflareContext({ async: true })).env.API ?? null;
    } catch {
        return null;
    }
};

const problem = (message: string) =>
    Response.json({ message }, { status: 502 });

const forward = async (request: NextRequest): Promise<Response> => {
    const url = new URL(request.url);
    const path = `${url.pathname.replace(/^\/api/, "")}${url.search}`;

    const binding = await serviceBinding();
    // Read at request time, not at module scope: OpenNext copies the Worker's vars into
    // `process.env` per request, which is after this module was first evaluated.
    const origin = (process.env.API_ORIGIN ?? API_ORIGIN).replace(/\/+$/, "");

    // Over the binding the hostname is irrelevant (the request is dispatched to the
    // Worker, not routed), so we keep the browser's scheme and host. That matters: the
    // API decides whether to mark its cookie `Secure` from the URL it is handed, and a
    // `Secure` cookie set over plain http in local dev is silently dropped.
    let target: URL;

    try {
        target = binding ? new URL(path, url.origin) : new URL(`${origin}${path}`);
    } catch {
        // An unset or relative API origin: worth saying out loud, because the symptom
        // downstream is an unexplained 500 on every call the app makes.
        return problem(`"${origin}" is not a usable API origin.`);
    }

    if (!binding && target.origin === url.origin) {
        return problem(
            `The API origin (${origin}) is the web origin. Set API_ORIGIN to the api Worker, or bind it as API.`,
        );
    }

    const headers = new Headers(request.headers);
    for (const name of DROPPED_REQUEST_HEADERS) headers.delete(name);

    // Buffered, not streamed: a stream cannot be replayed, and Workers rejects a
    // streaming request body that does not declare `duplex`.
    const body =
        request.method === "GET" || request.method === "HEAD"
            ? undefined
            : await request.arrayBuffer();

    const upstream = new Request(target, {
        method: request.method,
        headers,
        body,
        // The API's own redirects belong to the browser, not to us.
        redirect: "manual",
    });

    let response: Response;

    try {
        response = binding ? await binding.fetch(upstream) : await fetch(upstream);
    } catch {
        return problem(`The API at ${target.origin} is unreachable.`);
    }

    const responseHeaders = new Headers();

    response.headers.forEach((value, name) => {
        if (name === "set-cookie") return;
        if (DROPPED_RESPONSE_HEADERS.includes(name)) return;

        responseHeaders.set(name, value);
    });

    // `Set-Cookie` is the one header that may legitimately repeat: register and login
    // relay the session cookie, and folding two into one comma-joined value would lose
    // the session. `getSetCookie` is the only accessor that keeps them apart.
    for (const cookie of response.headers.getSetCookie()) {
        responseHeaders.append("set-cookie", cookie);
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    });
};

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
