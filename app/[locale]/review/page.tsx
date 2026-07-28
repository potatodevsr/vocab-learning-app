import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Sparkles, Target } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { MasteryPips } from "@/components/play/mastery-pips";
import { getMistakesWithToken } from "@/lib/progress-api";
import { privateMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });

  return privateMetadata(t("review"));
}

type ReviewPageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * The mistakes bank. Every wrong answer is already stored; this is what turns that data
 * into something the learner can act on (SPEC §5.4.2).
 */
export default async function ReviewPage({ params }: ReviewPageProps) {
  const { locale } = await params;
  const t = await getTranslations("Review");

  const token = (await cookies()).get("user_token")?.value;

  if (!token) {
    redirect(`/${locale}/auth/login?from=/${locale}/review`);
  }

  const bank = await getMistakesWithToken(token);
  const rows = bank?.words ?? [];

  // Where to send the learner to practise: the unit their worst word came from.
  const firstUnit = rows.find((row) => row.unit !== null);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-warn text-ink">
        <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
          <div className="flex size-14 items-center justify-center rounded-3xl border-3 border-ink bg-white">
            <Target className="size-7" />
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink">
            {t("subtitle")}
          </p>

          <p className="mt-6 text-5xl font-semibold" data-testid="mistakes-count">
            {rows.length}
          </p>
          <p className="text-sm font-medium text-ink">{t("wordsToPractise")}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
        {rows.length === 0 ? (
          <div className="play-card p-8 text-center" data-testid="mistakes-empty">
            <div className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-success-soft">
              <Sparkles className="size-7 text-success" />
            </div>

            <h2 className="mt-6 text-xl font-semibold">{t("emptyTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("emptyBody")}
            </p>

            <Button
              asChild
              className="play-press mt-6 h-11 rounded-full bg-brand px-6 text-white hover:bg-brand"
            >
              <Link href="/learn?level=A1&unit=1">
                {t("startLearning")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="grid gap-3" data-testid="mistakes-list">
              {rows.map((mistake) => (
                <li
                  key={mistake.wordId}
                  className="play-tile flex flex-wrap items-center justify-between gap-4 p-5 [--tile-block:var(--warn)]"
                >
                  <div className="min-w-0">
                    <p className="text-xl font-semibold">
                      {mistake.word.displayWord}
                    </p>
                    <p className="font-thai mt-1 text-sm text-muted-foreground" lang="th">
                      {mistake.word.meaningTh}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className="rounded-full bg-danger-soft px-3 py-1 text-sm font-medium text-danger"
                      data-testid="mistake-count"
                    >
                      {t("timesWrong", { count: mistake.incorrectCount })}
                    </span>

                    <MasteryPips
                      mastery={mistake.mastery}
                      label={t("masteryLabel", {
                        mastery: mistake.mastery,
                        max: 5,
                      })}
                    />
                  </div>
                </li>
              ))}
            </ul>

            {firstUnit && (
              <Button
                asChild
                size="lg"
                className="play-press mt-8 h-12 w-full rounded-full bg-brand px-6 text-white hover:bg-brand sm:w-auto"
              >
                <Link
                  data-testid="practise-mistakes"
                  href={`/quiz?level=${firstUnit.level}&unit=${firstUnit.unit}`}
                >
                  {t("practise")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
