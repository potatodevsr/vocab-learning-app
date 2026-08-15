import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Purges the cached renders of the pages a word appears on.
 *
 * The public content routes are incrementally regenerated (`revalidate = 3600`), which is
 * what makes ~6,000 URLs cacheable at the edge instead of a Worker invocation and a D1
 * read apiece. The cost of that is staleness, and staleness is unacceptable in exactly one
 * place: an editor who fixes a Thai meaning must see the fix, not an hour-old copy of the
 * mistake. This is the escape hatch — the admin screen calls it after a successful save.
 *
 * It lives under `/admin` on purpose: `middleware.ts` already gates that whole prefix on a
 * valid `admin_token`, so the route inherits the check rather than reimplementing it. It
 * also cannot live under `/api/*` — that prefix is the forwarder to the api Worker, and
 * this needs to run inside Next to reach its cache.
 */
export async function POST(request: Request) {
  let slug: unknown;
  let level: unknown;
  let unit: unknown;

  try {
    ({ slug, level, unit } = (await request.json()) as Record<string, unknown>);
  } catch {
    return NextResponse.json({ message: "Expected a JSON body" }, { status: 400 });
  }

  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ message: "slug is required" }, { status: 400 });
  }

  const purged: string[] = [];

  const purge = (path: string) => {
    revalidatePath(path);
    purged.push(path);
  };

  // The word itself, in both locales — they are separate renders of the same row.
  for (const locale of ["en", "th"]) {
    purge(`/${locale}/english/words/${slug}`);

    // The pages that quote this word's meaning in a list. A unit page shows all twenty
    // glosses, and a word page now shows its unit-mates, so one edit is visible on more
    // than the page that owns it.
    if (typeof level === "string" && level) {
      const levelSlug = level.toLowerCase();
      purge(`/${locale}/english/${levelSlug}`);

      if (typeof unit === "number" && Number.isInteger(unit)) {
        purge(`/${locale}/english/${levelSlug}/unit/${unit}`);
      }
    }

    // The A–Z index and the word's letter page both print the gloss.
    purge(`/${locale}/english/words`);
    purge(`/${locale}/english/words/letter/${slug.charAt(0).toLowerCase()}`);
  }

  return NextResponse.json({ ok: true, purged });
}
