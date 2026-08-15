"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, LockKeyhole, Trophy, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  answerCheckpoint,
  getCheckpointStatus,
  startCheckpoint,
  CheckpointApiError,
  type CheckpointItem,
} from "@/lib/checkpoint-api";
import { track } from "@/lib/analytics";
import type { CefrLevel } from "@/lib/types";

/**
 * The immersive end-of-unit checkpoint (`docs/LEARNER-LIFECYCLE.md` §3.8, §8 L3,
 * `backend/src/checkpoint.ts`). A fixed five-item graded gate over words the learner has
 * already met in the unit. Same server-authoritative shape and same interaction rules
 * (§3.10) as the mixed session — no navigation chrome, a continue button that never
 * moves, colour is never the only signal, keyboard 1-4/Enter/Esc — because a learner who
 * has done both must not notice a seam.
 *
 * What is checkpoint-specific:
 * - **Readiness** (§3.8, "a lock must never be a dead end"): fewer than five met words in
 *   the unit answers 422 with `recoveryCount`, which becomes a "practise a little more"
 *   screen with a route back to the unit lesson — never a raw error.
 * - **Refresh / resume**: the open checkpoint id is remembered per scope; on mount the
 *   status is re-read so a reload lands on the exact item the learner left off at, or on
 *   the settled result if it was already finished.
 * - **Authoritative ordered answers**: items are answered strictly in order and graded
 *   server-side; the client never sees a correct-option index or a spelling target, so it
 *   cannot reveal an answer it was never told.
 * - **Failed vs passed result**: a fail is a focused recovery round (back to practice), a
 *   pass is a celebration. Neither removes prior progress — the gate never writes mastery.
 */

/** `unknown` = answered on a previous mount (resumed): the server tracks it, but its
 *  per-item correctness is not re-transmitted, so its pip renders answered-but-neutral. */
type AnsweredItem = { correct: boolean } | { unknown: true };

type CheckpointOutcome = {
  correctCount: number;
  total: number;
  passed: boolean;
  recoveryCount: number;
};

type Phase =
  | "loading"
  | "in-progress"
  | "checking"
  | "feedback"
  | "result"
  | "not-ready"
  | "unauth"
  | "error";

type CheckpointScope = {
  level: CefrLevel;
  unit: number;
};

type CheckpointSessionProps = {
  scope: CheckpointScope;
  /** Back to the unit page; also the "practise more" target for the not-ready/recovery states. */
  unitHref: string;
  /** The unit's public trial, where a not-ready learner goes to meet more words. */
  practiceHref: string;
};

const storageKey = (level: string, unit: number) => `va_checkpoint_${level}_${unit}`;

const readStoredId = (level: string, unit: number): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(storageKey(level, unit));
  } catch {
    return null;
  }
};

const writeStoredId = (level: string, unit: number, id: string) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(level, unit), id);
  } catch {
    // best-effort — the server remains the source of truth either way.
  }
};

const clearStoredId = (level: string, unit: number) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(level, unit));
  } catch {
    // best-effort
  }
};

