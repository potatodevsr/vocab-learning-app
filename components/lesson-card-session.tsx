"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ListChecks,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { CefrLevel, OxfordWord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWordLabel } from "@/lib/word";
import {
  getWordProgress,
  newSessionId,
  reportLessonComplete,
  type WordProgress,
} from "@/lib/progress-api";
import { MasteryPips } from "@/components/play/mastery-pips";
import { Confetti } from "@/components/play/confetti";

type LessonCardSessionProps = {
  level: CefrLevel;
  unit: number;
  round: number;
  roundCount: number;
  words: OxfordWord[];
  pathHref: string;
};

type SpeechLang = "en-US" | "th-TH";

const addUnique = (items: string[], value: string) =>
  items.includes(value) ? items : [...items, value];

const speak = (text: string | null | undefined, lang: SpeechLang) => {
  const value = text?.trim();

  if (!value) return;
  if (typeof window === "undefined") return;
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(value);

  utterance.lang = lang;
  utterance.rate = lang === "en-US" ? 0.85 : 0.8;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
};

export function LessonCardSession({
  level,
  unit,
  round,
  roundCount,
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

  const [wordProgress, setWordProgress] = useState<Record<string, WordProgress>>({});

  useEffect(() => {
    let cancelled = false;

    void getWordProgress(words.map((word) => word.id)).then((progress) => {
      if (!cancelled) setWordProgress(progress);
    });

    return () => {
      cancelled = true;
    };
  }, [words]);

  // One id per mounted session, so a re-render or a retry replays rather than
  // double-counts. Both are impure calls, so they are initialised in an effect
  // rather than during render.
  const sessionIdRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const reportedRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = newSessionId();
    startedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!isComplete || words.length === 0 || reportedRef.current) return;

    reportedRef.current = true;

    void reportLessonComplete({
      sessionId: sessionIdRef.current,
      level,
      unit,
      knownWordIds: knownIds,
      reviewWordIds: reviewIds,
      durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
    });
  }, [isComplete, words.length, level, unit, knownIds, reviewIds]);

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
      <main className="min-h-screen bg-background text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6">
          <div className="play-card w-full p-8">
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl border-3 border-ink bg-warn text-ink">
                <CircleAlert className="size-5" />
              </div>

              <h1 className="mt-6 text-3xl font-semibold">
                {tLesson("emptyTitle")}
              </h1>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {tLesson("emptyDescription")}
              </p>

              <Button asChild className="play-press mt-6 rounded-full bg-brand text-white hover:bg-brand">
                <Link href={pathHref}>
                  <ArrowLeft className="size-4" />
                  {tCommon("backToPath")}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (isComplete) {
    const hasNextRound = round < roundCount;

    return (
      <main className="min-h-screen bg-background text-foreground">
        <Confetti />
        <section className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10">
          <div className="play-card w-full p-8 sm:p-10">
            <div className="play-pop flex size-16 items-center justify-center rounded-3xl bg-success text-white">
              <ListChecks className="size-7" />
            </div>

              <Badge className="mt-6 rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
                {tCommon("unitLabel", { level, unit })} · {tLesson("roundLabel", { round, total: roundCount })}
              </Badge>

              <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                {tLesson("completeTitle", { count: words.length })}
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                {tLesson("completeDescription")}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-brand-soft p-5">
                  <p className="play-count text-3xl font-semibold">{words.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tLesson("statWordCards")}
                  </p>
                </div>

                <div className="rounded-3xl bg-success-soft p-5">
                  <p className="play-count text-3xl font-semibold" data-testid="summary-known">
                    {knownIds.length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tLesson("statKnown")}
                  </p>
                </div>

                <div className="rounded-3xl bg-warn-soft p-5">
                  <p className="play-count text-3xl font-semibold" data-testid="summary-review">
                    {reviewIds.length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tLesson("statReviewLater")}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {hasNextRound && (
                  <Button
                    asChild
                    size="lg"
                    className="play-press h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
                  >
                    <Link
                      data-testid="next-round"
                      href={`/learn?level=${level}&unit=${unit}&round=${round + 1}`}
                    >
                      {tLesson("nextRound")}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}

                <Button
                  asChild
                  size="lg"
                  variant={hasNextRound ? "outline" : "default"}
                  className={
                    hasNextRound
                      ? "play-press h-12 rounded-full bg-white px-6"
                      : "play-press h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
                  }
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
                  className="play-press h-12 rounded-full bg-white px-6"
                >
                  <Link href={pathHref}>{tCommon("backToPath")}</Link>
                </Button>
              </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-brand text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Button
              asChild
              variant="ghost"
              className="play-press rounded-full text-white hover:bg-white/20 hover:text-white"
            >
              <Link href={pathHref}>
                <ArrowLeft className="size-4" />
                {tCommon("backToPath")}
              </Link>
            </Button>

            <Badge
              data-testid="round-badge"
              className="rounded-full bg-white font-bold text-brand hover:bg-white"
            >
              {tCommon("unitLabel", { level, unit })} ·{" "}
              {tLesson("roundLabel", { round, total: roundCount })}
            </Badge>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {tLesson("title")}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white">
                {tLesson("description")}
              </p>
            </div>

            <div className="text-sm font-medium text-white">
              {tLesson("cardCounter", {
                current: currentIndex + 1,
                total: words.length,
              })}
            </div>
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/25">
            <div
              data-testid="lesson-progress-fill"
              className="h-full rounded-full bg-white transition-[width] duration-[400ms] ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="play-card p-6 sm:p-8">
          <div>
            <article className="rounded-[28px] bg-brand-soft/60 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-brand text-white hover:bg-brand">
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
                <MasteryPips
                  mastery={wordProgress[currentWord.id]?.mastery ?? 0}
                  label={tLesson("masteryLabel", {
                    mastery: wordProgress[currentWord.id]?.mastery ?? 0,
                    max: 5,
                  })}
                />

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <h2 className="text-6xl font-semibold tracking-tight">
                    {getWordLabel(currentWord)}
                  </h2>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="play-press mt-3 size-12 rounded-full bg-white"
                    onClick={() => speak(currentWord.word, "en-US")}
                    aria-label="Listen to English pronunciation"
                  >
                    <Volume2 className="size-5" />
                  </Button>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {tLesson("thaiMeaning")}
                      </p>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-full"
                        disabled={!currentWord.meaningTh}
                        onClick={() => speak(currentWord.meaningTh, "th-TH")}
                        aria-label="Listen to Thai meaning"
                      >
                        <Volume2 className="size-4" />
                      </Button>
                    </div>

                    <p
                      className="font-thai mt-2 text-lg font-semibold"
                      lang="th"
                    >
                      {currentWord.meaningTh || tLesson("meaningPlaceholder")}
                    </p>
                  </div>

                  <div className="rounded-3xl border bg-white p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {tLesson("example")}
                  </p>
                  <p className="mt-2 text-base leading-7 text-muted-foreground">
                    {currentWord.exampleEn || tLesson("examplePlaceholder")}
                  </p>
                </div>
              </div>
            </article>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                data-testid="review-later"
                className="play-press h-14 rounded-2xl border-2 border-warn/40 bg-warn-soft text-base font-semibold text-foreground hover:bg-warn-soft"
                onClick={handleReview}
              >
                <RotateCcw className="size-5" />
                {tLesson("reviewLater")}
              </Button>

              <Button
                data-testid="i-know-this"
                className="play-press h-14 rounded-2xl bg-success text-base font-semibold text-white hover:bg-success"
                onClick={handleKnown}
              >
                <Check className="size-5" />
                {tLesson("iKnowThis")}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="play-card p-6">
              <h2 className="text-lg font-bold">{tLesson("sidebarTitle")}</h2>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between rounded-2xl bg-brand-soft px-4 py-3">
                  <span className="text-muted-foreground">
                    {tLesson("sidebarProgress")}
                  </span>
                  <span className="font-semibold" data-testid="stat-progress">
                    {progress}%
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-success-soft px-4 py-3">
                  <span className="text-muted-foreground">
                    {tLesson("sidebarKnown")}
                  </span>
                  <span className="font-semibold" data-testid="stat-known">
                    {knownIds.length}
                  </span>
                </div>

                <div className="flex justify-between rounded-2xl bg-warn-soft px-4 py-3">
                  <span className="text-muted-foreground">
                    {tLesson("sidebarReviewLater")}
                  </span>
                  <span className="font-semibold" data-testid="stat-review">
                    {reviewIds.length}
                  </span>
                </div>
              </div>
          </div>

          <div className="play-card p-6">
              <h2 className="text-lg font-bold">{tLesson("comingNext")}</h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {nextWords.length > 0 ? (
                  nextWords.map((word) => (
                    <Badge
                      key={word.id}
                      variant="outline"
                      className="rounded-full bg-brand-soft"
                    >
                      {word.displayWord}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{tLesson("lastCard")}</p>
                )}
              </div>
          </div>
        </div>
      </section>
    </main>
  );
}
