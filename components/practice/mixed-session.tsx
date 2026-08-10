"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Timer, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  answerSessionItem,
  startSession,
  SessionApiError,
  type SessionItem,
} from "@/lib/session-api";
import { track } from "@/lib/analytics";
import type { CefrLevel } from "@/lib/types";

/**
 * The merged eight-item mixed session that replaces lesson→quiz
 * (`docs/LEARNER-LIFECYCLE.md` §0, §3.5, §3.10, §4.1, §8 L2). Interaction rules are the
 * same ones `PracticeSession` implements for the anonymous trial — no navigation chrome,
 * a continue button that never moves, colour is never the only signal, keyboard 1-4/
 * Enter/Esc — specified once in the doc, implemented in both places because a learner who
 * has done both must not notice a seam.
 *
 * Five item types share this shell:
 * - choose-meaning / choose-word: 4-option recognition, graded by option index.
 * - spelling: a typed answer, graded server-side against the real word.
 * - match-pairs / speed-round: warm-up variants (§4.1 — "never as proof of mastery"), so
 *   the server does not move mastery for them even though they still fill an item-slot.
 *   match-pairs renders as tap-the-word-then-tap-the-meaning instead of a single tap;
 *   speed-round adds a visible countdown that locks in "incorrect" on timeout.
 */

const SPEED_ROUND_SECONDS = 6;

type AnsweredItem = {
  correct: boolean;
  selectedOptionIndex?: number;
  spelling?: string;
  correctSpelling?: string;
};

type Phase = "loading" | "in-progress" | "checking" | "feedback" | "result" | "blocked" | "error";

export type MixedSessionScope = {
  level: CefrLevel;
  unit?: number;
  mode?: "normal" | "comeback" | "review";
};

type MixedSessionProps = {
  scope: MixedSessionScope;
  backHref: string;
};

