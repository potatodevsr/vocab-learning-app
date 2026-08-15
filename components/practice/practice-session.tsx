"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Volume2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  answerPractice,
  claimPractice,
  startPractice,
  PracticeApiError,
  type PracticeItem,
} from "@/lib/practice-api";
import { track } from "@/lib/analytics";
import type { AcquisitionFamily } from "@/lib/analytics";
import type { CefrLevel } from "@/lib/types";
import { API_URL } from "@/constants/config";

/**
 * The anonymous/first-saved practice trial (`docs/LEARNER-LIFECYCLE.md` §3.2, §3.10).
 * Same interaction rules for the public trial and a saved session — specified once there,
 * implemented once here.
 *
 * The backend only issues 4-option recognition items today (`backend/src/practice.ts`),
 * so this component never renders a typing input — that is an honest reflection of what
 * `/practice/start` actually returns, not a missing feature on this side.
 */

type AnsweredItem = {
  selectedOptionIndex: number;
  correct: boolean;
  correctOptionIndex: number;
};

type CachedSession = {
  trialId: string;
  items: PracticeItem[];
  answered: AnsweredItem[];
  scopeKey: string;
};

type Phase = "loading" | "in-progress" | "checking" | "feedback" | "result" | "blocked" | "error";

export type PracticeScope = {
  level: CefrLevel;
  unit?: number;
};

type PracticeSessionProps = {
  scope: PracticeScope;
  /** Stable per-page key so sessionStorage cannot mix up two different scopes in one tab. */
  scopeKey: string;
  sourceFamily: AcquisitionFamily;
  sourcePath: string;
  backHref: string;
  nextLabel: string;
};

const storageKey = (scopeKey: string) => `va_practice_${scopeKey}`;

const readCache = (scopeKey: string): CachedSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(scopeKey));
    if (!raw) return null;
    const value = JSON.parse(raw) as CachedSession;
    if (value.scopeKey !== scopeKey || !Array.isArray(value.items)) return null;
    return value;
  } catch {
    return null;
  }
};

const writeCache = (scopeKey: string, value: CachedSession) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(scopeKey), JSON.stringify(value));
  } catch {
    // best-effort — the server remains the source of truth either way
  }
};

const clearCache = (scopeKey: string) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(scopeKey));
  } catch {
    // best-effort
  }
};

