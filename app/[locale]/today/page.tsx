import type { Metadata } from "next";
import { cookies } from "next/headers";

import { MarketingHome, homeMetadata } from "@/components/home/marketing-home";
import { TrackPageView } from "@/components/track-page-view";
import { TodayCard } from "@/components/play/today-card";
import { getTodaySummaryWithToken } from "@/lib/session-api";

/**
 * The signed-in half of `/`, split out so the anonymous half can be cached.
 *
 * Nobody navigates here: `middleware.ts` rewrites a request for `/[locale]` to this route
 * when the visitor carries a valid `user_token`, so the address bar still reads `/` and
 * the §8 L2 gate — "a logged-in request to `/` resolves to the lifecycle state's CTA
 * rather than the marketing page" (docs/LEARNER-LIFECYCLE.md) — behaves exactly as it did
 * when the branch lived inside the page. A directly-typed URL is treated as a protected
 * path by the same middleware and lands on login.
 *
 * Because a rewrite keeps the URL, the `<head>` is deliberately the *home* page's — see
 * `homeMetadata`, which both routes share so the two can never drift.
 */

type TodayProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: TodayProps): Promise<Metadata> {
  const { locale } = await params;

  return homeMetadata({ locale, index: false });
}

export default async function TodayPage({ params }: TodayProps) {
  const { locale } = await params;

  const token = (await cookies()).get("user_token")?.value;
  const summary = token ? await getTodaySummaryWithToken(token) : null;

  // The API can decline — an expired session, a user row that no longer exists. The old
  // inline branch fell through to the marketing page in that case, and so does this.
  if (!summary) return <MarketingHome locale={locale} />;

  return (
    <>
      <TrackPageView family="home" locale={locale} />
      <TodayCard summary={summary} />
    </>
  );
}
