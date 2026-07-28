import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Play,
  Repeat2,
  Sparkles,
} from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import type { CefrLevel, OxfordWord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getLevelWordCount,
  getPreviewWords,
  UNIT_SIZE,
} from "@/lib/oxford-words";
import { jsonLd, publicMetadata } from "@/lib/seo";

type LessonUnit = {
  id: string;
  number: number;
  title: string;
  words: OxfordWord[];
  wordRange: string;
  href: string;
};

const unitSize = UNIT_SIZE;
const visibleUnitCount = 8;

/**
 * Units come from the `unit` column, not from slicing a full-level fetch — the API caps
 * how many rows one read returns, so slicing locally silently lost most of the level.
 * Preview words are whatever the first page of results covers; later units render
 * without a preview rather than pretending they are empty.
 */
const createLessonUnits = (
  level: CefrLevel,
  totalWords: number,
  previewWords: OxfordWord[]
): LessonUnit[] => {
  const unitCount = Math.max(Math.ceil(totalWords / unitSize), 1);
  const byUnit = new Map<number, OxfordWord[]>();

  for (const word of previewWords) {
    const unit = word.unit ?? Math.floor((word.sourceOrder - 1) / unitSize) + 1;
    byUnit.set(unit, [...(byUnit.get(unit) ?? []), word]);
  }

  return Array.from({ length: unitCount }, (_, index) => {
    const number = index + 1;
    const unitWords = byUnit.get(number) ?? [];
    const firstWord = unitWords.at(0);
    const lastWord = unitWords.at(-1);

    return {
      id: `${level.toLowerCase()}-unit-${number}`,
      number,
      title: `Unit ${number}`,
      words: unitWords,
      wordRange:
        firstWord && lastWord
          ? `${firstWord.displayWord} → ${lastWord.displayWord}`
          : `${unitSize} words`,
      href: `/learn?level=${level}&unit=${number}`,
    };
  });
};

const learningSteps = [
  {
    title: "Learn",
    description: "Read each word, part of speech, and learning notes.",
    icon: BookOpen,
  },
  {
    title: "Practice",
    description: "Answer short questions from the same unit.",
    icon: Sparkles,
  },
  {
    title: "Review",
    description: "Weak words can come back later for spaced review.",
    icon: Repeat2,
  },
];

type LevelPageProps = {
  params: Promise<{ locale: string; level: string }>;
};

/** Each CEFR level is its own search target, so each gets its own copy. */
const LEVEL_COPY: Record<CefrLevel, { badge: string; blurb: string }> = {
  A1: {
    badge: "beginner path",
    blurb:
      "คำศัพท์ภาษาอังกฤษพื้นฐานที่สุด เหมาะกับผู้เริ่มต้น เรียนทีละบทสั้น ๆ พร้อมความหมายไทยและคำอ่าน",
  },
  A2: {
    badge: "elementary path",
    blurb:
      "คำศัพท์ภาษาอังกฤษระดับต้น ต่อยอดจาก A1 ใช้ในชีวิตประจำวันได้จริง พร้อมความหมายไทยและตัวอย่างประโยค",
  },
  B1: {
    badge: "intermediate path",
    blurb:
      "คำศัพท์ภาษาอังกฤษระดับกลาง สำหรับการทำงานและการเรียน พร้อมความหมายไทย คำอ่าน และตัวอย่างการใช้",
  },
  B2: {
    badge: "upper-intermediate path",
    blurb:
      "คำศัพท์ภาษาอังกฤษระดับสูง สำหรับการอ่านบทความและการสอบ พร้อมความหมายไทยและตัวอย่างประโยค",
  },
};

const parseLevel = (value: string): CefrLevel | null => {
  const upper = value.toUpperCase();
  return upper in LEVEL_COPY ? (upper as CefrLevel) : null;
};

