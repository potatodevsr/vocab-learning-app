"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2 } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { track } from "@/lib/analytics";
import {
  scorePlacement,
  startPlacement,
  type PlacementItem,
  type PlacementResult,
} from "@/lib/placement-api";
import type { CefrLevel } from "@/lib/types";

/**
 * The public placement test — twelve questions, no account, no wall.
 *
 * It exists to answer the one question a landing page cannot: *where do I start*. The
 * result is a recommendation, not a verdict, and it always ends somewhere the visitor can
 * go without signing up — the level's own public page. Signing up is offered next to that,
 * never in front of it.
 *
 * The client holds the answers and the server holds the key (`backend/src/placement.ts`),
 * so nothing on this page knows which option is right until it submits.
 */
export function PlacementTest({
  locale,
  level,
}: {
  locale: string;
  /** Set on `/english/test/[level]`: the sitting asks about that level only. */
  level?: string;
}) {
  const t = useTranslations("Placement");

  const [items, setItems] = useState<PlacementItem[] | null>(null);
  const [token, setToken] = useState("");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const begin = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      const started = await startPlacement(level);
      setItems(started.items);
      setToken(started.token);
      setAnswers(new Array(started.items.length).fill(null));
      setIndex(0);
      track("placement_started", { locale: locale === "th" ? "th" : "en" });
    } catch {
      setError(t("startFailed"));
    } finally {
      setBusy(false);
    }
  }, [level, locale, t]);

  const answer = useCallback(
    async (option: number) => {
      if (!items || busy) return;

      const next = [...answers];
      next[index] = option;
      setAnswers(next);

      if (index < items.length - 1) {
        setIndex(index + 1);
        return;
      }

      setBusy(true);
      try {
        const scored = await scorePlacement(token, next);
        setResult(scored);
        track("placement_completed", {
          locale: locale === "th" ? "th" : "en",
          level: scored.recommendedLevel as CefrLevel,
        });
      } catch {
        setError(t("scoreFailed"));
      } finally {
        setBusy(false);
      }
    },
    [answers, busy, index, items, locale, t, token],
  );

  if (result) {
    const level = result.recommendedLevel.toLowerCase();

    return (
      <div className="play-sticker p-6 sm:p-8" data-testid="placement-result">
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {t("resultEyebrow")}
        </p>
        <h2 className="play-display mt-2" data-testid="placement-level">
          {result.recommendedLevel}
        </h2>
        <p className="mt-3 text-lg">
          {t("resultScore", { correct: result.correctCount, total: result.itemCount })}
        </p>

        <ul className="mt-5 flex flex-wrap gap-2">
          {result.levels.map((row) => (
            <li key={row.level}>
              <Badge variant="outline" className="rounded-full bg-white text-sm">
                {t("resultLevelRow", {
                  level: row.level,
                  correct: row.correct,
                  total: row.total,
                })}
              </Badge>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          {/* The free door first: the recommended level is a public page. */}
          <Button
            asChild
            className="play-key h-14 rounded-2xl bg-brand px-7 text-base font-extrabold text-white hover:bg-brand"
          >
            <Link href={`/english/${level}`} data-testid="placement-start-level">
              {t("resultCta", { level: result.recommendedLevel })}
              <ArrowRight className="size-4" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-14 rounded-2xl border-3 border-ink px-7 text-base font-bold"
          >
            <Link href="/auth/register">{t("resultSaveCta")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="play-sticker p-6 sm:p-8" data-testid="placement-intro">
        <p className="text-lg">{t("introBody")}</p>
        <Button
          onClick={begin}
          disabled={busy}
          data-testid="placement-begin"
          className="play-key mt-6 h-14 rounded-2xl bg-brand px-7 text-base font-extrabold text-white hover:bg-brand"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : t("beginCta")}
        </Button>
        {error ? <p className="mt-4 font-semibold text-danger">{error}</p> : null}
      </div>
    );
  }

  const item = items[index];

  return (
    <div className="play-sticker p-6 sm:p-8" data-testid="placement-question">
      <div className="flex items-center justify-between gap-4">
        <Badge variant="outline" className="rounded-full bg-white" data-testid="placement-item-level">
          {item.level}
        </Badge>
        <span className="text-sm font-semibold text-muted-foreground">
          {t("counter", { current: index + 1, total: items.length })}
        </span>
      </div>

      <h2 className="play-word mt-4" lang="en" data-testid="placement-prompt">
        {item.prompt.displayWord}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{item.prompt.partOfSpeech}</p>

      <div
        className="mt-6 grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label={t("question")}
      >
        {item.options.map((option, optionIndex) => (
          <button
            key={optionIndex}
            type="button"
            role="radio"
            aria-checked={answers[index] === optionIndex}
            disabled={busy}
            data-testid="placement-option"
            onClick={() => void answer(optionIndex)}
            className="play-press font-thai flex min-h-14 items-center rounded-2xl border-3 border-ink bg-white px-4 py-3 text-left text-base font-semibold text-ink hover:bg-brand-soft disabled:cursor-not-allowed"
            lang="th"
          >
            {option.meaningTh}
          </button>
        ))}
      </div>

      {/* No feedback between questions on purpose: a placement test measures, and telling
          the learner they were wrong four times in a row measures their mood instead. */}
      {error ? <p className="mt-4 font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
