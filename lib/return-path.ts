/**
 * Turning a caller-supplied `from`/`returnTo` into a destination we are willing to send a
 * browser to.
 *
 * The lifecycle contract (`docs/LEARNER-LIFECYCLE.md` §3.3, §6) is "preserve a returnTo …
 * after authentication, return directly to the result; never dump the learner on `/`".
 * The middleware already round-trips it: a protected route redirects to
 * `/{locale}/auth/login?from={encodeURIComponent(pathname)}`. The value is *validated*,
 * not signed or otherwise authenticated — it still reaches the client from the URL, so it
 * is attacker-controllable, and a redirect target is exactly the classic open-redirect
 * sink — `?from=https://evil.example` would let a phishing link borrow our domain to
 * bounce a freshly-authenticated user off-site.
 *
 * So the rule is: only ever a *root-relative, same-origin* path, and never back into a
 * surface that is not a learner page. Anything we cannot prove is safe becomes the
 * caller's fallback (the localised home), because a slightly wrong destination is a far
 * better failure than a redirect to an attacker.
 */

/**
 * True if `value` contains any ASCII control byte (NUL–US or DEL). Those never belong in
 * a path we generated, and a smuggled newline is a classic way past a naive filter. Done
 * by code point rather than a control-char regex literal, which is fragile to edit.
 */
const hasControlChar = (value: string): boolean => {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) return true;
    }
    return false;
};

/** Path prefixes we refuse to bounce into even when same-origin. */
const isForbiddenTarget = (path: string): boolean => {
    // `/api` is the forwarder, not a page. `/admin` has its own auth. Bouncing back into
    // `/auth` re-opens the very login/register screen we just came from — a loop.
    if (path === "/api" || path.startsWith("/api/")) return true;
    if (path === "/admin" || path.startsWith("/admin/")) return true;
    if (/^\/(en|th)\/auth(\/|$)/.test(path)) return true;
    return false;
};

/**
 * A percent-encoded slash, backslash or control byte. None of these appear in a path we
 * generated ourselves — `encodeURIComponent` on a real pathname never produces one, since
 * `/` is only a structural separator. Seeing one here means the caller handed us a value
 * that carries an *extra* layer of encoding on top of the one the browser already
 * resolved (`%2F` decoding to `/`, `%255C` decoding to `%5C` then to `\`, and so on). That
 * extra layer is exactly how a double-encoded `%252F%252Fevil.example` slips a
 * protocol-relative host past a filter that only checks for a literal `//` — so it is
 * rejected outright rather than decoded further.
 */
const hasSuspiciousEncoding = (value: string): boolean =>
    /%(2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value);

/**
 * Validate `raw` into a safe same-origin path, or return `/{locale}` when it is missing,
 * malformed, off-origin or a forbidden surface.
 *
 * `raw` arrives already decoded exactly once: every caller reads it from
 * `URLSearchParams`/`useSearchParams`, both of which decode the query string themselves.
 * This function must not decode it again — a second `decodeURIComponent` pass is what let
 * a double-encoded value (`%252F%252Fevil.example`, single-decoded here to
 * `%2F%2Fevil.example`) turn into the very `//evil.example` the checks below exist to
 * catch, and it also corrupts a legitimate path or query value that happens to contain a
 * real `%` once the browser has already resolved it (e.g. a search term with an accented
 * character). So: validate the single-decoded string as-is, and treat any *remaining*
 * percent-encoding of a slash, backslash or control byte as proof of a second encoding
 * layer — reject it rather than guess what it was trying to hide.
 */
export const safeReturnPath = (
    raw: string | null | undefined,
    locale: string,
): string => {
    const fallback = `/${locale}`;
    if (!raw) return fallback;

    const value = raw.trim();
    if (!value) return fallback;

    // Must be root-relative. This alone rejects `http://`, `https://` and any scheme.
    if (!value.startsWith("/")) return fallback;

    // `//host` and `/\host` are protocol-relative URLs the browser resolves off-origin;
    // any backslash is a normalisation trick, so refuse the lot.
    if (value.startsWith("//") || value.includes("\\")) return fallback;

    // No whitespace and no control bytes in a path we generated.
    if (/\s/.test(value) || hasControlChar(value)) return fallback;

    // A second layer of percent-encoding is a double-encoded redirect attempt, not a
    // legitimate path or query value — those were already resolved by the caller.
    if (hasSuspiciousEncoding(value)) return fallback;

    // Compare against the path portion only, so a query string cannot disguise the target.
    const pathOnly = value.split(/[?#]/)[0];
    if (isForbiddenTarget(pathOnly)) return fallback;

    return value;
};
