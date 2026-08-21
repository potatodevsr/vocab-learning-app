import { cn } from "@/lib/utils";

/**
 * The scope boundary for the public art direction (`app/public-design.css`).
 *
 * Every marketing and SEO surface renders inside this; nothing else does. The
 * `data-ad="public"` attribute is what every rule in that stylesheet is nested under, so
 * a page that forgets this wrapper simply gets the app's `play-*` language instead of a
 * half-applied hybrid — a visible failure rather than a subtle one.
 *
 * It is also the page's `<main>`, so it stays one element rather than a wrapper around
 * one: the locale layout already owns the `#main` skip-link anchor.
 */
export function PublicShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      data-ad="public"
      className={cn("pd-stock min-h-screen", className)}
    >
      {children}
    </main>
  );
}

/**
 * The measure every public page is set to.
 *
 * 72rem with a 6/8 gutter — wider than a reading column because these pages are plates,
 * not articles, and the mono rail in the margin needs somewhere to sit.
 */
export function Plate({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

/**
 * A section divider: a mono caption sitting on a rule that runs to the edge of the plate.
 *
 * This replaces the coloured band. A band tells a reader "something different starts
 * here" by shouting; a captioned rule tells them the same thing and also says what.
 */
export function RuleLabel({
  children,
  as: Tag = "p",
  className,
}: {
  children: React.ReactNode;
  as?: "p" | "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag className={cn("pd-rule-row pd-mono", className)}>{children}</Tag>
  );
}
