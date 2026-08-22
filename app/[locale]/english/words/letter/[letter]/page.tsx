import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { WordsLetter, letterMetadata } from "@/components/words-letter";

/**
 * Page 1 of one A–Z letter (SEO-CONTENT §E). Pages 2+ live under `[page]`; the render, the
 * paging rules and the metadata are shared from `components/words-letter.tsx`.
 *
 * Public content: cacheable, re-rendered hourly. This route used to read `searchParams`
 * for `?page=`, which is a request-time API and forced a dynamic render — see the note in
 * the shared component for what that cost.
 */
export const revalidate = 3600;

/**
 * Declaring `generateStaticParams` is what opts a dynamic segment into incremental static
 * regeneration; returning nothing from it means no page is built up front. Each letter is
 * rendered on first request and then cached for `revalidate` — the same trade the word
 * pages make, and the reason a deploy does not have to walk 3,000 words 26 times.
 */
export function generateStaticParams() {
  return [];
}

type LetterRouteProps = { params: Promise<{ locale: string; letter: string }> };

export async function generateMetadata({
  params,
}: LetterRouteProps): Promise<Metadata> {
  const { locale, letter } = await params;

  return letterMetadata({ locale, letter });
}

export default async function WordsLetterPage({ params }: LetterRouteProps) {
  const { locale, letter } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);

  return <WordsLetter locale={locale} letter={letter} />;
}
