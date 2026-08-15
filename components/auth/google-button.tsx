"use client";

import { useLocale, useTranslations } from "next-intl";

/**
 * Starts the Google redirect flow.
 *
 * A plain anchor, deliberately. `next/link` would try to client-side navigate, and the
 * target is not a page — it is the `/api/*` forwarder handing off to the API Worker, which
 * answers with a 302 to accounts.google.com. The browser has to make that request itself.
 *
 * The mark is inlined rather than fetched: the app runs on a Worker behind a strict CSP,
 * and a sign-in button that silently loses its logo to a blocked request is worse than one
 * that carries four extra paths of SVG.
 */
export function GoogleButton({ from }: { from?: string }) {
  const locale = useLocale();
  const t = useTranslations("Auth");

  const params = new URLSearchParams({ locale });
  if (from) params.set("from", from);

  return (
    <a
      href={`/api/user/google/start?${params.toString()}`}
      className="play-press play-focus flex h-14 w-full items-center justify-center gap-3 rounded-2xl border-3 border-ink bg-card text-base font-extrabold text-ink hover:bg-brand-soft"
    >
      <svg aria-hidden viewBox="0 0 18 18" className="size-5">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
        />
      </svg>

      {t("googleSignIn")}
    </a>
  );
}

/** A labelled rule, so the two sign-in routes read as alternatives rather than a stack. */
export function AuthDivider() {
  const t = useTranslations("Auth");

  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-0.5 flex-1 bg-ink/15" />
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {t("orDivider")}
      </span>
      <span className="h-0.5 flex-1 bg-ink/15" />
    </div>
  );
}
