import { cn } from "@/lib/utils";

/**
 * How many pips are drawn. The SRS ladder now runs to 8 (`backend/src/mastery.ts`) so a
 * word can keep stretching its interval past "mastered"; the meter still tops out at the
 * mastered rung, because five filled pips and a claim of "mastered" is the thing the
 * learner was told the pips mean.
 */
export const MASTERY_MAX = 5;

export type MasteryLevel = "new" | "learning" | "strong" | "mastered";

/**
 * Four named bands so colour, label and icon can all agree (SPEC §6.1).
 *
 * `strong` is **not** derived here any more. It used to be `mastery >= 3` while the API
 * counted the collection at `mastery >= 2`, so the same word could be strong in the meter
 * at the top of the screen and merely "learning" in the pips below it — and neither number
 * was the product's actual promise, which is a recall on two different days
 * (docs/LEARNER-LIFECYCLE.md §2.1). The server decides and sends `strong`; this renders it.
 */
export const masteryLevel = (mastery: number, strong: boolean): MasteryLevel => {
  if (mastery >= MASTERY_MAX) return "mastered";
  if (strong) return "strong";
  if (mastery >= 1) return "learning";
  return "new";
};

const FILL: Record<MasteryLevel, string> = {
  new: "bg-muted",
  learning: "bg-warn",
  strong: "bg-accent-sky",
  mastered: "bg-success",
};

/**
 * Progress the learner can see move *during* a session, not only at the end.
 * Colour is never the only signal — the group carries a text label for
 * screen readers and for colour-blind learners.
 */
export function MasteryPips({
  mastery,
  strong,
  label,
  className,
}: {
  mastery: number;
  /** The server's verdict (`backend/src/mastery.ts`), never re-derived here. */
  strong: boolean;
  label: string;
  className?: string;
}) {
  const filled = Math.min(Math.max(mastery, 0), MASTERY_MAX);
  const level = masteryLevel(filled, strong);

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      data-testid="mastery-pips"
      data-level={level}
      data-mastery={filled}
      data-strong={strong}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: MASTERY_MAX }, (_, index) => (
        <span
          key={index}
          data-testid="mastery-pip"
          data-filled={index < filled}
          className={cn(
            // An empty pip has to read as an empty *slot*: `bg-muted` alone was very
            // nearly the card behind it, so a word at mastery 0 showed no pips at all
            // and the meter looked broken rather than empty.
            "h-2 w-5 rounded-full border-2 border-ink/25 transition-colors duration-150",
            index < filled ? `${FILL[level]} border-ink/40` : "bg-ink/5",
          )}
        />
      ))}
    </div>
  );
}
