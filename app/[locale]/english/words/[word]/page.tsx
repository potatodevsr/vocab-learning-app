import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { getWordsBySlug } from "@/lib/oxford-words";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type WordPageProps = {
  params: Promise<{ word: string; locale: string }>;
};

export async function generateMetadata({
  params,
}: WordPageProps): Promise<Metadata> {
  const { word: slug, locale } = await params;
  const entries = await getWordsBySlug(slug);
  const head = entries[0];

  if (!head) {
    // A missing word must not be indexed as a real page.
    return { title: "ไม่พบคำศัพท์", robots: { index: false, follow: false } };
  }

  const meanings = entries
    .map((entry) => entry.meaningTh)
    .filter(Boolean)
    .join(" · ");

  // Distinct copy per locale. Serving the same Thai title on /en and /th makes the two
  // pages look like duplicates to a crawler, which is the problem hreflang exists to
  // avoid — the tags only help if the pages differ.
  const isThai = locale === "th";

  return publicMetadata({
    locale,
    path: `english/words/${slug}`,
    title: isThai
      ? `${head.displayWord} แปลว่าอะไร — ${meanings}`
      : `${head.displayWord} meaning in Thai — ${meanings}`,
    description: isThai
      ? `${head.displayWord} (${head.partOfSpeech}) แปลว่า ${meanings} พร้อมคำอ่านภาษาไทย และตัวอย่างประโยคจากชุดคำศัพท์ Oxford 3000 ระดับ ${head.level}`
      : `${head.displayWord} (${head.partOfSpeech}) means ${meanings} in Thai. Pronunciation, example sentences and CEFR level ${head.level} from the Oxford 3000 word list.`,
  });
}

export default async function WordPage({ params }: WordPageProps) {
  const { word: slug, locale } = await params;
  const entries = await getWordsBySlug(slug);

  if (entries.length === 0) {
    notFound();
  }

  const head = entries[0];

  return (
    <>
      {/* DefinedTerm is the schema.org type for a dictionary entry (SPEC §9.4). */}
      {/*
        Breadcrumbs give crawlers the hierarchy (level -> unit -> word) and are eligible
        for the breadcrumb rich result. They also fix a real navigation hole: every word
        page previously linked back to the A1 hub, whatever level the word was.
      */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: `คำศัพท์ ${head.level}`,
              item: absoluteUrl(
                localePath(locale, `english/${head.level.toLowerCase()}`),
              ),
            },
            ...(head.unit
              ? [
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: `บทที่ ${head.unit}`,
                    item: absoluteUrl(
                      localePath(
                        locale,
                        `english/${head.level.toLowerCase()}/unit/${head.unit}`,
                      ),
                    ),
                  },
                ]
              : []),
            {
              "@type": "ListItem",
              position: head.unit ? 3 : 2,
              name: head.displayWord,
            },
          ],
        })}
      />

      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: "Oxford 3000",
          hasDefinedTerm: entries.map((entry) => ({
            "@type": "DefinedTerm",
            name: entry.displayWord,
            description: entry.meaningTh,
            inDefinedTermSet: "Oxford 3000",
            termCode: entry.partOfSpeech,
          })),
        })}
      />
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-brand text-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
          {/*
            A crawl path back up the hierarchy. Every word page previously linked to the
            A1 hub regardless of the word's level, so an A2 word had no route to its own
            unit — for a crawler or for a reader.
          */}
          <nav
            aria-label="breadcrumb"
            data-testid="word-breadcrumb"
            className="flex flex-wrap items-center gap-2 text-sm font-medium text-white/90"
          >
            <Link
              href={`/english/${head.level.toLowerCase()}`}
              className="play-underline"
            >
              {`คำศัพท์ ${head.level}`}
            </Link>

            {head.unit ? (
              <>
                <span aria-hidden>/</span>
                <Link
                  href={`/english/${head.level.toLowerCase()}/unit/${head.unit}`}
                  className="play-underline"
                  data-testid="breadcrumb-unit"
                >
                  {`บทที่ ${head.unit}`}
                </Link>
              </>
            ) : null}

            <span aria-hidden>/</span>
            <span className="text-white">{head.displayWord}</span>
          </nav>

          <h1 className="mt-8 text-6xl font-semibold tracking-tight">
            {head.displayWord}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className="rounded-full bg-white/25 text-white hover:bg-white/25">
              {head.level}
            </Badge>

            <Badge
              variant="outline"
              className="rounded-full border-white/40 bg-white/15 text-white"
            >
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </Badge>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl space-y-4 px-6 py-10 lg:px-8">
        {entries.map((entry) => (
          <Card key={entry.id} className="play-card rounded-[28px] border-0">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-brand text-white hover:bg-brand">
                  {entry.partOfSpeech}
                </Badge>

                {entry.homograph !== null && (
                  <Badge variant="outline" className="rounded-full bg-white">
                    Homograph {entry.homograph}
                  </Badge>
                )}

                {entry.sense && (
                  <Badge variant="outline" className="rounded-full bg-white">
                    {entry.sense}
                  </Badge>
                )}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-brand-soft/50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Thai meaning
                  </p>
                  <p className="font-thai mt-2 text-lg font-semibold" lang="th">
                    {entry.meaningTh || "—"}
                  </p>
                </div>

                <div className="rounded-2xl bg-brand-soft/50 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pronunciation
                  </p>
                  <p className="font-thai mt-2 text-lg font-semibold" lang="th">
                    {entry.pronunciationTh || "—"}
                  </p>

                  {entry.ipa && (
                    <p className="mt-2 text-sm text-muted-foreground">/{entry.ipa}/</p>
                  )}
                </div>
              </div>

              {entry.exampleEn && (
                <div className="mt-4 rounded-2xl bg-accent-mint/15 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Example
                  </p>
                  <p className="mt-2 text-base leading-7 text-foreground">
                    {entry.exampleEn}
                  </p>

                  {entry.exampleTh && (
                    <p
                      className="font-thai mt-2 text-base leading-7 text-muted-foreground"
                      lang="th"
                    >
                      {entry.exampleTh}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
    </>
  );
}
