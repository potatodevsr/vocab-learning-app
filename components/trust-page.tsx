import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * The shared shell for the static trust pages (about, how-it-works, privacy, terms,
 * contact). Each page owns its copy through the `Trust` namespace and hands this
 * component a single `h1`, an intro and its sections — the layout, coloured band and
 * optional call-to-action are the same everywhere so the five pages read as one set.
 *
 * A section body may contain multiple paragraphs separated by a blank line (`\n\n`);
 * they render as separate `<p>` so a translator can keep prose readable in the message
 * file without HTML.
 */
export type TrustSection = { heading: string; body: string };

export function TrustPage({
  bandClassName,
  h1,
  intro,
  sections,
  cta,
}: {
  /** A white-safe band (AGENTS §8): `--brand`, `--accent-grape`, `--accent-deep-sky`. */
  bandClassName: string;
  h1: string;
  intro: string;
  sections: TrustSection[];
  cta?: { href: string; label: string };
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className={bandClassName}>
        <div className="mx-auto w-full max-w-4xl px-6 py-12 lg:px-8">
          <h1>{h1}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white">{intro}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
        <div className="grid gap-4">
          {sections.map((section) => (
            <article key={section.heading} className="play-card p-6">
              <h2 className="text-xl font-bold">{section.heading}</h2>
              {section.body.split("\n\n").map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </article>
          ))}
        </div>

        {cta ? (
          <Button
            asChild
            size="lg"
            className="play-press mt-8 h-12 rounded-full bg-brand px-6 text-white hover:bg-brand"
          >
            <Link href={cta.href}>
              {cta.label}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </section>
    </main>
  );
}
