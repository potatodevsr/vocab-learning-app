import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

/**
 * Security headers.
 *
 * None of these existed: responses carried `X-Powered-By` and nothing else. They are set
 * here rather than at the edge so they hold in `next dev`, in the e2e suite and on
 * Cloudflare alike — a header that only exists in production is a header nobody tests.
 *
 * HSTS is deliberately absent. It belongs to whatever terminates TLS, and setting it from
 * the app would be a lie on `http://localhost`.
 */
const SECURITY_HEADERS = [
  // Stops a browser second-guessing our Content-Type. The `/api/*` forwarder streams
  // whatever the API returns, so this is the difference between a JSON body and a sniffed
  // executable one.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Referrer leaks the learner's path. `/th/english/words/<word>` is harmless; a
  // `?from=/th/profile` on the login page is not.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Nothing here is meant to be embedded. `frame-ancestors` is the modern spelling and
  // `X-Frame-Options` covers what still only understands the old one.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },

  // No feature on this site needs any of them, and a vocabulary app asking for a camera
  // is exactly the prompt that makes someone close the tab.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },

  experimental: {
    /**
     * `app/global-not-found.tsx` — the 404 for a URL that matches no route.
     *
     * Required because this app's root layout is a top-level dynamic segment
     * (`app/[locale]/layout.tsx`), which Next's docs name as the case where `not-found.js`
     * cannot compose a 404. Without it, every URL `middleware.ts` rejects was answered by
     * Next's built-in English page — to a Thai audience.
     */
    globalNotFound: true,
  },

  // Free advertising of the stack, on every response, for no benefit.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
