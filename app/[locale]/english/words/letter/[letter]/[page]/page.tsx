import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { WordsLetter, letterMetadata } from "@/components/words-letter";

/**
 * Pages 2+ of one A–Z letter — `/english/words/letter/s/2` (SEO-CONTENT §E).
 *
 * A path segment rather than `?page=2` so the route can be statically rendered and served
 * from the incremental cache; `searchParams` is a request-time API and would force a
 * dynamic render on all 52 letter URLs. `/letter/s/1` is a 404, not a redirect: page 1 has
 * one address and it is the bare `/letter/s`.
 */
export const revalidate = 3600;

/** ISR on demand, like the bare letter route above it and the word pages. */
export function generateStaticParams() {
  return [];
}

type LetterPageRouteProps = {
  params: Promise<{ locale: string; letter: string; page: string }>;
};

export async function generateMetadata({
  params,
}: LetterPageRouteProps): Promise<Metadata> {
  const { locale, letter, page } = await params;

  return letterMetadata({ locale, letter, page });
}

export default async function WordsLetterPagedPage({
  params,
}: LetterPageRouteProps) {
  const { locale, letter, page } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);

  return <WordsLetter locale={locale} letter={letter} page={page} />;
}
