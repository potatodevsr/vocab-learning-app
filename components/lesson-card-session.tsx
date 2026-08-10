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
import { clusterThai, lookupThaiLetter } from "@/lib/thai-alphabet";
import type { LearnerMode } from "@/lib/learner-mode";
import { newSessionId, reportLessonComplete } from "@/lib/progress-api";
import { track } from "@/lib/analytics";
import { Confetti } from "@/components/play/confetti";

type LessonCardSessionProps = {
  level: CefrLevel;
  unit: number;
  round: number;
  roundCount: number;
  words: OxfordWord[];
  pathHref: string;
  /** Which half of the word's content this learner wants. See lib/learner-mode.ts. */
  mode: LearnerMode;
};

type SpeechLang = "en-US" | "th-TH";

const addUnique = (items: string[], value: string) =>
  items.includes(value) ? items : [...items, value];

const speak = (
  text: string | null | undefined,
  lang: SpeechLang,
  onDone?: () => void,
) => {
  const value = text?.trim();

  if (!value || typeof window === "undefined" || !window.speechSynthesis) {
    onDone?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(value);

  utterance.lang = lang;
  utterance.rate = lang === "en-US" ? 0.85 : 0.8;
  utterance.pitch = 1;
  utterance.onend = () => onDone?.();
  utterance.onerror = () => onDone?.();

  window.speechSynthesis.speak(utterance);
};

export function LessonCardSession({
  level,
  unit,
  round,
  roundCount,
  words,
  pathHref,
  mode,
}: LessonCardSessionProps) {
  const tLesson = useTranslations("Lesson");
  const tWord = useTranslations("Word");
  const tCommon = useTranslations("Common");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [knownIds, setKnownIds] = useState<string[]>([]);
  const [reviewIds, setReviewIds] = useState<string[]>([]);

  const currentWord = words[currentIndex];

  /**
   * Every character of the Thai meaning, keeping its original index.
   *
   * Deliberately not `breakDownThai`, which drops whitespace: a meaning may legitimately
   * contain spaces ("คำนำหน้านามเอกพจน์ / หนึ่ง"), and filtering here would both run the
   * words together on screen and shift the indices the highlight depends on.
   */
  const meaningLetters = useMemo(
    () =>
      Array.from(currentWord?.meaningTh ?? "").map((char, index) => ({
        char,
        index,
        letter: lookupThaiLetter(char),
      })),
    [currentWord?.meaningTh],
  );

  /**
   * The same string grouped for *display*. A combining mark cannot be wrapped in its own
   * element — the browser stops composing `ี` onto `ก` and paints a detached box — so the
   * highlight lands on the whole cluster that contains the pressed character.
   */
  const meaningClusters = useMemo(
    () => clusterThai(currentWord?.meaningTh ?? ""),
    [currentWord?.meaningTh],
  );

  /** Which letter was last played, so the word shows where the sound came from. */
  const [activeLetter, setActiveLetter] = useState<number | null>(null);
  const [modernThaiFont, setModernThaiFont] = useState(false);
  const [speakingHero, setSpeakingHero] = useState(false);
  const heroSpeechTokenRef = useRef(0);
  const isComplete = currentIndex >= words.length;

  // One id per mounted session, so a re-render or a retry replays rather than
  // double-counts. Both are impure calls, so they are initialised in an effect
  // rather than during render.
  const sessionIdRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const reportedRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = newSessionId();
    startedAtRef.current = Date.now();

    // Interaction telemetry only — the authoritative learning/reward record is the
    // server completion event (docs/LEARNER-LIFECYCLE.md §7.1). Carries no word content.
    track("session_started", {
      sessionKind: "lesson",
      direction: mode,
      level,
      unit,
      round,
      itemCount: words.length,
    });
  }, [mode, level, unit, round, words.length]);

  useEffect(() => {
    if (!isComplete || words.length === 0 || reportedRef.current) return;

    reportedRef.current = true;

    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);

    void reportLessonComplete({
      sessionId: sessionIdRef.current,
      level,
      unit,
      knownWordIds: knownIds,
      reviewWordIds: reviewIds,
      durationSec,
    });

    track("session_completed", {
      sessionKind: "lesson",
      direction: mode,
      level,
      unit,
      round,
      itemCount: words.length,
      durationSec,
      outcome: "completed",
    });
  }, [isComplete, words.length, level, unit, round, mode, knownIds, reviewIds]);

  const progress = useMemo(() => {
    if (words.length === 0) return 0;
    return Math.floor(
      (Math.min(currentIndex, words.length) / words.length) * 100
    );
  }, [currentIndex, words.length]);

  /**
   * The example sentence follows the mode, and so does the voice that reads it.
   *
   * A card teaching Thai that illustrates the word with an English-only sentence is
   * showing the prompt twice and the subject never; and a Thai sentence handed to an
   * `en-US` voice comes out as noise, so the language decides the utterance too. The
   * other half stays underneath as a translation — it is what makes the studied sentence
   * decodable.
   */
  const example =
    mode === "english"
      ? {
          text: currentWord?.exampleEn ?? "",
          lang: "en-US" as const,
          isThai: false,
          translation: currentWord?.exampleTh ?? "",
          translationIsThai: true,
        }
      : {
          text: currentWord?.exampleTh ?? "",
          lang: "th-TH" as const,
          isThai: true,
          translation: currentWord?.exampleEn ?? "",
          translationIsThai: false,
        };

  const speakHero = (text: string | null | undefined, lang: SpeechLang) => {
    const token = heroSpeechTokenRef.current + 1;
    heroSpeechTokenRef.current = token;
    setSpeakingHero(true);

    const clear = () => {
      // Keep the visual response long enough to be perceived (and testable) even when a
      // browser has no voice installed and reports an immediate synthesis error.
      window.setTimeout(() => {
        if (heroSpeechTokenRef.current === token) setSpeakingHero(false);
      }, 700);
    };

    speak(text, lang, clear);
    window.setTimeout(clear, 4000);
  };

  const goNext = () => {
    // Clear the highlight with the card: the index belongs to the previous word, so
    // keeping it would light up an unrelated letter of the next one.
    setActiveLetter(null);
    setSpeakingHero(false);
    setCurrentIndex((value) => value + 1);
  };

  // The word id and text stay out of analytics on purpose (docs/LEARNER-LIFECYCLE.md
  // §7.1): only the 1-based position and the constrained outcome are reported.
  const trackAnswer = (outcome: "known" | "review") => {
    track("answer_submitted", {
      sessionKind: "lesson",
      direction: mode,
      level,
      unit,
      round,
      itemIndex: currentIndex + 1,
      itemCount: words.length,
      outcome,
    });
  };

  const handleKnown = () => {
    if (!currentWord) return;
    trackAnswer("known");
    setKnownIds((items) => addUnique(items, currentWord.id));
    goNext();
  };

  const handleReview = () => {
    if (!currentWord) return;
    trackAnswer("review");
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
            <div className="play-pop flex size-16 items-center justify-center rounded-3xl border-3 border-ink bg-success text-white">
              <ListChecks className="size-7" />
            </div>

              <Badge className="play-stamp mt-6 border-ink bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink hover:bg-accent-sun">
                {tCommon("unitLabel", { level, unit })} · {tLesson("roundLabel", { round, total: roundCount })}
              </Badge>

              <h1 className="play-display mt-6 max-w-2xl text-[clamp(2.25rem,6vw,3.5rem)]">
                {tLesson("completeTitle", { count: words.length })}
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                {tLesson("completeDescription")}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="play-sticker rounded-3xl bg-brand-soft p-5 [--tile-block:var(--brand)] [--lift:4px]">
                  <p className="play-count text-4xl font-extrabold tracking-tight">{words.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tLesson("statWordCards")}
                  </p>
                </div>

                <div className="play-sticker rounded-3xl bg-success-soft p-5 [--tile-block:var(--success)] [--lift:4px]">
                  <p className="play-count text-4xl font-extrabold tracking-tight" data-testid="summary-known">
                    {knownIds.length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tLesson("statKnown")}
                  </p>
                </div>

                <div className="play-sticker rounded-3xl bg-warn-soft p-5 [--tile-block:var(--warn)] [--lift:4px]">
                  <p className="play-count text-4xl font-extrabold tracking-tight" data-testid="summary-review">
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
                    className="play-key h-14 rounded-2xl bg-brand px-7 text-base font-extrabold text-white hover:bg-brand"
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
        <div className="mx-auto w-full max-w-5xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
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

          <div className="mt-3 grid gap-1 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {tLesson("title")}
              </h1>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-white sm:text-sm">
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

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/25">
            <div
              data-testid="lesson-progress-fill"
              className="h-full rounded-full bg-white transition-[width] duration-[400ms] ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="play-sticker p-3 [--tile-block:var(--accent-sky)] sm:p-4">
          <div>
            <article className="rounded-[20px] bg-brand-soft p-4 sm:rounded-[24px] sm:p-5">
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

              <div className="mt-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-7 lg:gap-y-4">
                {/*
                  Whichever language is being studied is the hero. In Thai mode the English
                  word is the *prompt* — making it the biggest thing on a screen for
                  learning Thai puts the answer above the subject.
                */}
                {mode === "english" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-4 lg:col-start-1 lg:row-start-1">
                    <h2
                      className={`play-word rounded-xl transition-colors ${speakingHero ? "bg-accent-sun px-2 text-ink" : ""}`}
                      data-testid="card-hero"
                      data-speaking={speakingHero}
                    >
                      {getWordLabel(currentWord)}
                    </h2>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="play-key mt-3 size-12 rounded-full bg-white [--lift:4px]"
                      onClick={() => {
                        speakHero(currentWord.word, "en-US");
                      }}
                      aria-label={tLesson("listenEnglish")}
                    >
                      <Volume2 className="size-5" />
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 lg:col-start-1 lg:row-start-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          {tLesson("englishPrompt")}
                        </p>
                        <p className="mt-1 text-xl font-bold text-foreground">
                          {getWordLabel(currentWord)}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9 rounded-full bg-white"
                        onClick={() => speak(currentWord.word, "en-US")}
                        aria-label={tLesson("listenEnglish")}
                      >
                        <Volume2 className="size-4" />
                      </Button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <h2
                        className={`play-word rounded-xl transition-colors ${modernThaiFont ? "font-thai-modern" : "font-thai"} ${speakingHero ? "bg-accent-sun px-2 text-ink" : ""}`}
                        lang="th"
                        data-testid="card-hero"
                        data-speaking={speakingHero}
                      >
                        {currentWord.meaningTh
                          ? meaningClusters.map((cluster, i) => {
                              const active =
                                activeLetter !== null &&
                                cluster.indices.includes(activeLetter);

                              return (
                                <span
                                  key={i}
                                  data-testid="hero-letter"
                                  data-active={active}
                                  className={
                                    active
                                      ? "rounded-lg bg-accent-sun px-1 text-ink"
                                      : undefined
                                  }
                                >
                                  {cluster.text}
                                </span>
                              );
                            })
                          : tLesson("meaningPlaceholder")}
                      </h2>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="play-key mt-3 size-12 rounded-full bg-white [--lift:4px]"
                        disabled={!currentWord.meaningTh}
                        onClick={() => {
                          speakHero(currentWord.meaningTh, "th-TH");
                        }}
                        aria-label={tLesson("listenThai")}
                      >
                        <Volume2 className="size-5" />
                      </Button>
                    </div>

                    <div
                      className="mt-3 inline-flex rounded-full border-2 border-ink bg-white p-1"
                      role="group"
                      aria-label={tLesson("thaiFontStyle")}
                      data-testid="thai-font-toggle"
                    >
                      {[false, true].map((modern) => (
                        <button
                          key={String(modern)}
                          type="button"
                          aria-pressed={modernThaiFont === modern}
                          onClick={() => setModernThaiFont(modern)}
                          className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                            modernThaiFont === modern
                              ? "bg-brand text-white hover:bg-ink"
                              : "text-ink hover:bg-brand-soft"
                          }`}
                        >
                          {tLesson(modern ? "thaiFontModern" : "thaiFontBook")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`mt-5 grid gap-3 lg:col-start-1 lg:row-start-2 ${mode === "english" ? "sm:grid-cols-2 lg:grid-cols-1" : ""}`}>
                  {mode === "english" && (
                  <div className="rounded-3xl border-3 border-ink bg-white p-5">
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
                        aria-label={tLesson("listenMeaning")}
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
                  )}

                  {mode === "english" ? (
                    <div className="rounded-3xl border-3 border-ink bg-white p-5">
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
                  ) : (
                    <div
                      className="rounded-3xl border-3 border-ink bg-white p-5"
                      data-testid="thai-reading"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {tWord("thaiReading")}
                      </p>

                      <p
                        className="font-thai mt-2 text-lg font-semibold"
                        lang="th"
                      >
                        {currentWord.meaningThReading || "—"}
                      </p>

                      {currentWord.meaningThRoman && (
                        <p className="mt-1 text-base text-muted-foreground">
                          {currentWord.meaningThRoman}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* The letters of the Thai meaning, derived — never stored. Only useful to
                    someone reading Thai, so it rides with the Thai-learning mode. */}
                {/* Each letter speaks its *name* ("ก ไก่", "ไม้หันอากาศ") rather than the
                    bare character: a lone vowel sign or tone mark has no sound of its own,
                    and the name is what a learner is memorising. Uses the same
                    `speechSynthesis` path as the meaning button above — SPEC §5.6 replaces
                    all of it with pre-generated R2 audio later. */}
                {mode === "thai" && currentWord.meaningTh && (
                  <div
                    className="mt-5 lg:col-start-2 lg:row-start-1 lg:mt-0"
                    data-testid="thai-letters"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {tLesson("thaiLettersTitle")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {tLesson("thaiLettersHint")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                    {meaningLetters
                      .filter((item) => item.char.trim() !== "")
                      .map((item) => (
                        <button
                          key={item.index}
                          type="button"
                          data-testid="thai-letter"
                          data-char={item.char}
                          disabled={!item.letter}
                          aria-pressed={activeLetter === item.index}
                          aria-label={item.letter?.name ?? item.char}
                          title={item.letter?.name}
                          onClick={() => {
                            if (!item.letter) return;
                            setActiveLetter(item.index);
                            speak(item.letter.name, "th-TH");
                          }}
                          className={`flex min-h-14 min-w-12 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-ink px-2 py-2 transition-colors hover:bg-accent-sun disabled:cursor-not-allowed disabled:opacity-50 ${
                            activeLetter === item.index
                              ? "bg-accent-sun"
                              : "bg-white"
                          }`}
                        >
                          <span className="font-thai text-lg leading-none" lang="th">
                            {item.char}
                          </span>
                          <span className="mt-1.5 text-[10px] leading-none text-muted-foreground">
                            {item.letter?.name ?? "?"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 rounded-3xl border border-border bg-white p-4 lg:col-start-2 lg:row-start-2 lg:mt-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {tLesson("example")}
                    </p>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-full"
                      data-testid="example-listen"
                      disabled={!example.text}
                      onClick={() => speak(example.text, example.lang)}
                      aria-label={tLesson("listenExample")}
                    >
                      <Volume2 className="size-4" />
                    </Button>
                  </div>

                  <p
                    className={`mt-2 text-base leading-7 text-foreground${
                      example.isThai ? " font-thai" : ""
                    }`}
                    lang={example.isThai ? "th" : "en"}
                    data-testid="example-text"
                  >
                    <span className="mr-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {tLesson(example.isThai ? "languageThai" : "languageEnglish")}
                    </span>
                    {example.text || tLesson("examplePlaceholder")}
                  </p>

                  {example.text && example.translation && (
                    <p
                      className={`mt-2 text-sm leading-6 text-muted-foreground${
                        example.translationIsThai ? " font-thai" : ""
                      }`}
                      lang={example.translationIsThai ? "th" : "en"}
                      data-testid="example-translation"
                    >
                      <span className="mr-2 text-xs font-bold uppercase tracking-wide">
                        {tLesson(
                          example.translationIsThai
                            ? "languageThai"
                            : "languageEnglish",
                        )}
                      </span>
                      {example.translation}
                    </p>
                  )}
                </div>
              </div>
            </article>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                data-testid="review-later"
                className="play-key h-14 rounded-2xl bg-warn text-base font-extrabold text-ink hover:bg-warn"
                onClick={handleReview}
              >
                <RotateCcw className="size-5" />
                {tLesson("reviewLater")}
              </Button>

              <Button
                data-testid="i-know-this"
                className="play-key h-14 rounded-2xl bg-success text-base font-extrabold text-white hover:bg-success"
                onClick={handleKnown}
              >
                <Check className="size-5" />
                {tLesson("iKnowThis")}
              </Button>
            </div>
          </div>
        </div>

      </section>
    </main>
  );
}
