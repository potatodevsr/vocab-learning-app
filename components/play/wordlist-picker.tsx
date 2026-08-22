"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";

import { setCurrentWordlist, type Wordlist } from "@/lib/wordlists-api";

/**
 * Which list the learner is studying.
 *
 * Rendered only when there is more than one published list — the parent decides, and this
 * component is never mounted for a single-list catalogue. A picker with one option is not a
 * choice; it is a control that teaches the learner their settings do nothing.
 *
 * Switching keeps every word already learned: progress is stored per word, not per list
 * (`backend/src/wordlists.ts`), so this changes what the *next* session draws from and
 * nothing else. The copy says so, because a learner who suspects otherwise will not touch it.
 */
export function WordlistPicker({
  lists,
  current,
}: {
  lists: Wordlist[];
  current: string;
}) {
  const t = useTranslations("Profile");
  const locale = useLocale();

  const [selected, setSelected] = useState(current);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const choose = async (id: string) => {
    if (id === selected || busy) return;

    const previous = selected;
    setSelected(id);
    setBusy(true);
    setFailed(false);

    try {
      setSelected(await setCurrentWordlist(id));
    } catch {
      // Back to where it was: a picker that shows a list the server did not accept is a
      // learner studying something other than what they think they are.
      setSelected(previous);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    /*
      No `data-testid` on this wrapper, deliberately.

      The parent mounts this only when `wordlists.length > 1`, and the e2e fixture
      publishes one list, so nothing in the suite can reach it — a testid here asserts
      coverage that cannot exist, which is why `docs/TEST-COVERAGE.md` records the same
      resolution for the error boundaries. Restore it together with a second published
      list in `backend/scripts/generate-e2e-seed.mjs`; `wordlist-option-*` below is
      already keyed per list and needs nothing.
    */
    <div>
      <h3 className="text-lg font-semibold">{t("wordlistTitle")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("wordlistBody")}</p>

      <div className="mt-4 grid gap-3" role="radiogroup" aria-label={t("wordlistTitle")}>
        {lists.map((list) => {
          const title = locale === "th" && list.titleTh ? list.titleTh : list.title;
          const description =
            locale === "th" && list.descriptionTh ? list.descriptionTh : list.description;

          return (
            <button
              key={list.id}
              type="button"
              role="radio"
              aria-checked={selected === list.id}
              disabled={busy}
              data-testid={`wordlist-option-${list.id}`}
              onClick={() => void choose(list.id)}
              className={`play-press flex items-start justify-between gap-4 rounded-2xl border-3 border-ink p-4 text-left ${
                selected === list.id ? "bg-brand text-white" : "bg-white text-ink"
              }`}
            >
              <span>
                <span className="block font-bold">{title}</span>
                {description ? (
                  <span className="mt-1 block text-sm opacity-90">{description}</span>
                ) : null}
                <span className="mt-1 block text-sm opacity-80">
                  {t("wordlistCount", { count: list.wordCount })}
                </span>
              </span>

              {selected === list.id ? <Check className="mt-1 size-5 shrink-0" /> : null}
              {busy && selected === list.id ? (
                <Loader2 className="mt-1 size-5 shrink-0 animate-spin" />
              ) : null}
            </button>
          );
        })}
      </div>

      {failed ? (
        <p className="mt-4 text-sm font-semibold text-danger">{t("wordlistFailed")}</p>
      ) : null}
    </div>
  );
}
