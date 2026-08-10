"use client";

import { useState } from "react";

import { resolveBreakdown, type ThaiLetter } from "@/lib/thai-letters";

/**
 * The Thai meaning, one letter at a time, for someone learning to read the script.
 *
 * The breakdown is **derived, never authored**: `Array.from("เกี่ยวกับ")` yields exactly
 * `เ ก ี ่ ย ว ก ั บ`, so there is nothing for a curator to type and therefore nothing to
 * get wrong. The first hand-written breakdown in this project's history lost `น หนู` from
 * `วัฒนธรรม`; deriving it cannot.
 *
 * What *is* authored is the label — `roman`, curated at `/admin/letters`. It leads because
 * this component only renders for an English-reading audience, and `สระเอ` is unreadable to
 * exactly the person the breakdown was built for. The Thai name stays underneath, smaller:
 * it is what a Thai person will say if the learner asks about the mark out loud.
 *
 * A character missing from the table renders as `?` rather than disappearing, which is how
 * a defect in `meaningTh` — the corpus really contains `"ล ะ ท ิ ้ ง"` with spaces wedged
 * in — stays visible instead of silently shortening the word.
 */
export function ThaiLetterBreakdown({
  value,
  letters,
  override,
  title,
  hint,
}: {
  value: string;
  letters: ThaiLetter[];
  /** The curator's correction for this word, from `VocabWord.letterBreakdown`. */
  override: string;
  title: string;
  hint: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const parts = resolveBreakdown(value, letters, override);

  if (parts.length === 0) return null;

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="mt-4 rounded-2xl bg-accent-mint/15 p-5" data-testid="thai-letters">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {parts.map((part, index) => (
          <button
            key={`${part.char}-${index}`}
            type="button"
            data-testid="thai-letter"
            data-char={part.char}
            disabled={!part.known}
            aria-pressed={active === index}
            // The romanised name is the accessible name too: a screen reader in an English
            // context announcing "สระเอ" is the same problem as showing it.
            aria-label={part.known ? part.letter.roman : part.char}
            title={part.known ? part.letter.name : undefined}
            onClick={() => {
              if (!part.known) return;
              setActive(index);
              speak(part.letter.name);
            }}
            className={`flex min-h-16 min-w-14 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-ink px-2 py-2 transition-colors hover:bg-accent-sun disabled:cursor-not-allowed disabled:opacity-50 ${
              active === index ? "bg-accent-sun" : "bg-white"
            }`}
          >
            <span className="font-thai text-lg leading-none" lang="th">
              {part.char}
            </span>

            <span
              data-testid="thai-letter-roman"
              className="mt-1.5 text-[11px] font-medium leading-none text-ink"
            >
              {part.known ? part.letter.roman : "?"}
            </span>

            {part.known && (
              <span
                className="font-thai mt-1 text-[9px] leading-none text-muted-foreground"
                lang="th"
              >
                {part.letter.name}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
