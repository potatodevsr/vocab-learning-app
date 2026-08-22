"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Crown, Lock } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { API_URL } from "@/constants/config";
import type { components } from "@/lib/api-types";

/**
 * Crowns and locks on a public, cached level page.
 *
 * The page itself is the same HTML for everybody (`revalidate = 3600`) — that is what makes
 * ~6,000 URLs cacheable at the edge instead of a Worker invocation each. Per-learner state
 * therefore arrives here, client-side, after the page has rendered: an anonymous visitor
 * sees exactly the page a crawler sees, and a signed-in learner sees their own path drawn
 * on top of it.
 *
 * Failure is silence. This is decoration over content that already works; a learner whose
 * progress read blips still has a level page full of words.
 */

type UnitProgress = components["schemas"]["UnitProgress"];

export function UnitProgressBadges({ level }: { level: string }) {
  const t = useTranslations("Level");
  const [progress, setProgress] = useState<UnitProgress | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/progress/units?level=${level}`, {
          credentials: "include",
        });
        // 401 is the normal case here: most visitors are not signed in.
        if (!res.ok) return;

        const body = (await res.json()) as UnitProgress;
        if (!cancelled) setProgress(body);
      } catch {
        // See above.
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [level]);

  if (!progress) return null;

  const locked = progress.units.filter((unit) => !unit.unlocked).map((unit) => unit.unit);
  const crowned = progress.units.filter((unit) => unit.crown).map((unit) => unit.unit);

  return (
    <div className="mt-4" data-testid="unit-progress">
      <p className="flex flex-wrap items-center gap-3 text-sm font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full border-3 border-ink bg-accent-sun px-3 py-1 text-ink">
          <Crown className="size-4" aria-hidden />
          {t("crownCount", { count: progress.crowns })}
        </span>

        <Link
          href={`/learn?level=${progress.level}&unit=${progress.nextUnit}`}
          className="underline decoration-2 underline-offset-4 hover:decoration-4"
          data-testid="unit-progress-continue"
        >
          {t("continueAtUnit", { unit: progress.nextUnit })}
        </Link>
      </p>

      {/*
        Stated rather than drawn as a disabled control: the unit pages themselves stay
        public and linkable — the whole corpus is browsable without an account, and a lock
        icon on a page a crawler can read would be theatre. What the lock describes is
        where the *app* will send you next.
      */}
      {locked.length > 0 ? (
        <p
          className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"
          data-testid="unit-progress-locked"
        >
          <Lock className="size-4" aria-hidden />
          {t("lockedNote", { first: locked[0] })}
        </p>
      ) : null}

      {crowned.length > 0 ? (
        <p className="sr-only" data-testid="unit-progress-crowned">
          {crowned.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
