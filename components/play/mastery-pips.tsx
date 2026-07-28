import { cn } from "@/lib/utils";

export const MASTERY_MAX = 5;

export type MasteryLevel = "new" | "learning" | "strong" | "mastered";

/** Four named bands so colour, label and icon can all agree (SPEC §6.1). */
export const masteryLevel = (mastery: number): MasteryLevel => {
  if (mastery >= MASTERY_MAX) return "mastered";
  if (mastery >= 3) return "strong";
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
  label,
  className,
}: {
  mastery: number;
  label: string;
  className?: string;
}) {
  const filled = Math.min(Math.max(mastery, 0), MASTERY_MAX);
  const level = masteryLevel(filled);

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      data-testid="mastery-pips"
      data-level={level}
      data-mastery={filled}
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
