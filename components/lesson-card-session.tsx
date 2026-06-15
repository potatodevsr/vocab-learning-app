"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { CefrLevel, OxfordWord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getWordLabel } from "@/lib/word";

type LessonCardSessionProps = {
  level: CefrLevel;
  unit: number;
  words: OxfordWord[];
  pathHref: string;
};

const addUnique = (items: string[], value: string) =>
  items.includes(value) ? items : [...items, value];

export function LessonCardSession({
  level,
  unit,
  words,
  pathHref,
}: LessonCardSessionProps) {
  const tLesson = useTranslations("Lesson");
  const tCommon = useTranslations("Common");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [knownIds, setKnownIds] = useState<string[]>([]);
  const [reviewIds, setReviewIds] = useState<string[]>([]);

  const currentWord = words[currentIndex];
  const isComplete = currentIndex >= words.length;

  const progress = useMemo(() => {
    if (words.length === 0) return 0;
    return Math.floor(
      (Math.min(currentIndex, words.length) / words.length) * 100
    );
  }, [currentIndex, words.length]);

  const nextWords = useMemo(
    () => words.slice(currentIndex + 1, currentIndex + 5),
    [words, currentIndex]
  );

  const goNext = () => setCurrentIndex((value) => value + 1);

  const handleKnown = () => {
    if (!currentWord) return;
    setKnownIds((items) => addUnique(items, currentWord.id));
    goNext();
  };

  const handleReview = () => {
    if (!currentWord) return;
    setReviewIds((items) => addUnique(items, currentWord.id));
    goNext();
  };

  if (words.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-50 text-zinc-950">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6">
          <Card className="w-full rounded-3xl bg-white">
            <CardContent className="p-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                <CircleAlert className="size-5" />
              </div>

              <h1 className="mt-6 text-3xl font-semibold">
                {tLesson("emptyTitle")}
              </h1>

              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {tLesson("emptyDescription")}
              </p>

              <Button asChild className="mt-6 rounded-full">
                <Link href={pathHref}>
                  <ArrowLeft className="size-4" />
                  {tCommon("backToPath")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  if (isComplete) {
    return (
      <main className="min-h-screen bg-zinc-50 text-zinc-950">
        <section className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10">
          <Card className="w-full rounded-[32px] bg-white">
            <CardContent className="p-8 sm:p-10">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-pink-600 text-white">
                <ListChecks className="size-6" />
              </div>

              <Badge className="mt-6 rounded-full bg-zinc-950 text-white hover:bg-zinc-950">
                {tCommon("unitLabel", { level, unit })}
              </Badge>

              <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                {tLesson("completeTitle", { count: words.length })}
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
                {tLesson("completeDescription")}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border bg-zinc-50 p-5">
                  <p className="text-3xl font-semibold">{words.length}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {tLesson("statWordCards")}
                  </p>
                </div>

                <div className="rounded-3xl border bg-zinc-50 p-5">
                  <p className="text-3xl font-semibold">{knownIds.length}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {tLesson("statKnown")}
                  </p>
                </div>

                <div className="rounded-3xl border bg-zinc-50 p-5">
                  <p className="text-3xl font-semibold">{reviewIds.length}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {tLesson("statReviewLater")}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-pink-600 px-6 text-white hover:bg-pink-500"
                >
                  <Link href={`/quiz?level=${level}&unit=${unit}`}>
                    {tLesson("startQuiz")}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full bg-white px-6"
                >
                  <Link href={pathHref}>{tCommon("backToPath")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Button
              asChild
              variant="ghost"
              className="rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <Link href={pathHref}>
                <ArrowLeft className="size-4" />
                {tCommon("backToPath")}
              </Link>
            </Button>

            <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
              {tCommon("unitLabel", { level, unit })}
            </Badge>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {tLesson("title")}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                {tLesson("description")}
              </p>
            </div>

            <div className="text-sm text-zinc-300">
              {tLesson("cardCounter", {
                current: currentIndex + 1,
                total: words.length,
              })}
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-pink-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[1fr_320px] lg:px-8">
        <Card className="rounded-[36px] bg-white shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <article className="rounded-[32px] border bg-zinc-50 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-zinc-950 text-white hover:bg-zinc-950">
                  {currentWord.level}
                </Badge>

                <Badge variant="outline" className="rounded-full bg-white">
                  {currentWord.partOfSpeech}
                </Badge>

                {currentWord.homograph && (
                  <Badge variant="outline" className="rounded-full bg-white">
                    {tLesson("homograph", { number: currentWord.homograph })}
                  </Badge>
                )}
              </div>

              <div className="mt-8">
                <h2 className="text-6xl font-semibold tracking-tight">
                  {getWordLabel(currentWord)}
                </h2>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border bg-white p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {tLesson("thaiMeaning")}
                    </p>
                    <p
                      className="font-thai mt-2 text-lg font-semibold"
                      lang="th"
                    >
                      {currentWord.meaningTh || tLesson("meaningPlaceholder")}
                    </p>
                  </div>

                  <div className="rounded-3xl border bg-white p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {tLesson("pronunciation")}
                    </p>
                    <p
                      className="font-thai mt-2 text-lg font-semibold"
                      lang="th"
                    >
                      {currentWord.pronunciationTh ||
                        tLesson("pronunciationPlaceholder")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border bg-white p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {tLesson("example")}
                  </p>
                  <p className="mt-2 text-base leading-7 text-zinc-600">
                    {currentWord.exampleEn || tLesson("examplePlaceholder")}
                  </p>
                </div>
              </div>
            </article>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-12 rounded-full border-zinc-200 bg-white"
                onClick={handleReview}
              >
                <RotateCcw className="size-4" />
                {tLesson("reviewLater")}
              </Button>

              <Button
                className="h-12 rounded-full bg-pink-600 text-white hover:bg-pink-500"
                onClick={handleKnown}
              >
                <Check className="size-4" />
                {tLesson("iKnowThis")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-3xl bg-white">
            <CardContent className="p-6">
              <h2 className="font-semibold">{tLesson("sidebarTitle")}</h2>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between rounded-2xl border bg-zinc-50 px-4 py-3">
                  <span className="text-zinc-500">
                    {tLesson("sidebarProgress")}
                  </span>
                  <span className="font-medium">{progress}%</span>
                </div>

                <div className="flex justify-between rounded-2xl border bg-zinc-50 px-4 py-3">
                  <span className="text-zinc-500">
                    {tLesson("sidebarKnown")}
                  </span>
                  <span className="font-medium">{knownIds.length}</span>
                </div>

                <div className="flex justify-between rounded-2xl border bg-zinc-50 px-4 py-3">
                  <span className="text-zinc-500">
                    {tLesson("sidebarReviewLater")}
                  </span>
                  <span className="font-medium">{reviewIds.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-white">
            <CardContent className="p-6">
              <h2 className="font-semibold">{tLesson("comingNext")}</h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {nextWords.length > 0 ? (
                  nextWords.map((word) => (
                    <Badge
                      key={word.id}
                      variant="outline"
                      className="rounded-full bg-zinc-50"
                    >
                      {word.displayWord}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-zinc-600">{tLesson("lastCard")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
