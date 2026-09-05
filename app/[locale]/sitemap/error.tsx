"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * The HTML sitemap's boundary — what a *reader* gets when the corpus cannot be read.
 *
 * Crawler safety is deliberately **not** handled here. It used to be: this component
 * emitted its own `<meta name="robots" content="noindex, follow">`, which arrives only
 * after hydration and therefore did nothing for the raw HTML an HTML-limited crawler
 * reads — while a hydrated browser ended up holding that tag *and* the `index, follow`
 * one `generateMetadata` had already emitted, which is worse than either alone. The
 * directive now comes from `generateMetadata` in `page.tsx`, which resolves before
 * streaming begins and so lands in the first chunk. One tag, correct from byte one.
 */
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("HtmlSitemap");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-20 text-center">
      <h1 className="text-2xl font-bold" data-testid="sitemap-error">
        {t("errorTitle")}
      </h1>
      <button
        className="play-press mt-6 rounded-full bg-brand px-6 py-3 font-bold text-white"
        onClick={reset}
      >
        {t("retry")}
      </button>
    </main>
  );
}