export function MixedSession({ scope, backHref }: MixedSessionProps) {
  const t = useTranslations("Session");
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [answered, setAnswered] = useState<AnsweredItem[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [typedSpelling, setTypedSpelling] = useState("");
  const [lastResult, setLastResult] = useState<AnsweredItem | null>(null);
  const [errorCode, setErrorCode] = useState<"generic" | "not-enough" | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [speedLeft, setSpeedLeft] = useState(SPEED_ROUND_SECONDS);

  const startedTrackedRef = useRef(false);
  // match-pairs is a two-tap interaction (§3.10): the first tap "picks up" the word, the
  // second submits it. A ref rather than state so a second tap that lands before React has
  // re-rendered still sees the picked-up flag and submits, instead of swallowing itself.
  const matchWordTappedRef = useRef(false);
  const currentIndex = answered.length;
  const visibleIndex = phase === "feedback" ? Math.max(currentIndex - 1, 0) : currentIndex;
  const currentItem = items[visibleIndex];

  const boot = useCallback(async () => {
    setPhase("loading");
    try {
      const result = await startSession(
        scope.unit === undefined ? { level: scope.level } : { level: scope.level, unit: scope.unit },
      );
      setSessionId(result.sessionId);
      setItems(result.items);
      setDueCount(result.dueCount);
      setAnswered([]);
      setPhase(result.itemCount === 0 ? "result" : "in-progress");
      if (!startedTrackedRef.current) {
        startedTrackedRef.current = true;
        track("session_started", {
          sessionKind: "mixed",
          level: scope.level,
          unit: scope.unit,
          itemCount: result.itemCount,
          dueCount: result.dueCount,
        });
      }
    } catch (err) {
      if (err instanceof SessionApiError && err.status === 422) {
        setErrorCode("not-enough");
      } else {
        setErrorCode("generic");
      }
      setPhase("error");
    }
  }, [scope.level, scope.unit]);

  useEffect(() => {
    const timer = window.setTimeout(() => void boot(), 0);
    return () => window.clearTimeout(timer);
  }, [boot]);

  const submitSelection = useCallback(
    async (optionIndex: number) => {
      if (phase !== "in-progress" || !sessionId || !currentItem) return;
      setSelected(optionIndex);
      setPhase("checking");
      try {
        const result = await answerSessionItem({
          sessionId,
          itemIndex: currentIndex,
          selectedOptionIndex: optionIndex,
        });
        const entry: AnsweredItem = { correct: result.correct, selectedOptionIndex: optionIndex };
        const nextAnswered = [...answered, entry];
        setAnswered(nextAnswered);
        setLastResult(entry);
        setPhase("feedback");
        track("answer_submitted", {
          sessionKind: "mixed",
          itemIndex: currentIndex + 1,
          itemType: currentItem.type,
          correct: result.correct,
        });
        if (result.done) {
          track("session_completed", {
            sessionKind: "mixed",
            level: scope.level,
            unit: scope.unit,
            itemCount: items.length,
            correctCount: result.correctCount,
          });
        }
      } catch {
        setErrorCode("generic");
        setPhase("error");
      }
    },
    [phase, sessionId, currentItem, currentIndex, answered, items.length, scope.level, scope.unit],
  );

  const submitSpelling = useCallback(async () => {
    if (phase !== "in-progress" || !sessionId || !currentItem) return;
    setPhase("checking");
    try {
      const result = await answerSessionItem({
        sessionId,
        itemIndex: currentIndex,
        spelling: typedSpelling,
      });
      const entry: AnsweredItem = {
        correct: result.correct,
        spelling: typedSpelling,
        correctSpelling: result.correctSpelling,
      };
      const nextAnswered = [...answered, entry];
      setAnswered(nextAnswered);
      setLastResult(entry);
      setPhase("feedback");
      track("answer_submitted", {
        sessionKind: "mixed",
        itemIndex: currentIndex + 1,
        itemType: currentItem.type,
        correct: result.correct,
      });
      if (result.done) {
        track("session_completed", {
          sessionKind: "mixed",
          level: scope.level,
          unit: scope.unit,
          itemCount: items.length,
          correctCount: result.correctCount,
        });
      }
    } catch {
      setErrorCode("generic");
      setPhase("error");
    }
  }, [phase, sessionId, currentItem, currentIndex, typedSpelling, answered, items.length, scope.level, scope.unit]);

  const continueToNext = useCallback(() => {
    setSelected(null);
    matchWordTappedRef.current = false;
    setTypedSpelling("");
    setLastResult(null);
    setSpeedLeft(SPEED_ROUND_SECONDS);
    setPhase(currentIndex >= items.length ? "result" : "in-progress");
  }, [currentIndex, items.length]);

  // Speed-round countdown: locks in as answered-incorrect on timeout rather than hanging
  // the session open forever.
  useEffect(() => {
    if (phase !== "in-progress" || currentItem?.type !== "speed-round") return;
    const interval = window.setInterval(() => {
      setSpeedLeft((left) => {
        if (left <= 1) {
          window.clearInterval(interval);
          // -1 is out of range for every option index the server derived, so it always
          // grades as incorrect without pretending to be a real guess.
          void submitSelection(-1);
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
    // `submitSelection` is stable for the whole in-progress window: it only changes
    // identity together with `phase`/`currentIndex`, both already deps below, so this
    // never re-arms the timer mid-countdown — no eslint-disable needed.
  }, [phase, currentItem?.type, visibleIndex, submitSelection]);

  // Keyboard: 1-4 select, Enter checks/continues, Esc opens the close confirmation.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (showClose) {
        if (event.key === "Escape") setShowClose(false);
        return;
      }
      if (event.key === "Escape") {
        setShowClose(true);
        return;
      }
      if ((phase === "in-progress" || phase === "feedback") && event.key === "Enter") {
        if (phase === "feedback") continueToNext();
        else if (currentItem?.type === "spelling") void submitSpelling();
        else if (selected !== null) void submitSelection(selected);
        return;
      }
      if (phase === "in-progress" && currentItem?.type !== "spelling" && /^[1-4]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (currentItem && index < (currentItem.options?.length ?? 0)) void submitSelection(index);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, selected, currentItem, submitSelection, submitSpelling, continueToNext, showClose]);

  const correctCount = useMemo(() => answered.filter((a) => a.correct).length, [answered]);

  if (phase === "loading") {
    return (
      <div className="play-card flex flex-col items-center gap-3 p-10 text-center" data-testid="session-loading">
        <Loader2 className="size-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground">{t("preparing")}</p>
      </div>
    );
  }

  if (phase === "error") {
    const titleKey = errorCode === "not-enough" ? "notEnoughTitle" : "errorTitle";
    const bodyKey = errorCode === "not-enough" ? "notEnoughBody" : "errorBody";
    return (
      <div className="play-card flex flex-col items-center gap-4 p-8 text-center" data-testid="session-error">
        <div className="flex size-12 items-center justify-center rounded-2xl border-3 border-ink bg-danger text-white">
          <AlertTriangle className="size-5" />
        </div>
        <h2 className="text-xl font-bold">{t(titleKey)}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t(bodyKey)}</p>
        {errorCode !== "not-enough" && (
          <Button
            data-testid="session-retry"
            className="play-key h-12 rounded-2xl bg-brand px-6 font-extrabold text-white hover:bg-brand"
            onClick={() => {
              setErrorCode(null);
              void boot();
            }}
          >
            {t("retry")}
          </Button>
        )}
      </div>
    );
  }

  if (phase === "result") {
    const total = items.length;
    return (
      <div className="play-card p-6 sm:p-8" data-testid="session-result">
        <Badge className="rounded-full bg-brand text-white hover:bg-brand">{t("resultBadge")}</Badge>
        <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl" data-testid="session-result-heading">
          {t("resultHeadline", { correct: correctCount, total })}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("resultBody")}</p>

        <div className="mt-4 flex flex-wrap gap-2" data-testid="session-result-pips">
          {answered.map((a, i) => (
            <span
              key={i}
              data-testid="session-result-pip"
              data-correct={a.correct}
              className={`flex size-8 items-center justify-center rounded-full border-2 border-ink text-xs font-bold ${
                a.correct ? "bg-success text-white" : "bg-danger text-white"
              }`}
            >
              {a.correct ? <Check className="size-4" /> : <X className="size-4" />}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="play-key h-14 rounded-2xl bg-brand px-7 text-base font-extrabold text-white hover:bg-brand">
            <Link href={backHref} data-testid="session-continue-home">
              {t("backToToday")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentItem) return null;

  const showingFeedback = phase === "feedback" && lastResult;
  const isSpelling = currentItem.type === "spelling";
  const isMatchPairs = currentItem.type === "match-pairs";
  const isSpeedRound = currentItem.type === "speed-round";
  const promptText = currentItem.prompt.displayWord ?? currentItem.prompt.meaningTh ?? "";

  return (
    <div data-testid="session-card" data-item-type={currentItem.type}>
      {/* Shell: progress + close only — no other chrome inside a session
          (LEARNER-LIFECYCLE.md §3.10.1). */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label={t("closeAria")}
          data-testid="session-close"
          onClick={() => setShowClose(true)}
          className="play-press flex size-10 items-center justify-center rounded-full border-3 border-ink bg-white"
        >
          <X className="size-4" />
        </button>

        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuenow={currentIndex} aria-valuemin={0} aria-valuemax={items.length}>
          {items.map((_, i) => (
            <span
              key={i}
              data-testid="session-pip"
              data-filled={i < answered.length}
              className={`h-2.5 flex-1 rounded-full transition-colors ${
                i < answered.length ? (answered[i].correct ? "bg-success" : "bg-danger") : "bg-ink/15"
              }`}
            />
          ))}
        </div>

        <span className="text-sm font-semibold text-muted-foreground" data-testid="session-counter">
          {t("itemCounter", { current: Math.min(visibleIndex + 1, items.length), total: items.length })}
        </span>
      </div>

      {isSpeedRound && phase === "in-progress" && (
        <div className="mt-3 flex items-center gap-2 text-sm font-bold text-danger" data-testid="session-speed-timer">
          <Timer className="size-4" aria-hidden />
          {t("speedSecondsLeft", { seconds: speedLeft })}
        </div>
      )}

      <div className="play-sticker mt-5 p-4 [--tile-block:var(--accent-sky)] sm:p-6">
        <article className="rounded-[20px] bg-brand-soft p-5 sm:rounded-[24px] sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {isMatchPairs ? t("matchPromptLabel") : t("promptLabel")}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="play-word" data-testid="session-prompt">
              {promptText}
            </h2>
            {currentItem.prompt.partOfSpeech && (
              <Badge variant="outline" className="rounded-full bg-white">
                {currentItem.prompt.partOfSpeech}
              </Badge>
            )}
          </div>

          {currentItem.prompt.pronunciationTh && (
            <p className="font-thai mt-2 text-base text-muted-foreground" lang="th">
              {currentItem.prompt.pronunciationTh}
            </p>
          )}

          {isSpelling ? (
            <div className="mt-4">
              <label htmlFor="session-spelling-input" className="text-sm font-semibold text-foreground">
                {t("spellingQuestion")}
              </label>
              <input
                id="session-spelling-input"
                data-testid="session-spelling-input"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={phase !== "in-progress"}
                value={typedSpelling}
                onChange={(e) => setTypedSpelling(e.target.value)}
                className="mt-2 h-14 w-full rounded-2xl border-3 border-ink bg-white px-4 text-lg font-semibold outline-none focus-visible:ring-4 focus-visible:ring-brand/40"
              />
            </div>
          ) : (
            <>
              <p className="mt-4 text-sm font-semibold text-foreground">
                {isMatchPairs ? t("matchQuestion") : t("question")}
              </p>
              {isMatchPairs && (
                <p className="mt-1 text-xs text-muted-foreground">{t("matchHint")}</p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("question")}>
                {currentItem.options?.map((option, index) => {
                  const isSelected = selected === index;
                  const isCorrectOption = !!showingFeedback && lastResult.selectedOptionIndex !== undefined && lastResult.correct && isSelected;
                  const isWrongSelected = !!showingFeedback && isSelected && !lastResult.correct;
                  const label = option.meaningTh ?? option.displayWord ?? "";

                  return (
                    <button
                      key={index}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      data-testid="session-option"
                      data-index={index}
                      disabled={phase !== "in-progress"}
                      onClick={() => {
                        if (isMatchPairs && !matchWordTappedRef.current) {
                          matchWordTappedRef.current = true;
                          return;
                        }
                        void submitSelection(index);
                      }}
                      className={[
                        "play-press flex min-h-14 items-center gap-3 rounded-2xl border-3 border-ink px-4 py-3 text-left text-base font-semibold font-thai transition-colors disabled:cursor-not-allowed",
                        isCorrectOption
                          ? "bg-success text-white"
                          : isWrongSelected
                            ? "bg-danger text-white"
                            : isSelected
                              ? "bg-accent-sun text-ink"
                              : "bg-white text-ink hover:bg-brand-soft",
                      ].join(" ")}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs font-bold">
                        {index + 1}
                      </span>
                      <span lang="th">{label}</span>
                      {isCorrectOption && <Check className="ml-auto size-5 shrink-0" />}
                      {isWrongSelected && <X className="ml-auto size-5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Feedback appears in a reserved, fixed-height slot so the continue button
              below never shifts when it shows (LEARNER-LIFECYCLE.md §3.10.2 — the button
              is pressed by muscle memory and must not move). */}
          <div className="mt-4 h-[92px]">
            {showingFeedback && (
              <div
                className={`rounded-2xl border-3 border-ink p-4 ${lastResult.correct ? "bg-success-soft" : "bg-warn-soft"}`}
                data-testid="session-feedback"
                role="status"
              >
                <p className="flex items-center gap-2 text-sm font-extrabold">
                  {lastResult.correct ? (
                    <>
                      <Check className="size-4 text-success" />
                      {t("feedbackCorrect")}
                    </>
                  ) : (
                    <>
                      <X className="size-4 text-ink" />
                      {isSpelling
                        ? t("feedbackWrongSpelling", { word: lastResult.correctSpelling ?? "" })
                        : t("feedbackWrongGeneric")}
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </article>
      </div>

      {/* The continue button never moves (LEARNER-LIFECYCLE.md §3.10.2). */}
      <div className="mt-5">
        <Button
          size="lg"
          data-testid="session-continue"
          disabled={
            phase === "in-progress"
              ? isSpelling
                ? typedSpelling.trim().length === 0
                : true
              : phase === "checking"
          }
          onClick={() => {
            if (phase !== "in-progress") {
              continueToNext();
              return;
            }
            if (isSpelling) void submitSpelling();
          }}
          className="play-key h-14 w-full rounded-2xl bg-brand text-base font-extrabold text-white hover:bg-brand disabled:opacity-40"
        >
          {phase === "checking" ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              {t("checking")}
            </>
          ) : phase === "feedback" ? (
            t("continue")
          ) : isSpelling ? (
            t("check")
          ) : (
            t("continue")
          )}
        </Button>
      </div>

      {dueCount > 0 && phase === "in-progress" && visibleIndex === 0 && (
        <p className="mt-3 text-center text-xs text-muted-foreground" data-testid="session-due-note">
          {t("dueNote", { count: dueCount })}
        </p>
      )}

      {showClose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label={t("closeConfirmTitle")}
          data-testid="session-close-confirm"
        >
          <div className="play-card w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold">{t("closeConfirmTitle")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("closeConfirmBody")}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild className="play-key h-12 rounded-2xl bg-brand font-extrabold text-white hover:bg-brand">
                <Link href={backHref} data-testid="session-close-confirm-save">
                  {t("closeConfirmSave")}
                </Link>
              </Button>
              <Button variant="ghost" onClick={() => setShowClose(false)} data-testid="session-close-confirm-cancel">
                {t("closeConfirmCancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
