import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { MarketingHome, homeMetadata } from "@/components/home/marketing-home";

/**
 * Public content: cacheable, re-rendered hourly.
 *
 * This page used to read `cookies()` so it could show a signed-in learner their Today
 * card instead of the marketing page (docs/LEARNER-LIFECYCLE.md §8 L2). That made the
 * site's most-requested URL dynamic for everybody — a full render per anonymous visit and
 * per crawler hit, at 327–714 ms of Worker CPU, on a page whose output never varied.
 *
 * The branch moved to `middleware.ts`, which rewrites a signed-in request for `/[locale]`
 * to `/[locale]/today`. `/` still resolves to the lifecycle CTA for a logged-in learner —
 * the gate is unchanged — but the anonymous render is now an ISR entry that cache
 * interception serves before the Next.js server is constructed.
 */
export const revalidate = 3600;

type HomeProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: HomeProps): Promise<Metadata> {
  const { locale } = await params;

  return homeMetadata({ locale });
}

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);

  return <MarketingHome locale={locale} />;
}
