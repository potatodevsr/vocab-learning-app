import { ArrowRight, CalendarCheck, Flame } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CollectionMeter } from "@/components/play/collection-meter";
import { WeeklyGoalPrompt } from "@/components/play/weekly-goal-prompt";
import type { TodaySummary } from "@/lib/session-api";

/**
 * The authenticated home surface (`docs/LEARNER-LIFECYCLE.md` §3.6, §8 L2 gate): "a
 * logged-in request to `/` resolves to the lifecycle state's CTA rather than the
 * marketing page." Priority order matches §2 state precedence: due review beats an
 * in-progress session beats a fresh one.
 */
export async function TodayCard({ summary }: { summary: TodaySummary }) {
  const t = await getTranslations("Today");

  const primary = summary.inProgressSession
    ? {
        href: `/learn?level=${summary.inProgressSession.level}${
          summary.inProgressSession.unit ? `&unit=${summary.inProgressSession.unit}` : ""
        }`,
        label: t("continueSessionCta"),
        testId: "today-continue-session",
      }
    : summary.recommendedAction === "comeback"
      ? {
          href: `/learn?level=${summary.defaultLevel}&mode=comeback`,
          label: t("comebackCta"),
          testId: "today-comeback",
        }
    : summary.dueCount > 0
      ? {
          href: `/learn?level=${summary.defaultLevel}&mode=review`,
          label: t("dueReviewCta", { count: summary.dueCount }),
          testId: "today-due-review",
        }
      : summary.recommendedAction === "maintenance"
        ? {
            href: "/english/words",
            label: t("maintenanceCta"),
            testId: "today-maintenance",
          }
      : {
          href: `/learn?level=${summary.defaultLevel}${
            summary.nextUnit ? `&unit=${summary.nextUnit}` : ""
          }`,
          label: t("newLessonCta"),
          testId: "today-new-lesson",
        };

  const courseLevel = summary.collection.levels.find(
    (l) => l.level === summary.collection.courseLevel,
  );

  return (
    <main className="min-h-screen bg-background text-foreground" data-testid="today-card">
      <section className="border-b-3 border-ink bg-brand text-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 lg:px-8">
          <span className="play-stamp bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink">
            {t("greeting")}
          </span>

          <Button
            asChild
            size="lg"
            data-testid={primary.testId}
            className="play-key mt-6 h-16 w-full rounded-2xl bg-accent-sun px-7 text-lg font-extrabold text-ink hover:bg-accent-sun sm:w-auto"
          >
            <Link href={primary.href}>
              {primary.label}
              <ArrowRight className="size-5" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-3xl gap-6 px-6 py-10 lg:px-8">
        {courseLevel && (
          <CollectionMeter
            owned={courseLevel.strong}
            total={courseLevel.total}
            title={t("collectionMeterTitle")}
            caption={t("collectionMeterBody", {
              strong: courseLevel.strong,
              total: courseLevel.total,
              level: courseLevel.level,
            })}
          />
        )}

        <div
          className="play-tile flex items-center justify-between gap-4 p-5 [--tile-block:var(--accent-mint)]"
          data-testid="today-weekly-goal"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl border-3 border-ink bg-white text-ink">
              <Flame className="size-5" />
            </span>
            <div>
              <p className="font-semibold">{t("weeklyGoalTitle")}</p>
              {summary.weeklyGoal.goalDays ? (
                <p className="text-sm text-muted-foreground" data-testid="today-weekly-goal-progress">
                  {t("weeklyGoalProgress", {
                    active: summary.weeklyGoal.activeDaysThisWeek,
                    goal: summary.weeklyGoal.goalDays,
                  })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <CalendarCheck className="mr-1 inline size-4" aria-hidden />
                  {summary.weeklyGoal.activeDaysThisWeek}
                </p>
              )}
            </div>
          </div>
        </div>

        {/*
          The streak, and the reason it is phrased the way it is.

          Loss aversion is what makes a streak work (SPEC §5.4.1 principle 2), but the
          product promise is that a streak is a memory aid and not a threat
          (LEARNER-LIFECYCLE.md §1.2). So it states what the learner *has*, never what they
          are about to lose, and there is no countdown anywhere near it. The weekly number
          leads because a daily one punishes a single bad Tuesday and this audience is
          working adults.

          Nothing is rendered until there is something real to show: a zero streak on a
          card is a scolding, and a learner on day one has done nothing wrong.
        */}
        {summary.streak.weeks > 0 || summary.streak.days > 0 ? (
          <div className="play-card mt-4 flex items-center gap-3 p-5" data-testid="today-streak">
            <span className="flex size-11 items-center justify-center rounded-2xl border-3 border-ink bg-accent-sun text-ink">
              <Flame className="size-5" />
            </span>
            <div>
              {summary.streak.weeks > 0 ? (
                <p className="font-semibold" data-testid="today-streak-weeks">
                  {t("streakWeeks", { weeks: summary.streak.weeks })}
                </p>
              ) : null}
              {summary.streak.days > 0 ? (
                <p
                  className={
                    summary.streak.weeks > 0
                      ? "text-sm text-muted-foreground"
                      : "font-semibold"
                  }
                  data-testid="today-streak-days"
                >
                  {t("streakDays", { days: summary.streak.days })}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {!summary.weeklyGoal.goalDays && summary.weeklyGoal.eligibleToSetGoal && (
          <WeeklyGoalPrompt />
        )}
      </section>
    </main>
  );
}
