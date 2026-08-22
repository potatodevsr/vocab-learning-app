import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Flame, Target } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ActivityCalendar } from "@/components/play/activity-calendar";
import { CollectionMeter } from "@/components/play/collection-meter";
import { ShareResult } from "@/components/play/share-result";
import {
  getProgressHistoryWithToken,
  getProgressSummaryWithToken,
} from "@/lib/progress-api";
import { getTodaySummaryWithToken } from "@/lib/session-api";
import { privateMetadata } from "@/lib/seo";

type ProgressPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: ProgressPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });

  return privateMetadata(t("progress"));
}

/**
 * The learner's own history — the page the navbar used to link at an empty directory.
 *
 * It answers three questions the daily loop cannot: *have I been consistent* (the
 * calendar), *how much of the Oxford 3000 do I own* (the meter), and *what have I actually
 * done* (the counts). All three are derived on read from ledger rows, so nothing here can
 * disagree with the Today card.
 *
 * `noindex`: a learner's history is theirs (SPEC §9.1).
 */
export default async function ProgressPage({ params }: ProgressPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Progress");
  const token = (await cookies()).get("user_token")?.value;

  if (!token) {
    redirect(`/${locale}/auth/login?from=/${locale}/progress`);
  }

  const [summary, history, today] = await Promise.all([
    getProgressSummaryWithToken(token),
    getProgressHistoryWithToken(token),
    getTodaySummaryWithToken(token),
  ]);

  if (!summary) {
    redirect(`/${locale}/auth/login?from=/${locale}/progress`);
  }

  const stats = [
    { key: "sessions", value: summary.lessons + summary.quizzes, label: t("statSessions") },
    { key: "words-seen", value: summary.wordsSeen, label: t("statWordsSeen") },
    { key: "words-known", value: summary.wordsKnown, label: t("statWordsKnown") },
    { key: "words-mastered", value: summary.wordsMastered, label: t("statWordsMastered") },
  ];

  const weeklyGoal = today?.weeklyGoal ?? null;

  const collection = today
    ? {
        owned: today.collection.totalStrong,
        total: today.collection.levels.reduce((sum, level) => sum + level.total, 0),
      }
    : null;

  return (
    <main className="min-h-screen bg-background text-foreground" data-testid="progress-page">
      <section className="border-b-3 border-ink bg-brand text-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
          <h1 className="play-display">{t("title")}</h1>
          <p className="mt-3 max-w-xl text-white/90">{t("subtitle")}</p>

          {/* Same numbers as the Today card, from the same read — a streak that disagrees
              with itself across two screens is worse than no streak. */}
          {today && (today.streak.weeks > 0 || today.streak.days > 0) ? (
            <p
              className="mt-6 mr-3 inline-flex items-center gap-2 rounded-full border-3 border-ink bg-accent-sun px-4 py-2 text-sm font-bold text-ink"
              data-testid="progress-streak"
            >
              <Flame className="size-4" aria-hidden />
              {today.streak.weeks > 0
                ? t("streakWeeks", { weeks: today.streak.weeks })
                : t("streakDays", { days: today.streak.days })}
            </p>
          ) : null}

          {weeklyGoal?.goalDays ? (
            <p
              className="mt-6 inline-flex items-center gap-2 rounded-full border-3 border-ink bg-accent-sun px-4 py-2 text-sm font-bold text-ink"
              data-testid="progress-weekly-goal"
            >
              <Target className="size-4" aria-hidden />
              {t("weeklyGoal", {
                done: weeklyGoal.activeDaysThisWeek,
                goal: weeklyGoal.goalDays,
              })}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-6 px-6 py-10 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-4" data-testid="progress-stats">
          {stats.map((stat) => (
            <div
              key={stat.key}
              className="play-card p-5"
              data-testid={`progress-stat-${stat.key}`}
            >
              <p className="play-count text-3xl">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {history ? (
          <ActivityCalendar
            history={history}
            title={t("calendarTitle")}
            caption={t("calendarCaption")}
            emptyLabel={t("calendarEmpty")}
            dayLabel={(day, items) => t("calendarDay", { day, items })}
          />
        ) : null}

        {/*
          Whole-course, not the current level: this page is where "how far through the
          Oxford 3000 am I" is the question, while the Today card deliberately scopes the
          same meter to the level being studied so the bar can visibly move in a week.
        */}
        {collection ? (
          <CollectionMeter
            owned={collection.owned}
            total={collection.total}
            title={t("collectionTitle")}
            caption={t("collectionCaption")}
          />
        ) : null}

        {summary.mistakes > 0 ? (
          <Link
            href="/review"
            className="play-card flex items-center justify-between gap-4 p-6 transition-transform hover:-translate-y-0.5"
            data-testid="progress-mistakes-link"
          >
            <span>
              <span className="block text-lg font-semibold">
                {t("mistakesTitle", { count: summary.mistakes })}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t("mistakesCaption")}
              </span>
            </span>
            <Flame className="size-6 shrink-0 text-warn" aria-hidden />
          </Link>
        ) : null}

        {/* The share sits next to the meter's number, because that number is what there is
            to share — a finite collection a stranger can understand. */}
        {collection && collection.owned > 0 ? (
          <ShareResult owned={collection.owned} total={collection.total} className="w-fit" />
        ) : null}

        <Button
          asChild
          className="play-key h-14 w-fit rounded-2xl bg-brand px-7 text-base font-extrabold text-white hover:bg-brand"
        >
          <Link href="/">
            {t("cta")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
    </main>
  );
}