export function generateStaticParams() {
  return Object.keys(LEVEL_COPY).map((level) => ({ level: level.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: LevelPageProps): Promise<Metadata> {
  const { locale, level: raw } = await params;
  const level = parseLevel(raw);

  if (!level) {
    return { title: "ไม่พบระดับคำศัพท์", robots: { index: false, follow: false } };
  }

  const total = await getLevelWordCount(level);

  const isThai = locale === "th";

  return publicMetadata({
    locale,
    path: `english/${level.toLowerCase()}`,
    title: isThai
      ? `คำศัพท์ภาษาอังกฤษ ${level} — Oxford 3000 ${total} คำ พร้อมคำแปลไทย`
      : `Oxford 3000 ${level} vocabulary — ${total} English words with Thai meanings`,
    description: isThai
      ? LEVEL_COPY[level].blurb
      : `Every Oxford 3000 word at CEFR level ${level}, with Thai meanings, pronunciation and example sentences, split into short units.`,
  });
}

export default async function LevelPage({ params }: LevelPageProps) {
  const { level: raw } = await params;
  const level = parseLevel(raw);

  if (!level) notFound();

  const [totalWords, previewWords] = await Promise.all([
    getLevelWordCount(level),
    getPreviewWords(level),
  ]);

  const units = createLessonUnits(level, totalWords, previewWords);
  const visibleUnits = units.slice(0, visibleUnitCount);
  const firstUnit = units[0];

  return (
    <>
      {/* ItemList: tells Google this page is a curated list, not a landing page. */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Oxford 3000 ${level} word list`,
          numberOfItems: totalWords,
          itemListElement: visibleUnits.map((unit, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: unit.title,
          })),
        })}
      />
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-brand text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
          <div className="mb-10 flex items-center justify-between gap-4">
            <Button
              asChild
              variant="ghost"
              className="play-press rounded-full text-white/90 hover:bg-white/20 hover:text-white"
            >
              <Link href="/">
                <ArrowLeft className="size-4" />
                Back to home
              </Link>
            </Button>

            <LanguageSwitcher />
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div className="space-y-6">
              <Badge className="rounded-full bg-white/25 text-white hover:bg-white/25">
                {`Oxford 3000 · ${level} ${LEVEL_COPY[level].badge}`}
              </Badge>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  {`คำศัพท์ภาษาอังกฤษ ${level} — เรียนทีละบท`}
                </h1>

                <p className="max-w-2xl text-base leading-7 text-white/90">
{LEVEL_COPY[level].blurb}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-white/90">
                <div className="rounded-full bg-white/20 px-4 py-2 font-medium">
                  {totalWords} {level} entries
                </div>
                <div className="rounded-full bg-white/20 px-4 py-2 font-medium">
                  {units.length} units
                </div>
                <div className="rounded-full bg-white/20 px-4 py-2 font-medium">
                  {unitSize} words per unit
                </div>
              </div>

              {firstUnit && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="play-press h-12 rounded-full bg-white px-6 font-semibold text-brand hover:bg-white"
                  >
                    <Link href={firstUnit.href}>
                      <Play className="size-4" />
                      Start Unit 1
                    </Link>
                  </Button>

                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="play-press h-12 rounded-full border-2 border-white/60 bg-transparent px-6 text-white hover:bg-white/20 hover:text-white"
                  >
                    <Link href="#lesson-path">
                      View lesson path
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {firstUnit && (
              <Card className="rounded-[28px] border-0 bg-white/20 text-white backdrop-blur">
                <CardContent className="p-6">
                  <Badge className="rounded-full bg-white text-brand hover:bg-white">
                    First lesson
                  </Badge>

                  <h2 className="mt-5 text-2xl font-semibold">
                    Unit 1 · Basic A1 words
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/90">
                    {firstUnit.wordRange}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {firstUnit.words.slice(0, 6).map((word) => (
                      <Badge
                        key={word.id}
                        variant="outline"
                        className="rounded-full border-white/40 bg-white/15 text-white"
                      >
                        {word.displayWord}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {learningSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <Card key={step.title} className="play-tile rounded-[28px] border-0 [--tile-block:var(--accent-mint)]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={
                        index === 0
                          ? "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white"
                          : "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-sky text-white"
                      }
                    >
                      <Icon className="size-5" />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Step {index + 1}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">
                        {step.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section
        id="lesson-path"
        className="mx-auto w-full max-w-6xl px-6 pb-16 lg:px-8"
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="outline" className="rounded-full bg-white">
              Your path
            </Badge>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              {`${level} lesson path`}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Start from Unit 1. Other units are shown as previews until lesson
              progress and authentication are added.
            </p>
          </div>

          <Badge variant="outline" className="w-fit rounded-full bg-white">
            Showing {visibleUnits.length} of {units.length} units
          </Badge>
        </div>

        <div className="relative grid gap-4">
          <div className="absolute left-7 top-8 hidden h-[calc(100%-64px)] w-px bg-zinc-200 sm:block" />

          {visibleUnits.map((unit, index) => {
            const isFirst = index === 0;

            return (
              <Card
                key={unit.id}
                className={
                  isFirst
                    ? "play-tile relative rounded-[28px] [--tile-block:var(--accent-sun)]"
                    : "play-tile relative rounded-[28px] [--tile-block:var(--accent-sky)]"
                }
              >
                <CardContent className="grid gap-5 p-5 sm:grid-cols-[56px_1fr_auto] sm:items-center">
                  <div
                    className={
                      isFirst
                        ? "relative z-10 flex size-14 items-center justify-center rounded-2xl bg-brand text-base font-semibold text-white"
                        : "relative z-10 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-base font-semibold text-brand"
                    }
                  >
                    {String(unit.number).padStart(2, "0")}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold">{unit.title}</h3>

                      <Badge
                        variant="outline"
                        className="rounded-full bg-white"
                      >
                        {unit.words.length || unitSize} words
                      </Badge>

                      {isFirst && (
                        <Badge className="rounded-full bg-success text-white hover:bg-success">
                          Start here
                        </Badge>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-zinc-600">
                      {unit.wordRange}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {unit.words.slice(0, 6).map((word) => (
                        <Badge
                          key={word.id}
                          variant="outline"
                          className="rounded-full bg-zinc-50"
                        >
                          {word.displayWord}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button
                    asChild
                    className={
                      isFirst
                        ? "play-press rounded-full bg-brand text-white hover:bg-brand"
                        : "play-press rounded-full bg-white"
                    }
                    variant={isFirst ? "default" : "outline"}
                  >
                    <Link href={`/english/${level.toLowerCase()}/unit/${unit.number}`}>
                      {isFirst ? "Start" : "Preview"}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/*
          Every unit is linked, not just the first eight. A page that only the sitemap
          knows about is an orphan: crawlers reach it rarely and rank it poorly, and a
          learner on unit 30 had no way to navigate there at all.
        */}
        {units.length > visibleUnits.length && (
          <div className="play-card mt-6 p-6">
            <h3 className="text-lg font-bold">{`ทุกบทเรียนของระดับ ${level}`}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {`${units.length} บท · บทละ ${unitSize} คำ`}
            </p>

            <ul
              className="mt-4 flex flex-wrap gap-2"
              data-testid="all-units-index"
            >
              {units.map((unit) => (
                <li key={unit.id}>
                  <Link
                    href={`/english/${level.toLowerCase()}/unit/${unit.number}`}
                    className="play-press flex size-11 items-center justify-center rounded-xl border-3 border-ink bg-white text-sm font-bold hover:bg-brand-soft"
                  >
                    {unit.number}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
    </>
  );
}
