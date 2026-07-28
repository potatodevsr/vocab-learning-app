import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, Mail, Sparkles, UserRound } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMeWithToken } from "@/lib/user-api";
import { getProgressSummaryWithToken } from "@/lib/progress-api";
import { getPublishedWordCount } from "@/lib/oxford-words";
import { CollectionMeter } from "@/components/play/collection-meter";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("โปรไฟล์");

type ProfilePageProps = {
  params: Promise<{ locale: string }>;
};

const formatJoined = (value: string | undefined, locale: string) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = await params;
  const t = await getTranslations("Profile");

  // proxy.ts already gates this route; reading the cookie here is what lets a Server
  // Component call the API as the signed-in user.
  const token = (await cookies()).get("user_token")?.value;
  const [user, summary, publishedWords] = await Promise.all([
    token ? getMeWithToken(token) : null,
    token ? getProgressSummaryWithToken(token) : null,
    getPublishedWordCount(),
  ]);

  if (!user) {
    redirect(`/${locale}/auth/login?from=/${locale}/profile`);
  }

  const hasProgress = Boolean(summary && summary.lessons + summary.quizzes > 0);

  const stats = summary
    ? [
        { key: "lessons", value: summary.lessons, label: t("statLessons") },
        { key: "quizzes", value: summary.quizzes, label: t("statQuizzes") },
        {
          key: "words-known",
          value: summary.wordsKnown,
          label: t("statWordsKnown"),
        },
        {
          key: "mastered",
          value: summary.wordsMastered,
          label: t("statMastered"),
        },
        {
          key: "accuracy",
          value:
            summary.recentAccuracy === null ? "—" : `${summary.recentAccuracy}%`,
          label: t("statAccuracy"),
        },
      ]
    : [];

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const joined = formatJoined(user.createdAt, locale);
  const initial = (user.username || user.email).charAt(0).toUpperCase();

  // `key` is locale-independent on purpose — it is what tests and styling hook onto,
  // while `label` is translated copy.
  const details = [
    { key: "username", icon: UserRound, label: t("username"), value: user.username },
    { key: "email", icon: Mail, label: t("email"), value: user.email },
    ...(fullName
      ? [{ key: "name", icon: Sparkles, label: t("name"), value: fullName }]
      : []),
    ...(joined
      ? [
          {
            key: "member-since",
            icon: CalendarDays,
            label: t("memberSince"),
            value: joined,
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
          <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
            {t("badge")}
          </Badge>

          <div className="mt-6 flex flex-wrap items-center gap-5">
            <div
              aria-hidden
              className="play-wiggle flex size-20 items-center justify-center rounded-3xl border-3 border-ink bg-accent-sun text-3xl font-extrabold text-ink"
            >
              {initial}
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {fullName || user.username}
              </h1>
              <p className="mt-1 text-sm text-zinc-300">{user.email}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-6 px-6 py-10 lg:px-8">
        <Card className="rounded-3xl bg-white">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-xl font-semibold">{t("accountTitle")}</h2>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {details.map((detail) => {
                const Icon = detail.icon;

                return (
                  <div
                    key={detail.key}
                    className="flex items-start gap-3 rounded-2xl border bg-zinc-50 px-4 py-3"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <dt className="text-xs uppercase tracking-wide text-zinc-500">
                        {detail.label}
                      </dt>
                      <dd
                        className="mt-1 truncate font-medium"
                        data-testid={`profile-${detail.key}`}
                      >
                        {detail.value}
                      </dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </CardContent>
        </Card>

        {summary && (
          <CollectionMeter
            owned={summary.wordsMastered}
            total={publishedWords}
            title={t("collectionTitle")}
            caption={t("collectionCaption")}
          />
        )}

        {summary && summary.mistakes > 0 && (
          <Link
            href="/review"
            data-testid="profile-mistakes-cta"
            className="play-tile play-focus flex items-center justify-between gap-4 p-6 [--tile-block:var(--warn)]"
          >
            <div>
              <p className="text-lg font-semibold">{t("reviewMistakes")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.mistakes} {t("statMistakes")}
              </p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-2xl bg-warn-soft text-warn">
              <ArrowRight className="size-5" />
            </span>
          </Link>
        )}

        <Card
          className={
            hasProgress
              ? "rounded-3xl bg-white"
              : "rounded-3xl border-dashed bg-white"
          }
        >
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-xl font-semibold">
              {hasProgress ? t("progressTitle") : t("progressEmptyTitle")}
            </h2>

            {hasProgress ? (
              <>
                <div
                  className="mt-6 grid gap-3 sm:grid-cols-4"
                  data-testid="profile-stats"
                >
                  {stats.map((stat) => (
                    <div
                      key={stat.key}
                      className="rounded-2xl border bg-zinc-50 p-4"
                    >
                      <p
                        className="text-3xl font-semibold"
                        data-testid={`stat-${stat.key}`}
                      >
                        {stat.value}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {summary!.recentQuizzes.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-zinc-500">
                      {t("recentQuizzes")}
                    </h3>

                    <ul className="mt-3 grid gap-2" data-testid="recent-quizzes">
                      {summary!.recentQuizzes.map((quiz) => (
                        <li
                          key={quiz.id}
                          className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3 text-sm"
                        >
                          <span className="font-medium">
                            {quiz.level} · {t("unitShort")} {quiz.unit}
                          </span>
                          <span className="text-zinc-600">
                            {quiz.score}/{quiz.total}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                {t("progressEmptyBody")}
              </p>
            )}

            <Button
              asChild
              className="play-press mt-6 h-11 rounded-full bg-brand px-6 text-white hover:bg-brand"
            >
              <Link
                href={
                  summary?.lastSession
                    ? `/learn?level=${summary.lastSession.level}&unit=${summary.lastSession.unit ?? 1}`
                    : "/learn?level=A1&unit=1"
                }
              >
                {t("continueLearning")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
