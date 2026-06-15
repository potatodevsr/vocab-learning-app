"use client";

import { useMemo, useState } from "react";
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

  const resetAnswerState = () => {
    setSelectedAnswer("");
    setTypedAnswer("");
    setCheckedResult(null);
  };

  const restartQuiz = () => {
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
      <main className="min-h-screen bg-zinc-50 text-zinc-950">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6">
          <Card className="w-full rounded-3xl bg-white">
            <CardContent className="p-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                  <CircleAlert className="size-5" />
                </div>
                <LanguageSwitcher />
              </div>

              <h1 className="mt-6 text-3xl font-semibold">
                {tQuiz("notReadyTitle")}
              </h1>

              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {tQuiz("notReadyDescription", { count: readyWords.length })}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="rounded-full">
                  <Link href={learnHref}>
                    <ArrowLeft className="size-4" />
                    {tCommon("backToLesson")}
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="rounded-full bg-white"
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
      <main className="min-h-screen bg-zinc-50 text-zinc-950">
        <section className="border-b bg-zinc-950 text-white">
          <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <Button
                asChild
                variant="ghost"
                className="rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <Link href={learnHref}>
                  <ArrowLeft className="size-4" />
                  {tCommon("backToLesson")}
                </Link>
              </Button>
              <LanguageSwitcher />
            </div>

            <div className="py-16">
              <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
                {tQuiz("introBadge", { level, unit })}
              </Badge>

              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                {tQuiz("introTitle")}
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                {tQuiz("introDescription")}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-3xl font-semibold">{questions.length}</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {tQuiz("statQuestions")}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-3xl font-semibold">{readyWords.length}</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {tQuiz("statReadyWords")}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-3xl font-semibold">{QUIZ_TYPE_COUNT}</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {tQuiz("statQuizTypes")}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-3xl font-semibold">{words.length}</p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {tQuiz("statUnitWords")}
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="mt-8 h-12 rounded-full bg-pink-600 px-6 text-white hover:bg-pink-500"
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
      <main className="min-h-screen bg-zinc-50 text-zinc-950">
        <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10">
          <Card className="w-full rounded-[32px] bg-white">
            <CardContent className="p-8 sm:p-10">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-pink-600 text-white">
                <Trophy className="size-6" />
              </div>

              <Badge className="mt-6 rounded-full bg-zinc-950 text-white hover:bg-zinc-950">
                {tCommon("unitLabel", { level, unit })}
              </Badge>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                {tQuiz("completeTitle")}
              </h1>

              <p className="mt-4 text-base leading-7 text-zinc-600">
                {tQuiz("completeDescription", {
                  score,
                  total: questions.length,
                })}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border bg-zinc-50 p-5">
                  <p className="text-3xl font-semibold">{score}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {tQuiz("statCorrect")}
                  </p>
                </div>

                <div className="rounded-3xl border bg-zinc-50 p-5">
                  <p className="text-3xl font-semibold">
                    {questions.length - score}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {tQuiz("statNeedReview")}
                  </p>
                </div>

                <div className="rounded-3xl border bg-zinc-50 p-5">
                  <p className="text-3xl font-semibold">{questions.length}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {tQuiz("statQuestions")}
                  </p>
                </div>
              </div>

              {wrongResults.length > 0 && (
                <div className="mt-8 rounded-3xl border bg-zinc-50 p-5">
                  <h2 className="font-semibold">{tQuiz("reviewHeading")}</h2>

                  <div className="mt-4 grid gap-3">
                    {wrongResults.map((result) => (
                      <div
                        key={result.questionId}
                        className="rounded-2xl border bg-white px-4 py-3 text-sm"
                      >
                        <p className="font-medium">
                          {tQuiz("correctAnswerLabel", {
                            value: result.correctAnswer,
                          })}
                        </p>
                        <p className="mt-1 text-zinc-500">
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
                  className="h-12 rounded-full bg-pink-600 px-6 text-white hover:bg-pink-500"
                  onClick={restartQuiz}
                >
                  {tQuiz("tryAgain")}
                  <RotateCcw className="size-4" />
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full bg-white px-6"
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

  const isSpelling = currentQuestion.type === "spelling";
  const canCheck = isSpelling
    ? typedAnswer.trim().length > 0
    : selectedAnswer.trim().length > 0;
  const isLastQuestion = currentIndex + 1 >= questions.length;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Button
              asChild
              variant="ghost"
              className="rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <Link href={learnHref}>
                <ArrowLeft className="size-4" />
                {tCommon("backToLesson")}
              </Link>
            </Button>

            <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
              {tQuiz("questionCounter", {
                current: currentIndex + 1,
                total: questions.length,
              })}
            </Badge>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-pink-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
        <Card className="rounded-[32px] bg-white">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-zinc-950 text-white hover:bg-zinc-950">
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
              <p className="text-sm font-medium text-zinc-500">
                {currentQuestion.helper}
              </p>

              <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                {currentQuestion.prompt}
              </h1>
            </div>

            {isSpelling ? (
              <div className="mt-8">
                <div className="flex items-center gap-3 rounded-3xl border bg-zinc-50 px-5 py-4">
                  <SpellCheck className="size-5 text-pink-600" />
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
                      disabled={Boolean(checkedResult)}
                      onClick={() => setSelectedAnswer(option)}
                      className={
                        isCorrectOption
                          ? "rounded-3xl border border-emerald-500 bg-emerald-50 p-5 text-left font-medium text-emerald-700"
                          : isWrongSelected
                            ? "rounded-3xl border border-red-500 bg-red-50 p-5 text-left font-medium text-red-700"
                            : isSelected
                              ? "rounded-3xl border border-zinc-950 bg-zinc-950 p-5 text-left font-medium text-white"
                              : "rounded-3xl border bg-white p-5 text-left font-medium hover:border-zinc-400"
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
                    ? "mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800"
                    : "mt-8 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800"
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
                  className="rounded-full bg-pink-600 text-white hover:bg-pink-500"
                  onClick={goNext}
                >
                  {isLastQuestion ? tQuiz("finish") : tQuiz("next")}
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  disabled={!canCheck}
                  className="rounded-full bg-pink-600 text-white hover:bg-pink-500"
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
