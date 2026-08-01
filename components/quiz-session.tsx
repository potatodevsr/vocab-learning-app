"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  RotateCcw,
  SpellCheck,
  Trophy,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { CefrLevel, OxfordWord } from "@/lib/types";
import {
  buildQuestions,
  filterReadyWords,
  type QuizQuestion,
  type QuizResult,
} from "@/lib/quiz";
import { normalizeAnswer } from "@/lib/text";
import { newSessionId, reportQuizComplete } from "@/lib/progress-api";

type QuizSessionProps = {
  level: CefrLevel;
  unit: number;
  words: OxfordWord[];
  pathHref: string;
  learnHref: string;
  nextUnitHref: string;
};

const QUIZ_TYPE_COUNT = 3;

export function QuizSession({
  level,
  unit,
  words,
  pathHref,
  learnHref,
  nextUnitHref,
}: QuizSessionProps) {
  const tQuiz = useTranslations("Quiz");
  const tCommon = useTranslations("Common");

  const readyWords = useMemo(() => filterReadyWords(words), [words]);
  const questions = useMemo(() => buildQuestions(words, tQuiz), [words, tQuiz]);

  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [checkedResult, setCheckedResult] = useState<QuizResult | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);

  const currentQuestion = questions[currentIndex];
  const isComplete = started && currentIndex >= questions.length;
  const score = results.filter((result) => result.isCorrect).length;
  const progress =
    questions.length === 0
      ? 0
      : Math.floor(
          ((currentIndex + (checkedResult ? 1 : 0)) / questions.length) * 100
        );

  // A fresh id per attempt: retrying the quiz is a new result, but re-rendering the
  // finished screen is a replay the server ignores.
  const quizIdRef = useRef<string>(newSessionId());
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!isComplete || results.length === 0 || reportedRef.current) return;

    reportedRef.current = true;

    void reportQuizComplete({
      quizId: quizIdRef.current,
      level,
      unit,
      answers: results.map((result) => ({
        wordId: result.wordId,
        isCorrect: result.isCorrect,
        answer: result.userAnswer,
        correctAnswer: result.correctAnswer,
      })),
    });
  }, [isComplete, results, level, unit]);

  const resetAnswerState = () => {
    setSelectedAnswer("");
    setTypedAnswer("");
    setCheckedResult(null);
  };

  const restartQuiz = () => {
    quizIdRef.current = newSessionId();
    reportedRef.current = false;
    setStarted(true);
    setCurrentIndex(0);
    setResults([]);
    resetAnswerState();
  };

  const checkAnswer = () => {
    if (!currentQuestion) return;

    const userAnswer =
      currentQuestion.type === "spelling" ? typedAnswer : selectedAnswer;

    const isCorrect =
      normalizeAnswer(userAnswer) ===
      normalizeAnswer(currentQuestion.correctAnswer);

    setCheckedResult({
      questionId: currentQuestion.id,
      wordId: currentQuestion.word.id,
      type: currentQuestion.type,
      userAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect,
    });
  };

  const goNext = () => {
    if (!checkedResult) return;
    setResults((items) => [...items, checkedResult]);
    setCurrentIndex((value) => value + 1);
    resetAnswerState();
  };

  if (readyWords.length < 4) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6">
          <Card className="play-card w-full rounded-[28px] border-0">
            <CardContent className="p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl border-3 border-ink bg-warn text-ink">
                  <CircleAlert className="size-5" />
                </div>
                <LanguageSwitcher />
              </div>

              <h1 className="mt-6 text-3xl font-semibold">
                {tQuiz("notReadyTitle")}
              </h1>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {tQuiz("notReadyDescription", { count: readyWords.length })}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="play-press rounded-full bg-brand text-white hover:bg-brand">
                  <Link href={learnHref}>
                    <ArrowLeft className="size-4" />
                    {tCommon("backToLesson")}
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="play-press rounded-full bg-white"
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

  if (!started) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b-3 border-ink bg-accent-deep-sky text-white">
          <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <Button
                asChild
                variant="ghost"
                className="play-press rounded-full text-white hover:bg-white/20 hover:text-white"
              >
                <Link href={learnHref}>
                  <ArrowLeft className="size-4" />
                  {tCommon("backToLesson")}
                </Link>
              </Button>
              <LanguageSwitcher tone="onColor" />
            </div>

            <div className="py-16">
              <Badge className="rounded-full bg-white font-bold text-brand hover:bg-white">
                {tQuiz("introBadge", { level, unit })}
              </Badge>

              <h1 className="play-display mt-6 max-w-3xl text-[clamp(2.25rem,6vw,3.75rem)]">
                {tQuiz("introTitle")}
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-white">
                {tQuiz("introDescription")}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-4">
                {[
                  { value: questions.length, label: tQuiz("statQuestions") },
                  { value: readyWords.length, label: tQuiz("statReadyWords") },
                  { value: QUIZ_TYPE_COUNT, label: tQuiz("statQuizTypes") },
                  { value: words.length, label: tQuiz("statUnitWords") },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-3xl border-3 border-ink bg-white p-5 text-ink"
                  >
                    <p className="text-3xl font-extrabold">{stat.value}</p>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="play-key mt-10 h-14 rounded-2xl bg-accent-sun px-7 text-base font-extrabold text-ink hover:bg-accent-sun"
                onClick={() => setStarted(true)}
              >
                {tQuiz("startQuiz")}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (isComplete) {
    const wrongResults = results.filter((result) => !result.isCorrect);

    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10">
          <Card className="play-card w-full rounded-[28px] border-0">
            <CardContent className="p-8 sm:p-10">
              <div className="play-pop flex size-16 items-center justify-center rounded-3xl bg-success text-white">
                <Trophy className="size-7" />
              </div>

              <Badge className="mt-6 rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
                {tCommon("unitLabel", { level, unit })}
              </Badge>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                {tQuiz("completeTitle")}
              </h1>

              <p className="mt-4 text-base leading-7 text-muted-foreground">
                {tQuiz("completeDescription", {
                  score,
                  total: questions.length,
                })}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-success-soft p-5">
                  <p className="play-count text-3xl font-semibold">{score}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tQuiz("statCorrect")}
                  </p>
                </div>

                <div className="rounded-3xl bg-warn-soft p-5">
                  <p className="play-count text-3xl font-semibold">
                    {questions.length - score}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tQuiz("statNeedReview")}
                  </p>
                </div>

                <div className="rounded-3xl bg-brand-soft p-5">
                  <p className="play-count text-3xl font-semibold">{questions.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tQuiz("statQuestions")}
                  </p>
                </div>
              </div>

              {wrongResults.length > 0 && (
                <div className="mt-8 rounded-3xl bg-warn-soft p-5">
                  <h2 className="text-lg font-bold">{tQuiz("reviewHeading")}</h2>

                  <div className="mt-4 grid gap-3">
                    {wrongResults.map((result) => (
                      <div
                        key={result.questionId}
                        className="rounded-2xl bg-white px-4 py-3 text-sm"
                      >
                        <p className="font-medium">
                          {tQuiz("correctAnswerLabel", {
                            value: result.correctAnswer,
                          })}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {tQuiz("yourAnswerLabel", {
                            value: result.userAnswer || "-",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="play-press h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
                  onClick={restartQuiz}
                >
                  {tQuiz("tryAgain")}
                  <RotateCcw className="size-4" />
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="play-press h-12 rounded-full bg-white px-6"
                >
                  <Link href={nextUnitHref}>
                    {tQuiz("nextUnit")}
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
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  const isSpelling = currentQuestion.type === "spelling";
  const canCheck = isSpelling
    ? typedAnswer.trim().length > 0
    : selectedAnswer.trim().length > 0;
  const isLastQuestion = currentIndex + 1 >= questions.length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b-3 border-ink bg-accent-deep-sky text-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Button
              asChild
              variant="ghost"
              className="play-press rounded-full text-white hover:bg-white/20 hover:text-white"
            >
              <Link href={learnHref}>
                <ArrowLeft className="size-4" />
                {tCommon("backToLesson")}
              </Link>
            </Button>

            <Badge className="rounded-full bg-white font-bold text-brand hover:bg-white">
              {tQuiz("questionCounter", {
                current: currentIndex + 1,
                total: questions.length,
              })}
            </Badge>
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/25">
            <div
              data-testid="quiz-progress-fill"
              className="h-full rounded-full bg-white transition-[width] duration-[400ms] ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
        <Card className="play-card rounded-[28px] border-0">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-brand text-white hover:bg-brand">
                {currentQuestion.word.level}
              </Badge>

              <Badge variant="outline" className="rounded-full bg-white">
                {currentQuestion.word.partOfSpeech}
              </Badge>

              <Badge variant="outline" className="rounded-full bg-white">
                {currentQuestion.type.replace("-", " ")}
              </Badge>
            </div>

            <div className="mt-8">
              <p className="text-sm font-medium text-muted-foreground">
                {currentQuestion.helper}
              </p>

              <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                {currentQuestion.prompt}
              </h1>
            </div>

            {isSpelling ? (
              <div className="mt-8">
                <div className="play-focus flex items-center gap-3 rounded-3xl border-2 border-brand/25 bg-brand-soft/50 px-5 py-4">
                  <SpellCheck className="size-5 text-brand" />
                  <input
                    value={typedAnswer}
                    disabled={Boolean(checkedResult)}
                    onChange={(event) => setTypedAnswer(event.target.value)}
                    placeholder={tQuiz("spellingPlaceholder")}
                    className="w-full bg-transparent text-lg outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrectOption =
                    checkedResult &&
                    normalizeAnswer(option) ===
                      normalizeAnswer(currentQuestion.correctAnswer);
                  const isWrongSelected =
                    checkedResult && isSelected && !checkedResult.isCorrect;

                  return (
                    <button
                      key={option}
                      data-testid="quiz-option"
                      style={{ ["--swipe" as string]: "var(--brand-soft)" }}
                      disabled={Boolean(checkedResult)}
                      onClick={() => setSelectedAnswer(option)}
                      className={
                        // One shape, four states. The answered states keep the ink rule
                        // and swap the fill, so the row never reflows when it resolves.
                        isCorrectOption
                          ? "play-key rounded-2xl bg-success-soft p-5 text-left text-lg font-bold text-foreground [--lift:4px]"
                          : isWrongSelected
                            ? "play-key play-shake rounded-2xl bg-danger-soft p-5 text-left text-lg font-bold text-foreground [--lift:4px]"
                            : isSelected
                              ? "play-key rounded-2xl bg-brand p-5 text-left text-lg font-bold text-white [--lift:4px]"
                              : "play-key rounded-2xl bg-white p-5 text-left text-lg font-bold hover:bg-brand-soft [--lift:4px]"
                      }
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            {checkedResult && (
              <div
                className={
                  checkedResult.isCorrect
                    ? "play-pop play-sticker mt-8 rounded-2xl bg-success-soft p-5 text-foreground [--tile-block:var(--success)]"
                    : "play-pop play-sticker mt-8 rounded-2xl bg-danger-soft p-5 text-foreground [--tile-block:var(--danger)]"
                }
              >
                <div className="flex items-center gap-3">
                  {checkedResult.isCorrect ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <XCircle className="size-5" />
                  )}
                  <p className="font-semibold">
                    {checkedResult.isCorrect
                      ? tQuiz("feedbackCorrect")
                      : tQuiz("feedbackWrong")}
                  </p>
                </div>

                <p className="mt-2 text-sm">
                  {tQuiz("correctAnswerLabel", {
                    value: currentQuestion.correctAnswer,
                  })}
                </p>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              {checkedResult ? (
                <Button
                  className="play-press h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
                  onClick={goNext}
                >
                  {isLastQuestion ? tQuiz("finish") : tQuiz("next")}
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  disabled={!canCheck}
                  className="play-press h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
                  onClick={checkAnswer}
                >
                  {tQuiz("check")}
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
