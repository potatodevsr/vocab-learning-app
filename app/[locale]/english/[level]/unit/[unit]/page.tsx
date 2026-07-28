import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Volume2 } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getLevelWordCount,
  getWordsByUnit,
  UNIT_SIZE,
} from "@/lib/oxford-words";
import { absoluteUrl, jsonLd, localePath, publicMetadata } from "@/lib/seo";
import type { CefrLevel } from "@/lib/types";

type UnitPageProps = {
  params: Promise<{ locale: string; level: string; unit: string }>;
};

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2"];

const parseLevel = (value: string): CefrLevel | null => {
  const upper = value.toUpperCase() as CefrLevel;
  return LEVELS.includes(upper) ? upper : null;
};

const parseUnit = (value: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

/**
 * A unit page is the main long-tail SEO surface (docs/SPEC.md §9.2): twenty real words
 * with their Thai meanings on one crawlable page, each linking to its own word page.
 */
export async function generateMetadata({
  params,
}: UnitPageProps): Promise<Metadata> {
  const { locale, level: rawLevel, unit: rawUnit } = await params;
  const level = parseLevel(rawLevel);
  const unit = parseUnit(rawUnit);

  if (!level || !unit) {
    return { title: "ไม่พบบทเรียน", robots: { index: false, follow: false } };
  }

  const words = await getWordsByUnit(level, unit);

  if (words.length === 0) {
    return { title: "ไม่พบบทเรียน", robots: { index: false, follow: false } };
  }

  const sample = words
    .slice(0, 5)
    .map((word) => word.displayWord)
    .join(", ");

  const isThai = locale === "th";

  return publicMetadata({
    locale,
    path: `english/${level.toLowerCase()}/unit/${unit}`,
    title: isThai
      ? `คำศัพท์ ${level} บทที่ ${unit} — ${words.length} คำ พร้อมคำแปลไทย`
      : `Oxford 3000 ${level} unit ${unit} — ${words.length} words with Thai meanings`,
    description: isThai
      ? `คำศัพท์ภาษาอังกฤษระดับ ${level} บทที่ ${unit} จากชุด Oxford 3000 เช่น ${sample} พร้อมความหมายภาษาไทย คำอ่าน และตัวอย่างประโยค`
      : `Unit ${unit} of the Oxford 3000 ${level} word list: ${sample} and more, each with its Thai meaning, pronunciation and example sentence.`,
  });
}

export default async function UnitPage({ params }: UnitPageProps) {
  const { locale, level: rawLevel, unit: rawUnit } = await params;
  const level = parseLevel(rawLevel);
  const unit = parseUnit(rawUnit);

  if (!level || !unit) notFound();

  const [words, levelTotal] = await Promise.all([
    getWordsByUnit(level, unit),
    getLevelWordCount(level),
  ]);

  if (words.length === 0) notFound();

  const unitCount = Math.max(Math.ceil(levelTotal / UNIT_SIZE), 1);
  const levelHref = `/english/${level.toLowerCase()}`;

  return (
    <>
      {/* An ItemList of DefinedTerms: a curated vocabulary list, not an article. */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Oxford 3000 ${level} — unit ${unit}`,
          numberOfItems: words.length,
          itemListElement: words.map((word, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "DefinedTerm",
              name: word.displayWord,
              description: word.meaningTh,
              inDefinedTermSet: "Oxford 3000",
              url: absoluteUrl(
                localePath(locale, `english/words/${word.slug}`),
              ),
            },
          })),
        })}
      />
    <main className="min-h-screen bg-background text-foreground">

      <section className="bg-brand text-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
          <Button
            asChild
            variant="ghost"
            className="play-press rounded-full text-white/90 hover:bg-white/20 hover:text-white"
          >
            <Link href={levelHref}>
              <ArrowLeft className="size-4" />
              {`คำศัพท์ ${level} ทั้งหมด`}
            </Link>
          </Button>

          <Badge className="mt-8 rounded-full bg-white/25 text-white hover:bg-white/25">
            {`Oxford 3000 · ${level}`}
          </Badge>

          <h1 className="mt-4 max-w-3xl">
            {`คำศัพท์ภาษาอังกฤษ ${level} บทที่ ${unit}`}
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-white/90">
            {`${words.length} คำพร้อมความหมายภาษาไทย คำอ่าน และตัวอย่างประโยค — บทที่ ${unit} จาก ${unitCount} บท`}
          </p>

          <Button
            asChild
            size="lg"
            className="play-press mt-6 h-12 rounded-full bg-white px-6 font-semibold text-brand hover:bg-white"
          >
            <Link href={`/learn?level=${level}&unit=${unit}`}>
              เริ่มเรียนบทนี้
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
        <ul className="grid gap-3" data-testid="unit-word-list">
          {words.map((word) => (
            <li key={word.id}>
              <Link
                href={`/english/words/${word.slug}`}
                className="play-tile flex flex-wrap items-center justify-between gap-4 p-5 [--tile-block:var(--accent-sky)]"
              >
                <div className="min-w-0">
                  <p className="text-2xl font-bold">{word.displayWord}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {word.partOfSpeech}
                    {word.pronunciationTh ? ` · ${word.pronunciationTh}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <p className="font-thai text-lg font-semibold" lang="th">
                    {word.meaningTh}
                  </p>
                  {word.exampleEn ? (
                    <Volume2 className="size-4 shrink-0 text-muted-foreground" />
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <nav className="mt-8 flex flex-wrap items-center justify-between gap-3">
          {unit > 1 ? (
            <Button
              asChild
              variant="outline"
              className="play-press rounded-full bg-white"
            >
              <Link
                data-testid="prev-unit"
                href={`/english/${level.toLowerCase()}/unit/${unit - 1}`}
              >
                <ArrowLeft className="size-4" />
                {`บทที่ ${unit - 1}`}
              </Link>
            </Button>
          ) : (
            <span />
          )}

          {unit < unitCount ? (
            <Button
              asChild
              variant="outline"
              className="play-press rounded-full bg-white"
            >
              <Link
                data-testid="next-unit"
                href={`/english/${level.toLowerCase()}/unit/${unit + 1}`}
              >
                {`บทที่ ${unit + 1}`}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      </section>
    </main>
    </>
  );
}
