"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Flag } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getMe } from "@/lib/user-api";

/**
 * The unit-page entry point into the end-of-unit checkpoint
 * (`docs/LEARNER-LIFECYCLE.md` §3.8). The unit page itself is a public SEO surface whose
 * first action for a *visitor* is the anonymous trial — a "take the graded checkpoint" CTA
 * only makes sense once there is an account with progress to gate. So this renders nothing
 * during SSR and for logged-out visitors (keeping the static page static and the visitor's
 * next action singular), and hydrates the checkpoint CTA only for a signed-in learner.
 *
 * Readiness is *not* decided here — that would mean minting a checkpoint just to draw a
 * button. The checkpoint screen owns the not-ready path (§3.8, "a lock must never be a
 * dead end"): a learner who has not met five words yet gets a "practise a little more"
 * screen, not a raw error.
 */
export function UnitCheckpointEntry({
  level,
  unit,
}: {
  level: string;
  unit: number;
}) {
  const t = useTranslations("Checkpoint");
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMe().then((me) => {
      if (!cancelled) setAuthed(me !== null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!authed) return null;

  const checkpointHref = `/english/${level.toLowerCase()}/unit/${unit}/checkpoint`;

  return (
    <div
      className="play-tile mt-8 flex flex-col gap-4 p-5 [--tile-block:var(--accent-grape)] sm:flex-row sm:items-center sm:justify-between"
      data-testid="unit-checkpoint-entry"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-3 border-ink bg-accent-grape text-white">
          <Flag className="size-5" />
        </span>
        <div>
          <p className="font-extrabold">{t("entryTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("entryBody")}</p>
        </div>
      </div>
      <Button
        asChild
        className="play-key h-12 shrink-0 rounded-2xl bg-brand px-6 font-extrabold text-white hover:bg-brand"
      >
        <Link href={checkpointHref} data-testid="unit-checkpoint-cta">
          {t("entryCta")}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
