import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { getConsonants, getVowelSounds, type ThaiLetter } from "@/lib/thai-letters";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";
import { TrackPageView } from "@/components/track-page-view";

/**
 * Public content: cacheable, re-rendered hourly.
 *
 * Every page on the site was `ƒ` (server-rendered on demand) and therefore shipped
 * `Cache-Control: private, no-cache, no-store` — at ~6,000 URLs, a Worker invocation and
 * a D1 read for every crawler hit and every visitor. Nothing here varies by visitor, so
 * nothing here needs to.
 */
export const revalidate = 3600;


/**
 * The Thai writing system as a reference table: 44 consonants and the traditional 32 vowels,
 * each with its RTGS transcription.
 *
 * Why this is a page and not a panel inside a lesson: reading a script is not a timed task.
 * A learner meeting `เ` under a word wants one letter named; a learner asking "what are the
 * Thai vowels" wants the whole system laid out and will come back to it. Those are different
 * intents (SEO-CONTENT §2.1) and the second one has nowhere else to live.
 *
 * The 32 vowels can only appear here, never on the per-character buttons. `เ‑ีย` is one
 * sound written across three characters, two of which already have their own rows in the
 * `vowelSign` list — a button pointing at `เ` can honestly name the mark and nothing more.
 *
 * Substance floor (SEO-CONTENT §2.2): 76 rows, well past the 12-item minimum, and the RTGS
 * column is curated at `/admin/letters` rather than generated, which is §2.3.
 */

type LocalePageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Alphabet" });

  return publicMetadata({
    locale,
    path: "/thai-alphabet",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

const LetterTable = ({
  letters,
  columns,
  scrollHint,
}: {
  letters: ThaiLetter[];
  columns: { char: string; name: string; roman: string; sound: string };
  scrollHint: string;
}) => (
  // Wide content scrolls inside its own container so the page body never scrolls sideways
  // at 390px, which is the width this is designed at. The table is 612px inside a 345px
  // container there, so 43% of every row starts off-screen — silently, because a
  // touch device draws no scrollbar until you already know to drag. The hint says so,
  // and `tabIndex` makes the region reachable by keyboard, which an `overflow` container
  // holding focusable-free content otherwise is not.
  <div
    role="region"
    aria-label={scrollHint}
    tabIndex={0}
    className="play-focus mt-4 overflow-x-auto rounded-2xl border-2 border-ink bg-white"
  >
    <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
      <thead>
        <tr className="border-b-2 border-ink bg-accent-mint/30">
          <th scope="col" className="px-4 py-3 font-bold">
            {columns.char}
          </th>
          <th scope="col" className="px-4 py-3 font-bold">
            {columns.roman}
          </th>
          <th scope="col" className="px-4 py-3 font-bold">
            {columns.sound}
          </th>
          <th scope="col" className="px-4 py-3 font-bold">
            {columns.name}
          </th>
        </tr>
      </thead>
      <tbody>
        {letters.map((letter) => (
          <tr
            key={letter.id}
            data-testid="alphabet-row"
            className="border-b border-ink/15 last:border-b-0"
          >
            <td className="font-thai px-4 py-2.5 text-xl" lang="th">
              {letter.char}
            </td>
            <td
              data-testid="alphabet-roman"
              className="px-4 py-2.5 font-medium"
            >
              {letter.roman}
            </td>
            <td className="px-4 py-2.5 text-muted-foreground">
              {letter.sound || "—"}
              {letter.soundFinal ? ` / ${letter.soundFinal}` : ""}
              {letter.vowelLength ? (
                <Badge variant="secondary" className="ml-2 align-middle">
                  {letter.vowelLength}
                </Badge>
              ) : null}
            </td>
            <td className="font-thai px-4 py-2.5 text-muted-foreground" lang="th">
              {letter.name}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default async function ThaiAlphabetPage({ params }: LocalePageProps) {
  const { locale } = await params;

  // Keeps the route statically renderable — see app/[locale]/about/page.tsx.
  setRequestLocale(locale);
  const t = await getTranslations("Alphabet");

  // Two reads rather than one filtered locally: each is a single request well under the
  // guard ceiling, and asking for exactly what is rendered keeps the page honest about
  // what it needs. They are independent, so they run together.
  const [consonants, vowels] = await Promise.all([
    getConsonants(),
    getVowelSounds(),
  ]);

  const columns = {
    char: t("columnLetter"),
    roman: t("columnRoman"),
    sound: t("columnSound"),
    name: t("columnThaiName"),
  };

  return (
    <>
      <TrackPageView family="alphabet" locale={locale} />
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: t("metaTitle"),
          description: t("metaDescription"),
          url: absoluteUrl(localePath(locale, "/thai-alphabet")),
          inLanguage: locale,
        })}
      />

      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          {t("title")}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {t("intro")}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("rtgsNote")}
        </p>

        <section className="mt-10" data-testid="alphabet-consonants">
          <h2 className="text-xl font-bold text-ink">
            {t("consonantsTitle", { count: consonants.length })}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("consonantsBody")}
          </p>
          <LetterTable
            letters={consonants}
            columns={columns}
            scrollHint={t("tableScrollHint")}
          />
        </section>

        <section className="mt-12" data-testid="alphabet-vowels">
          <h2 className="text-xl font-bold text-ink">
            {t("vowelsTitle", { count: vowels.length })}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("vowelsBody")}
          </p>
          <LetterTable
            letters={vowels}
            columns={columns}
            scrollHint={t("tableScrollHint")}
          />
        </section>

        {/*
          No page may have zero outbound internal links, and an orphan is a sitemap entry
          rather than a page (SEO-CONTENT §2.4, §5). These are the three routes a reader of
          this table actually wants next.
        */}
        <nav className="mt-12 flex flex-wrap gap-3" aria-label={t("nextTitle")}>
          <Link
            href="/english"
            className="rounded-2xl border-2 border-ink bg-white px-5 py-3 text-sm font-bold text-ink transition-colors hover:bg-accent-sun"
          >
            {t("nextEnglish")}
          </Link>
          <Link
            href="/english/A1"
            className="rounded-2xl border-2 border-ink bg-white px-5 py-3 text-sm font-bold text-ink transition-colors hover:bg-accent-sun"
          >
            {t("nextLevel")}
          </Link>
          <Link
            href="/faq"
            className="rounded-2xl border-2 border-ink bg-white px-5 py-3 text-sm font-bold text-ink transition-colors hover:bg-accent-sun"
          >
            {t("nextFaq")}
          </Link>
        </nav>
      </main>
    </>
  );
}
