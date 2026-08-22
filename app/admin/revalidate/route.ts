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
 *
 * On Cloudflare the purge is **not instant**. The tag cache backing it is KV
 * (`open-next.config.ts`), and KV is eventually consistent: a write can take up to 60
 * seconds to be visible everywhere. So an editor sees their fix in seconds to a minute,
 * not in an hour — which is the guarantee this route exists to provide.
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

    /**
     * The A–Z index and the word's letter page. Neither prints the gloss — they are lists
     * of headwords — so what they are being purged for is *membership*: publishing or
     * withdrawing a word changes which of them the word appears on.
     *
     * Only page 1 of the letter is purged. Pages 2+ (`/letter/s/2`) would need the page
     * count, and that means walking every published word — 30 API reads on a route an
     * editor waits for. A word landing on page 3 of S shows up there within the hour
     * instead of immediately, which is the right trade for a list of links.
     */
    purge(`/${locale}/english/words`);
    purge(`/${locale}/english/words/letter/${slug.charAt(0).toLowerCase()}`);

    // The HTML sitemap enumerates every published word.
    purge(`/${locale}/sitemap`);
  }

  // `app/sitemap.ts` is no longer `force-dynamic` — it is cached for an hour like every
  // other public route — so publishing a word has to say so, or the new URL waits out the
  // window before any crawler is told it exists.
  purge("/sitemap.xml");

  return NextResponse.json({ ok: true, purged });
}