export function CheckpointSession({ scope, unitHref, practiceHref }: CheckpointSessionProps) {
  const t = useTranslations("Checkpoint");
  const [phase, setPhase] = useState<Phase>("loading");
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [items, setItems] = useState<CheckpointItem[]>([]);
  const [answered, setAnswered] = useState<AnsweredItem[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [typedSpelling, setTypedSpelling] = useState("");
  const [lastResult, setLastResult] = useState<{ correct: boolean; correctSpelling?: string } | null>(null);
  const [outcome, setOutcome] = useState<CheckpointOutcome | null>(null);
  const [recoveryCount, setRecoveryCount] = useState(0);
  const [showClose, setShowClose] = useState(false);

  const completedTrackedRef = useRef(false);
  const currentIndex = answered.length;
  const visibleIndex = phase === "feedback" ? Math.max(currentIndex - 1, 0) : currentIndex;
  const currentItem = items[visibleIndex];

  // Records the settled outcome, but does NOT move to the result screen — that transition
  // waits for the learner to press Continue past the last item's feedback, so the final
  // answer gets the same feedback beat as every other one and the continue button never
  // jumps (§3.10.2). Analytics is fired by the live-answer path, not here, so a settled
  // result re-read on refresh does not re-count a completion.
  const finish = useCallback((result: CheckpointOutcome) => {
    setOutcome(result);
  }, []);

  const boot = useCallback(async () => {
    setPhase("loading");

    // Refresh/resume: if this tab already opened a checkpoint for the unit, re-read its
    // status first so a reload lands on the left-off item — or on the settled result if
    // it was already finished — rather than silently minting a competing one.
    const storedId = readStoredId(scope.level, scope.unit);
    if (storedId) {
      try {
        const status = await getCheckpointStatus(storedId);
        setCheckpointId(status.checkpointId);
        setItems(status.items);
        setRecoveryCount(status.recoveryCount);
        if (status.done) {
          setAnswered(
            Array.from({ length: status.answeredCount }, () => ({ unknown: true }) as AnsweredItem),
          );
          finish({
            correctCount: status.correctCount,
            total: status.itemCount,
            passed: status.passed,
            recoveryCount: status.recoveryCount,
          });
          // A finished checkpoint re-opened on refresh goes straight to its settled result.
          setPhase("result");
        } else {
          setAnswered(
            Array.from({ length: status.answeredCount }, () => ({ unknown: true }) as AnsweredItem),
          );
          setPhase("in-progress");
        }
        return;
      } catch (err) {
        // A stale/expired id (404) is not an error the learner should see — drop it and
        // fall through to starting a fresh checkpoint.
        if (err instanceof CheckpointApiError && err.status === 401) {
          setPhase("unauth");
          return;
        }
        clearStoredId(scope.level, scope.unit);
      }
    }

    try {
      const result = await startCheckpoint({ level: scope.level, unit: scope.unit });
      writeStoredId(scope.level, scope.unit, result.checkpointId);
      setCheckpointId(result.checkpointId);
      setItems(result.items);
      setAnswered(
        Array.from({ length: result.answeredCount }, () => ({ unknown: true }) as AnsweredItem),
      );
      setPhase("in-progress");
    } catch (err) {
      if (err instanceof CheckpointApiError && err.status === 401) {
        setPhase("unauth");
        return;
      }
      if (err instanceof CheckpointApiError && err.status === 422) {
        setRecoveryCount(err.recoveryCount ?? 0);
        setPhase("not-ready");
        return;
      }
      setPhase("error");
    }
  }, [scope.level, scope.unit, finish]);

  useEffect(() => {
    const timer = window.setTimeout(() => void boot(), 0);
    return () => window.clearTimeout(timer);
  }, [boot]);

  const applyAnswer = useCallback(
    (
      result: {
        correct: boolean;
        done: boolean;
        correctSpelling?: string;
        correctCount?: number;
        total?: number;
        passed?: boolean;
        recoveryCount?: number;
      },
    ) => {
      const entry: AnsweredItem = { correct: result.correct };
      setAnswered((prev) => [...prev, entry]);
      setLastResult({ correct: result.correct, correctSpelling: result.correctSpelling });
      setPhase("feedback");
      if (result.done) {
        const passed = result.passed ?? false;
        finish({
          correctCount: result.correctCount ?? 0,
          total: result.total ?? items.length,
          passed,
          recoveryCount: result.recoveryCount ?? 0,
        });
        // `unit_completed` is the taxonomy's only checkpoint-relevant event
        // (`docs/LEARNER-LIFECYCLE.md` §7.1). Fire it once per completion, from the live
        // answer that decided the gate, and only on a genuine pass — a failed gate did
        // not complete the unit, and a result re-read on refresh is not a new completion.
        if (passed && !completedTrackedRef.current) {
          completedTrackedRef.current = true;
          track("unit_completed", { level: scope.level, unit: scope.unit });
        }
      }
    },
    [finish, items.length, scope.level, scope.unit],
  );

  const submitSelection = useCallback(
    async (optionIndex: number) => {
      if (phase !== "in-progress" || !checkpointId || !currentItem) return;
      setSelected(optionIndex);
      setPhase("checking");
      try {
        const result = await answerCheckpoint({
          checkpointId,
          itemIndex: currentIndex,
          selectedOptionIndex: optionIndex,
        });
        applyAnswer(result);
      } catch {
        // No authoritative verdict reached us — leave the item unanswered and let the
        // learner retry rather than pretend a grade happened.
        setPhase("error");
      }
    },
    [phase, checkpointId, currentItem, currentIndex, applyAnswer],
  );

  const submitSpelling = useCallback(async () => {
    if (phase !== "in-progress" || !checkpointId || !currentItem) return;
    setPhase("checking");
    try {
      const result = await answerCheckpoint({
        checkpointId,
        itemIndex: currentIndex,
        spelling: typedSpelling,
      });
      applyAnswer(result);
    } catch {
      setPhase("error");
    }
  }, [phase, checkpointId, currentItem, currentIndex, typedSpelling, applyAnswer]);

  const continueToNext = useCallback(() => {
    setSelected(null);
    setTypedSpelling("");
    setLastResult(null);
    // Once every item is answered, the next Continue reveals the settled result (`outcome`
    // is already populated by `finish`); otherwise advance to the next item.
    setPhase(currentIndex >= items.length ? "result" : "in-progress");
  }, [currentIndex, items.length]);

  // Keyboard: 1-4 select, Enter checks/continues, Esc opens the close confirmation.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (showClose) {
        if (event.key === "Escape") setShowClose(false);
        return;
      }
      if (event.key === "Escape" && (phase === "in-progress" || phase === "feedback" || phase === "checking")) {
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

  // ---------------------------------------------------------------- render branches

  if (phase === "loading") {
    return (
      <div className="play-card flex flex-col items-center gap-3 p-10 text-center" data-testid="checkpoint-loading">
        <Loader2 className="size-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground">{t("preparing")}</p>
      </div>
    );
  }

  if (phase === "unauth") {
    return (
      <div className="play-card flex flex-col items-center gap-4 p-8 text-center" data-testid="checkpoint-unauth">
        <div className="flex size-12 items-center justify-center rounded-2xl border-3 border-ink bg-brand text-white">
          <LockKeyhole className="size-5" />
        </div>
        <h2 className="text-xl font-bold">{t("unauthTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("unauthBody")}</p>
        <Button
          asChild
          className="play-key h-12 rounded-2xl bg-brand px-6 font-extrabold text-white hover:bg-brand"
        >
          <Link href={`/auth/login?from=${encodeURIComponent(unitHref)}`} data-testid="checkpoint-signin">
            {t("signIn")}
          </Link>
        </Button>
      </div>
    );
  }

  if (phase === "not-ready") {
    return (
      <div className="play-card flex flex-col items-center gap-4 p-8 text-center" data-testid="checkpoint-not-ready">
        <div className="flex size-12 items-center justify-center rounded-2xl border-3 border-ink bg-warn text-ink">
          <AlertTriangle className="size-5" />
        </div>
        <h2 className="text-xl font-bold">{t("notReadyTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground" data-testid="checkpoint-not-ready-body">
          {recoveryCount > 0 ? t("notReadyBody", { count: recoveryCount }) : t("notReadyBodyGeneric")}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            asChild
            className="play-key h-12 rounded-2xl bg-brand px-6 font-extrabold text-white hover:bg-brand"
          >
            <Link href={practiceHref} data-testid="checkpoint-practice-cta">
              {t("practiseMore")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="play-press h-12 rounded-full bg-white px-6">
            <Link href={unitHref}>{t("backToUnit")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="play-card flex flex-col items-center gap-4 p-8 text-center" data-testid="checkpoint-error">
        <div className="flex size-12 items-center justify-center rounded-2xl border-3 border-ink bg-danger text-white">
          <X className="size-5" />
        </div>
        <h2 className="text-xl font-bold">{t("errorTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("errorBody")}</p>
        <Button
          data-testid="checkpoint-retry"
          className="play-key h-12 rounded-2xl bg-brand px-6 font-extrabold text-white hover:bg-brand"
          onClick={() => void boot()}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (phase === "result" && outcome) {
    const passed = outcome.passed;
    return (
      <div className="play-card p-6 sm:p-8" data-testid="checkpoint-result" data-passed={passed}>
        <div
          className={`flex size-14 items-center justify-center rounded-2xl border-3 border-ink ${
            passed ? "bg-success text-white" : "bg-warn text-ink"
          }`}
        >
          {passed ? <Trophy className="size-6" /> : <AlertTriangle className="size-6" />}
        </div>
        <Badge
          className={`mt-4 rounded-full ${passed ? "bg-success text-white hover:bg-success" : "bg-warn text-ink hover:bg-warn"}`}
        >
          {passed ? t("passedBadge") : t("failedBadge")}
        </Badge>
        <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl" data-testid="checkpoint-result-heading">
          {passed ? t("passedHeadline") : t("failedHeadline")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {passed
            ? t("passedBody", { correct: outcome.correctCount, total: outcome.total })
            : outcome.recoveryCount > 0
              ? t("failedBody", { count: outcome.recoveryCount })
              : t("failedBodyScore", { correct: outcome.correctCount, total: outcome.total })}
        </p>

        <div className="mt-4 flex flex-wrap gap-2" data-testid="checkpoint-result-pips">
          {answered.map((a, i) => {
            const known = "correct" in a;
            return (
              <span
                key={i}
                data-testid="checkpoint-result-pip"
                data-correct={known ? a.correct : undefined}
                className={`flex size-8 items-center justify-center rounded-full border-2 border-ink text-xs font-bold ${
                  known ? (a.correct ? "bg-success text-white" : "bg-danger text-white") : "bg-ink/40 text-white"
                }`}
              >
                {known ? a.correct ? <Check className="size-4" /> : <X className="size-4" /> : i + 1}
              </span>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {passed ? (
            <Button
              asChild
              size="lg"
              className="play-key h-14 rounded-2xl bg-brand px-7 text-base font-extrabold text-white hover:bg-brand"
            >
              <Link href={unitHref} data-testid="checkpoint-result-continue">
                {t("backToUnit")}
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                size="lg"
                className="play-key h-14 rounded-2xl bg-brand px-7 text-base font-extrabold text-white hover:bg-brand"
              >
                <Link href={practiceHref} data-testid="checkpoint-recovery-cta">
                  {t("recoveryCta")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="play-press h-12 rounded-full bg-white px-6">
                <Link href={unitHref}>{t("backToUnit")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!currentItem) return null;

  const showingFeedback = phase === "feedback" && lastResult;
  const isSpelling = currentItem.type === "spelling";
  const promptText = currentItem.prompt.displayWord ?? currentItem.prompt.meaningTh ?? "";

  return (
    <div data-testid="checkpoint-card" data-item-type={currentItem.type}>
      {/* Shell: progress + close only — no other chrome inside a gate
          (LEARNER-LIFECYCLE.md §3.10.1). */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label={t("closeAria")}
          data-testid="checkpoint-close"
          onClick={() => setShowClose(true)}
          className="play-press flex size-10 items-center justify-center rounded-full border-3 border-ink bg-white"
        >
          <X className="size-4" />
        </button>

        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-valuenow={currentIndex}
          aria-valuemin={0}
          aria-valuemax={items.length}
        >
          {items.map((_, i) => {
            const entry = answered[i];
            const filled = i < answered.length;
            const known = entry && "correct" in entry;
            return (
              <span
                key={i}
                data-testid="checkpoint-pip"
                data-filled={filled}
                className={`h-2.5 flex-1 rounded-full transition-colors ${
                  filled
                    ? known
                      ? entry.correct
                        ? "bg-success"
                        : "bg-danger"
                      : "bg-ink/40"
                    : "bg-ink/15"
                }`}
              />
            );
          })}
        </div>

        <span className="text-sm font-semibold text-muted-foreground" data-testid="checkpoint-counter">
          {t("itemCounter", { current: Math.min(visibleIndex + 1, items.length), total: items.length })}
        </span>
      </div>

      <div className="play-sticker mt-5 p-4 [--tile-block:var(--accent-grape)] sm:p-6">
        <article className="rounded-[20px] bg-brand-soft p-5 sm:rounded-[24px] sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t("promptLabel")}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="play-word" data-testid="checkpoint-prompt">
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
              <label htmlFor="checkpoint-spelling-input" className="text-sm font-semibold text-foreground">
                {t("spellingQuestion")}
              </label>
              <input
                id="checkpoint-spelling-input"
                data-testid="checkpoint-spelling-input"
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
              <p className="mt-4 text-sm font-semibold text-foreground">{t("question")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("question")}>
                {currentItem.options?.map((option, index) => {
                  const isSelected = selected === index;
                  const label = option.meaningTh ?? option.displayWord ?? "";
                  return (
                    <button
                      key={index}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      data-testid="checkpoint-option"
                      data-index={index}
                      disabled={phase !== "in-progress"}
                      onClick={() => void submitSelection(index)}
                      className={[
                        "play-press flex min-h-14 items-center gap-3 rounded-2xl border-3 border-ink px-4 py-3 text-left text-base font-semibold font-thai transition-colors disabled:cursor-not-allowed",
                        isSelected ? "bg-accent-sun text-ink" : "bg-white text-ink hover:bg-brand-soft",
                      ].join(" ")}
                    >
                      {/* Decorative index — see practice-session.tsx. */}
                      <span
                        aria-hidden
                        className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs font-bold"
                      >
                        {index + 1}
                      </span>
                      <span lang="th">{label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Feedback appears in a reserved, fixed-height slot so the continue button
              below never shifts (LEARNER-LIFECYCLE.md §3.10.2). A gate never reveals the
              correct choice for a recognition item — only whether the answer was right —
              so a wrong choice gets an honest, non-spoon-feeding message. */}
          <div className="mt-4 h-[92px]">
            {showingFeedback && (
              <div
                className={`rounded-2xl border-3 border-ink p-4 ${lastResult.correct ? "bg-success-soft" : "bg-warn-soft"}`}
                data-testid="checkpoint-feedback"
                data-correct={lastResult.correct}
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
                        : t("feedbackWrong")}
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
          data-testid="checkpoint-continue"
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

      {showClose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label={t("closeConfirmTitle")}
          data-testid="checkpoint-close-confirm"
        >
          <div className="play-card w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold">{t("closeConfirmTitle")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("closeConfirmBody")}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild className="play-key h-12 rounded-2xl bg-brand font-extrabold text-white hover:bg-brand">
                <Link href={unitHref} data-testid="checkpoint-close-confirm-save">
                  {t("closeConfirmSave")}
                </Link>
              </Button>
              <Button variant="ghost" onClick={() => setShowClose(false)} data-testid="checkpoint-close-confirm-cancel">
                {t("closeConfirmCancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
