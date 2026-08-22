import { cn } from "@/lib/utils";

import type { ProgressHistory } from "@/lib/progress-api";

/**
 * Twelve weeks of practice, one square per day.
 *
 * The point is not decoration and it is not a streak counter — it is the shape of a habit,
 * which is the thing a learner cannot see from inside a single session. Gaps are shown
 * plainly rather than hidden: a calendar that only draws the good days is a calendar
 * nobody can learn anything from.
 *
 * Server-rendered from `/progress/history`, so it arrives with the page. Days come back as
 * Bangkok calendar days, the same boundary the weekly goal uses, so the two can never
 * disagree about what "today" was.
 */

const WEEKS = 12;
const DAYS_PER_WEEK = 7;

/** Four bands, so colour carries information rather than mood (SPEC §6.3). */
const bandOf = (items: number) => {
  if (items === 0) return 0;
  if (items <= 8) return 1;
  if (items <= 24) return 2;
  return 3;
};

const BAND_CLASS = [
  "bg-ink/10",
  "bg-accent-sky",
  "bg-brand",
  "bg-success",
] as const;

/**
 * The Bangkok calendar day for an instant.
 *
 * Not `toISOString().slice(0, 10)`, which is the UTC day: the API groups sessions by
 * Bangkok day (the same boundary the weekly goal uses), so a UTC grid disagrees with it
 * for the whole 00:00–07:00 window every night — the session a learner just finished lands
 * on a square the grid does not draw, and the page reads as if it had not counted.
 */
const bangkokDay = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);

export function ActivityCalendar({
  history,
  title,
  caption,
  emptyLabel,
  dayLabel,
}: {
  history: ProgressHistory;
  title: string;
  caption: string;
  emptyLabel: string;
  /** `(day, items) => string`, for the per-square accessible label. */
  dayLabel: (day: string, items: number) => string;
}) {
  const byDay = new Map(history.entries.map((entry) => [entry.day, entry.items]));

  // Build the grid back from today so the last column is the current week.
  const today = new Date();
  const squares: { day: string; items: number }[] = [];

  for (let offset = WEEKS * DAYS_PER_WEEK - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const day = bangkokDay(date);
    squares.push({ day, items: byDay.get(day) ?? 0 });
  }

  const activeDays = squares.filter((square) => square.items > 0).length;

  return (
    <section className="play-card p-6 sm:p-8" data-testid="activity-calendar">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{caption}</p>

      {activeDays === 0 ? (
        // Drawn, not apologised for (SPEC §6.3): the empty grid is still the grid, so the
        // learner can see the shape of what filling it in would look like.
        <p className="mt-5 text-sm font-semibold text-muted-foreground">{emptyLabel}</p>
      ) : null}

      <div
        className="mt-5 grid grid-flow-col gap-1.5 overflow-x-auto pb-2"
        style={{ gridTemplateRows: `repeat(${DAYS_PER_WEEK}, minmax(0, 1fr))` }}
        role="img"
        aria-label={caption}
      >
        {squares.map((square) => (
          <span
            key={square.day}
            title={dayLabel(square.day, square.items)}
            data-testid="activity-day"
            data-items={square.items}
            className={cn(
              "size-4 rounded-[5px] border border-ink/10",
              BAND_CLASS[bandOf(square.items)],
            )}
          />
        ))}
      </div>
    </section>
  );
}
