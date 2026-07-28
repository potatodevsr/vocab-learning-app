import { cn } from "@/lib/utils";

/**
 * "You own 347 of 3,000." Collection is the strongest intrinsic motivator for a
 * vocabulary app specifically (SPEC §5.4.1 principle 6) — the learner is literally
 * collecting the Oxford 3000.
 */
export function CollectionMeter({
  owned,
  total,
  title,
  caption,
  className,
}: {
  owned: number;
  total: number;
  title: string;
  caption: string;
  className?: string;
}) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(Math.round((owned / safeTotal) * 100), 100);

  return (
    <section
      className={cn("play-card p-6 sm:p-8", className)}
      data-testid="collection-meter"
      data-percent={percent}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
        </div>

        <p className="text-3xl font-semibold tabular-nums">
          <span className="play-count inline-block" data-testid="collection-owned">
            {owned.toLocaleString()}
          </span>
          <span className="text-muted-foreground"> / {total.toLocaleString()}</span>
        </p>
      </div>

      <div
        className="mt-5 h-4 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={title}
      >
        <div
          data-testid="collection-fill"
          className="h-full rounded-full bg-brand transition-[width] duration-[400ms] ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-sm font-medium text-brand" data-testid="collection-percent">
        {percent}%
      </p>
    </section>
  );
}
