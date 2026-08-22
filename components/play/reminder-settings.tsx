"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, BellRing, Check } from "lucide-react";

import { saveReminderSettings, type ReminderSettings } from "@/lib/reminders-api";
import { disablePush, enablePush, pushEnabled, pushSupported } from "@/lib/push-api";
import { track } from "@/lib/analytics";

/**
 * Reminder email, opted into from the profile.
 *
 * Off until the learner says otherwise, and never asked for at signup — the app has to be
 * worth returning to before it is allowed to ask for a way to interrupt someone's evening
 * (`docs/LEARNER-LIFECYCLE.md` §1.2: a streak is a memory aid, not a threat).
 *
 * The hour is the learner's own local hour; the server holds their timezone from
 * registration, so the picker shows hours and not offsets.
 */

/** Evening hours, when this audience studies — plus a morning option for early risers. */
const HOURS = [7, 12, 18, 19, 20, 21];

export function ReminderSettingsCard({ initial }: { initial: ReminderSettings }) {
  const t = useTranslations("Profile");

  const [optIn, setOptIn] = useState(initial.optIn);
  const [hour, setHour] = useState(initial.hour);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Push is offered as an *upgrade* to the reminder, never as the way to turn it on. The
   * permission prompt only ever fires from a click on the button below — an unprompted
   * prompt is the fastest way to be blocked for good, and a blocked browser cannot be
   * asked again.
   *
   * `null` means "we have not looked yet", which is different from "not subscribed": the
   * check is async and the button must not flicker from off to on after mount.
   */
  const [push, setPush] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /**
     * One write path, and it is asynchronous in both branches.
     *
     * `pushSupported()` answers synchronously, but a synchronous `setState` inside an
     * effect is a cascading render and the React Compiler refuses it. Resolving the
     * unsupported case through a settled promise keeps the transition exactly as
     * documented above — `null` until we have looked, then `false` — without a second way
     * for this state to change.
     */
    void (pushSupported() ? pushEnabled() : Promise.resolve(false)).then((enabled) => {
      if (!cancelled) setPush(enabled);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (next: { optIn: boolean; hour: number }) => {
    setSaving(true);
    setFailed(false);

    try {
      const result = await saveReminderSettings(next);
      setOptIn(result.optIn);
      setHour(result.hour);
      setSaved(true);
      if (next.optIn) track("reminder_opted_in", {});
    } catch {
      // Put the switch back where it was: a toggle that stays on after a failed save is a
      // promise to email someone that nothing in the system has agreed to.
      setOptIn(!next.optIn ? optIn : initial.optIn);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="reminder-settings">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{t("reminderTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("reminderBody")}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={optIn}
          disabled={saving}
          data-testid="reminder-toggle"
          onClick={() => {
            const next = !optIn;
            setOptIn(next);
            void persist({ optIn: next, hour });
          }}
          className={`play-press flex h-11 shrink-0 items-center gap-2 rounded-2xl border-3 border-ink px-4 text-sm font-bold transition-colors ${
            optIn ? "bg-success text-white" : "bg-white text-ink"
          }`}
        >
          {optIn ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          {optIn ? t("reminderOn") : t("reminderOff")}
        </button>
      </div>

      {optIn && (
        <div className="mt-5">
          <p className="text-sm font-semibold">{t("reminderHourLabel")}</p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label={t("reminderHourLabel")}
          >
            {HOURS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={hour === option}
                disabled={saving}
                data-testid={`reminder-hour-${option}`}
                onClick={() => {
                  setHour(option);
                  void persist({ optIn: true, hour: option });
                }}
                className={`play-press flex h-11 min-w-14 items-center justify-center rounded-2xl border-3 border-ink px-3 text-sm font-bold ${
                  hour === option ? "bg-brand text-white" : "bg-white text-ink"
                }`}
              >
                {t("reminderHourValue", { hour: option })}
              </button>
            ))}
          </div>
        </div>
      )}

      {optIn && pushSupported() ? (
        <div className="mt-6 border-t-2 border-dashed border-ink/15 pt-5">
          <p className="text-sm font-semibold">{t("pushTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("pushBody")}</p>

          <button
            type="button"
            role="switch"
            aria-checked={push === true}
            disabled={pushBusy || push === null}
            data-testid="push-toggle"
            onClick={async () => {
              setPushBusy(true);
              try {
                if (push) {
                  await disablePush();
                  setPush(false);
                } else {
                  // A denied permission leaves this false, and the reminder keeps arriving
                  // by email — there is nothing to apologise for.
                  setPush(await enablePush());
                }
              } finally {
                setPushBusy(false);
              }
            }}
            className={`play-press mt-4 flex h-11 items-center gap-2 rounded-2xl border-3 border-ink px-4 text-sm font-bold ${
              push ? "bg-success text-white" : "bg-white text-ink"
            }`}
          >
            <BellRing className="size-4" />
            {push ? t("pushOn") : t("pushOff")}
          </button>
        </div>
      ) : null}

      {saved && !failed && (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-success">
          <Check className="size-4" />
          {t("reminderSaved")}
        </p>
      )}

      {failed && (
        <p className="mt-4 text-sm font-semibold text-danger">{t("reminderFailed")}</p>
      )}
    </div>
  );
}
