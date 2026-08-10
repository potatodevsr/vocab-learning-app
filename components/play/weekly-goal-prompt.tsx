"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { setWeeklyGoal } from "@/lib/session-api";

/**
 * Asked only after the second completed session, never before the first — a goal chosen
 * before the learner knows what a session costs them is a guess they will resent
 * (`docs/LEARNER-LIFECYCLE.md` §3.4). Defaults the picker to 5 of 7 (SPEC.md §5.4.3). The
 * server independently enforces the two-session gate (`POST /progress/goal`), so this
 * component only decides *when to render*, not whether the write is allowed.
 */
export function WeeklyGoalPrompt() {
  const t = useTranslations("Today");
  const [days, setDays] = useState(5);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (saved) return null;

  return (
    <div className="play-card p-5" data-testid="weekly-goal-prompt">
      <p className="font-semibold">{t("weeklyGoalPrompt")}</p>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label={t("weeklyGoalPromptCta")}>
        {[3, 4, 5, 6, 7].map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={days === option}
            data-testid={`weekly-goal-option-${option}`}
            onClick={() => setDays(option)}
            className={`play-press flex size-11 items-center justify-center rounded-2xl border-3 border-ink text-sm font-bold ${
              days === option ? "bg-brand text-white" : "bg-white text-ink"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <Button
        data-testid="weekly-goal-save"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await setWeeklyGoal(days);
            setSaved(true);
          } finally {
            setSaving(false);
          }
        }}
        className="play-key mt-4 h-12 rounded-2xl bg-brand px-6 font-extrabold text-white hover:bg-brand"
      >
        {t("weeklyGoalPromptCta")}
      </Button>
    </div>
  );
}