export function PracticeSession({
  scope,
  scopeKey,
  sourceFamily,
  sourcePath,
  backHref,
  nextLabel,
}: PracticeSessionProps) {
  const t = useTranslations("Practice");
  const [phase, setPhase] = useState<Phase>("loading");
  const [trialId, setTrialId] = useState<string | null>(null);
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [answered, setAnswered] = useState<AnsweredItem[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<AnsweredItem | null>(null);
  const [errorCode, setErrorCode] = useState<"rate-limited" | "not-enough" | "generic" | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<{ correctCount: number; total: number } | null>(null);

  const startedTrackedRef = useRef(false);
  const currentIndex = answered.length;
  // While feedback is visible, keep rendering the item that was just answered. Using
  // `answered.length` directly advances the prompt one card too early and makes the
  // fifth answer disappear into a blank screen before Continue can be pressed.
  const visibleIndex = phase === "feedback" ? Math.max(currentIndex - 1, 0) : currentIndex;
  const currentItem = items[visibleIndex];

  const boot = useCallback(async () => {
    const cached = readCache(scopeKey);
    if (cached && cached.answered.length < cached.items.length) {
      setTrialId(cached.trialId);
      setItems(cached.items);
      setAnswered(cached.answered);
      setPhase("in-progress");
      return;
    }
    if (cached && cached.answered.length >= cached.items.length) {
      // A fully answered trial with nothing new to fetch — go straight to the result.
      setTrialId(cached.trialId);
      setItems(cached.items);
      setAnswered(cached.answered);
      setPhase("result");
      return;
    }

    setPhase("loading");
    try {
      // Rebuilt from primitive deps rather than closing over the `scope` prop object
      // itself, so this callback's dependency list can be exhaustive without an
      // eslint-disable: a fresh `{ level, unit }` literal from the parent render would
      // otherwise be a new reference every time even though its contents never change.
      const result = await startPractice(
        scope.unit === undefined ? { level: scope.level } : { level: scope.level, unit: scope.unit },
      );
      writeCache(scopeKey, {
        trialId: result.trialId,
        items: result.items,
        answered: [],
        scopeKey,
      });
      setTrialId(result.trialId);
      setItems(result.items);
      setAnswered([]);
      setPhase("in-progress");
      if (!startedTrackedRef.current) {
        startedTrackedRef.current = true;
        track("trial_started", {
          sessionKind: "trial",
          acquisitionFamily: sourceFamily,
          sourcePath,
          level: scope.level,
          unit: scope.unit,
          itemCount: result.itemCount,
        });
      }
    } catch (err) {
      if (err instanceof PracticeApiError && err.status === 429) {
        setPhase("blocked");
        return;
      }
      if (err instanceof PracticeApiError && err.status === 422) {
        setErrorCode("not-enough");
        setPhase("error");
        return;
      }
      setErrorCode("generic");
      setPhase("error");
    }
  }, [scopeKey, scope.level, scope.unit, sourceFamily, sourcePath]);

  useEffect(() => {
    const timer = window.setTimeout(() => void boot(), 0);
    return () => window.clearTimeout(timer);
  }, [boot]);

  // Best-effort: only used to decide whether the result screen offers "save" or shows
  // "already signed in" — grading and claiming remain entirely server-authoritative.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/user/me`, { credentials: "include", cache: "no-store" })
      .then((res) => {
        if (!cancelled) setIsAuthed(res.ok);
      })
      .catch(() => {
        if (!cancelled) setIsAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(
    async (optionIndex: number) => {
      if (phase !== "in-progress" || !trialId || !currentItem) return;
      setSelected(optionIndex);
      setPhase("checking");

      try {
        const result = await answerPractice({
          itemIndex: currentIndex,
          selectedOptionIndex: optionIndex,
        });

        const entry: AnsweredItem = {
          selectedOptionIndex: optionIndex,
          correct: result.correct,
          correctOptionIndex: result.correctOptionIndex,
        };

        const nextAnswered = [...answered, entry];
        setAnswered(nextAnswered);
        setLastResult(entry);
        setPhase("feedback");
        writeCache(scopeKey, { trialId, items, answered: nextAnswered, scopeKey });

        track("trial_answered", {
          sessionKind: "trial",
          level: scope.level,
          unit: scope.unit,
          itemIndex: currentIndex + 1,
          itemCount: items.length,
          correct: result.correct,
        });

        if (result.done) {
          track("trial_completed", {
            sessionKind: "trial",
            level: scope.level,
            unit: scope.unit,
            itemCount: items.length,
            outcome: "completed",
          });
        }
      } catch {
        // Leave the option locked and let the learner retry the same item — the server
        // never received an authoritative verdict, so nothing may be shown as correct.
        setErrorCode("generic");
        setPhase("error");
        return;
      }
    },
    [phase, trialId, currentItem, currentIndex, answered, items, scopeKey, scope.level, scope.unit],
  );

  const continueToNext = useCallback(() => {
    setSelected(null);
    setLastResult(null);
    setPhase(currentIndex >= items.length ? "result" : "in-progress");
  }, [currentIndex, items.length]);

  const attemptClaim = useCallback(async () => {
    if (claiming || claimed) return;
    setClaiming(true);
    try {
      const result = await claimPractice();
      setClaimed({ correctCount: result.correctCount, total: result.total });
      clearCache(scopeKey);
    } catch {
      // Not signed in, or the claim cookie already expired — the result screen still
      // offers the normal "save my progress" signup CTA in that case.
    } finally {
      setClaiming(false);
    }
  }, [claiming, claimed, scopeKey]);

  useEffect(() => {
    if (phase !== "result" || !isAuthed) return;
    const timer = window.setTimeout(() => void attemptClaim(), 0);
    return () => window.clearTimeout(timer);
  }, [phase, isAuthed, attemptClaim]);

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
        else if (selected !== null) void submit(selected);
        return;
      }
      if (phase === "in-progress" && /^[1-4]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (currentItem && index < currentItem.options.length) void submit(index);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, selected, currentItem, submit, continueToNext, showClose]);

  const correctCount = useMemo(
    () => answered.filter((a) => a.correct).length,
    [answered],
  );

  const returnTo = useMemo(() => {
    const url = new URL(sourcePath, "https://placeholder.invalid");
    return `${url.pathname}${url.search}`;
  }, [sourcePath]);

  // `Link` is locale-aware and adds the current locale itself. Passing a pre-localised href
  // here produces `/en/en/auth/register` and a dead-end 404 at the moment of value.
  const signupHref = `/auth/register?from=${encodeURIComponent(returnTo)}`;

  // ---------------------------------------------------------------- render branches

  if (phase === "loading") {
    return (
      <div className="play-card flex flex-col items-center gap-3 p-10 text-center" data-testid="practice-loading">
        <Loader2 className="size-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground">{t("preparing")}</p>
      </div>
    );
  }

  if (phase === "blocked") {
    return (
      <div className="play-card flex flex-col items-center gap-4 p-8 text-center" data-testid="practice-blocked">
        <div className="flex size-12 items-center justify-center rounded-2xl border-3 border-ink bg-warn text-ink">
          <AlertTriangle className="size-5" />
        </div>
        <h2 className="text-xl font-bold">{t("alreadyInProgressTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("alreadyInProgressBody")}</p>
        <Button asChild variant="outline" className="play-press rounded-full bg-white">
          <Link href={backHref}>{t("backLink")}</Link>
        </Button>
      </div>
    );
  }

  if (phase === "error") {
    const titleKey = errorCode === "not-enough" ? "notEnoughTitle" : "errorTitle";
    const bodyKey = errorCode === "not-enough" ? "notEnoughBody" : "errorBody";
    return (
      <div className="play-card flex flex-col items-center gap-4 p-8 text-center" data-testid="practice-error">
        <div className="flex size-12 items-center justify-center rounded-2xl border-3 border-ink bg-danger text-white">
          <X className="size-5" />
        </div>
        <h2 className="text-xl font-bold">{t(titleKey)}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t(bodyKey)}</p>
        {errorCode !== "not-enough" && (
          <Button
            data-testid="practice-retry"
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
    const insightKey = correctCount === total ? "insightPerfect" : correctCount >= Math.ceil(total / 2) ? "insightGood" : "insightKeepGoing";

    return (
      <div className="play-card p-6 sm:p-8" data-testid="practice-result">
        <Badge className="rounded-full bg-brand text-white hover:bg-brand">{t("resultBadge")}</Badge>
        <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl" data-testid="result-heading">
          {t("resultHeadline", { correct: correctCount, total })}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="result-insight">
          {t(insightKey)}
        </p>

        <div className="mt-4 flex flex-wrap gap-2" data-testid="result-pips">
          {answered.map((a, i) => (
            <span
              key={i}
              data-testid="result-pip"
              data-correct={a.correct}
              className={`flex size-8 items-center justify-center rounded-full border-2 border-ink text-xs font-bold ${
                a.correct ? "bg-success text-white" : "bg-danger text-white"
              }`}
            >
              {a.correct ? <Check className="size-4" /> : <X className="size-4" />}
            </span>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-brand-soft/50 p-4 text-sm text-foreground" data-testid="result-next-preview">
          {t("nextPreview", { label: nextLabel })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {isAuthed || claimed ? (
            <div
              className="play-tile flex items-center gap-3 p-4 text-sm font-semibold [--tile-block:var(--success)]"
              data-testid="practice-saved"
            >
              <Check className="size-5 text-success" />
              {t("savedAlready")}
            </div>
          ) : (
            <Button
              asChild
              size="lg"
              className="play-key h-14 rounded-2xl bg-brand px-7 text-base font-extrabold text-white hover:bg-brand"
            >
              <Link href={signupHref} data-testid="save-progress-cta">
                {t("saveProgressCta")}
              </Link>
            </Button>
          )}

          <Button asChild size="lg" variant="outline" className="play-press h-12 rounded-full bg-white px-6">
            <Link href={backHref}>{t("continueWithoutAccount")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentItem) {
    return null;
  }

  const showingFeedback = phase === "feedback" && lastResult;

  return (
    <div data-testid="practice-card">
      {/* Shell: progress + close only — no other chrome inside a session
          (LEARNER-LIFECYCLE.md §3.10.1). */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label={t("closeAria")}
          data-testid="practice-close"
          onClick={() => setShowClose(true)}
          className="play-press flex size-10 items-center justify-center rounded-full border-3 border-ink bg-white"
        >
          <X className="size-4" />
        </button>

        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuenow={currentIndex} aria-valuemin={0} aria-valuemax={items.length}>
          {items.map((_, i) => (
            <span
              key={i}
              data-testid="practice-pip"
              data-filled={i < answered.length}
              className={`h-2.5 flex-1 rounded-full transition-colors ${
                i < answered.length
                  ? answered[i].correct
                    ? "bg-success"
                    : "bg-danger"
                  : "bg-ink/15"
              }`}
            />
          ))}
        </div>

        <span className="text-sm font-semibold text-muted-foreground" data-testid="practice-counter">
          {t("itemCounter", { current: Math.min(visibleIndex + 1, items.length), total: items.length })}
        </span>
      </div>

      <div className="play-sticker mt-5 p-4 [--tile-block:var(--accent-sky)] sm:p-6">
        <article className="rounded-[20px] bg-brand-soft p-5 sm:rounded-[24px] sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t("promptLabel")}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="play-word" data-testid="practice-prompt">
              {currentItem.prompt.displayWord}
            </h2>
            <Badge variant="outline" className="rounded-full bg-white">
              {currentItem.prompt.partOfSpeech}
            </Badge>
          </div>

          {currentItem.prompt.pronunciationTh && (
            <p className="font-thai mt-2 text-base text-muted-foreground" lang="th">
              {currentItem.prompt.pronunciationTh}
            </p>
          )}

          <p className="mt-4 text-sm font-semibold text-foreground">{t("question")}</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("question")}>
            {currentItem.options.map((option, index) => {
              const isSelected = selected === index;
              const isCorrectOption = showingFeedback && lastResult.correctOptionIndex === index;
              const isWrongSelected = showingFeedback && isSelected && !lastResult.correct;

              return (
                <button
                  key={index}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid="practice-option"
                  data-index={index}
                  disabled={phase !== "in-progress"}
                  onClick={() => void submit(index)}
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
                  {/*
                    The number is a visual affordance for "press 2", not part of the
                    answer. Left readable it made the accessible name of the option
                    `"2 in"` — an index glued to a Thai gloss.
                  */}
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs font-bold"
                  >
                    {index + 1}
                  </span>
                  <span lang="th">{option.meaningTh}</span>
                  {isCorrectOption && <Check className="ml-auto size-5 shrink-0" />}
                  {isWrongSelected && <X className="ml-auto size-5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {showingFeedback && (
            <div
              className={`mt-4 rounded-2xl border-3 border-ink p-4 ${
                lastResult.correct ? "bg-success-soft" : "bg-warn-soft"
              }`}
              data-testid="practice-feedback"
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
                    <Volume2 className="size-4 text-ink" />
                    {t("feedbackWrong", {
                      meaning: currentItem.options[lastResult.correctOptionIndex]?.meaningTh ?? "",
                    })}
                  </>
                )}
              </p>
            </div>
          )}
        </article>
      </div>

      {/* The continue button never moves: same slot whether an item is unanswered,
          being checked, or showing feedback (LEARNER-LIFECYCLE.md §3.10.2). */}
      <div className="mt-5">
        <Button
          size="lg"
          data-testid="practice-continue"
          disabled={phase === "in-progress" || phase === "checking"}
          onClick={continueToNext}
          className="play-key h-14 w-full rounded-2xl bg-brand text-base font-extrabold text-white hover:bg-brand disabled:opacity-40"
        >
          {phase === "checking" ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              {t("checking")}
            </>
          ) : (
            t("continue")
          )}
        </Button>
      </div>

      {showClose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label={t("closeConfirmTitle")}
          data-testid="practice-close-confirm"
        >
          <div className="play-card w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold">{t("closeConfirmTitle")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("closeConfirmBody")}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild className="play-key h-12 rounded-2xl bg-brand font-extrabold text-white hover:bg-brand">
                <Link href={backHref} data-testid="close-confirm-save">
                  {t("closeConfirmSave")}
                </Link>
              </Button>
              <Button variant="ghost" onClick={() => setShowClose(false)} data-testid="close-confirm-cancel">
                {t("closeConfirmCancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
