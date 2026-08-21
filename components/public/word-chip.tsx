import { Link } from "@/i18n/navigation";
import type { LearnerMode } from "@/lib/learner-mode";
import { cn } from "@/lib/utils";

/**
 * The signature object of the public site.
 *
 * A word the visitor cannot read yet, and the one that unlocks it, in a single control.
 * Under a pointer a vermilion block wipes across and the answer is painted inside the
 * wipe; on a touch screen — where there is no pointer, and where making the meaning cost
 * a tap would hide the one thing the visitor came for — the two registers simply stack,
 * which is the layout Thai already uses. Both behaviours live in
 * `app/public-design.css`; this component only decides what goes in each register.
 *
 * **Which word is on the front depends on the course direction, not on the data.** A Thai
 * speaker learning English (`mode: "english"`, the `th` locale) is shown the English word
 * and reveals the Thai; an English speaker learning Thai (`mode: "thai"`, the `en` locale)
 * is shown the Thai and reveals the English. Same object, same interaction, opposite
 * faces — see `lib/learner-mode.ts`.
 *
 * Both strings are always in the DOM and neither is hidden from assistive technology, so
 * a screen reader reads the pairing whatever the pointer is doing, and a crawler indexes
 * both halves rather than one.
 *
 * A chip whose Thai side is missing renders as a plain word rather than as an empty
 * reveal — most of the 2,972 slugs still have no `meaningTh` (docs/SEO-CONTENT.md §1),
 * and a chip that promises a meaning and delivers a blank block is worse than one that
 * never promised.
 */
export function WordChip({
  en,
  th,
  mode,
  href,
  className,
}: {
  /** The Oxford 3000 headword. */
  en: string;
  /** Its Thai meaning, if the entry has one yet. */
  th?: string | null;
  mode: LearnerMode;
  href?: string;
  className?: string;
}) {
  const thaiFirst = mode === "thai";
  const front = thaiFirst ? th : en;
  const back = thaiFirst ? en : th;

  // With no Thai meaning there is nothing to reveal, and in `thai` mode there is nothing
  // to put on the front either — fall back to the headword so the chip is never empty.
  const frontText = front ?? en;
  const backText = front ? back : null;

  const body = (
    <>
      <span className={cn("pd-word__en", thaiFirst && "font-thai")}>
        {frontText}
      </span>

      {backText ? (
        <span className={cn("pd-word__th", !thaiFirst && "font-thai")}>
          {backText}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("pd-word", className)}>
        {body}
      </Link>
    );
  }

  return <span className={cn("pd-word", className)}>{body}</span>;
}
