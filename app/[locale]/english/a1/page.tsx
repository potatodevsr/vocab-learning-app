import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Layers3,
  Play,
  Repeat2,
  Sparkles,
} from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import type { OxfordWord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type LessonUnit = {
  id: string;
  number: number;
  title: string;
  words: OxfordWord[];
  wordRange: string;
  href: string;
};

const unitSize = 20;
const visibleUnitCount = 8;

const chunkWords = (words: OxfordWord[], size: number) =>
  Array.from({ length: Math.ceil(words.length / size) }, (_, index) =>
    words.slice(index * size, index * size + size)
  );

const createLessonUnits = (words: OxfordWord[]): LessonUnit[] =>
  chunkWords(words, unitSize).map((unitWords, index) => {
    const firstWord = unitWords.at(0);
    const lastWord = unitWords.at(-1);
    const number = index + 1;

    return {
      id: `a1-unit-${number}`,
      number,
      title: `Unit ${number}`,
      words: unitWords,
      wordRange:
        firstWord && lastWord
          ? `${firstWord.displayWord} → ${lastWord.displayWord}`
          : "No words",
      href: `/learn?level=A1&unit=${number}`,
    };
  });

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

export default async function A1WordsPage() {
  const words = await getWordsByLevel("A1");
  const units = createLessonUnits(words);
  const visibleUnits = units.slice(0, visibleUnitCount);
  const firstUnit = units[0];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="border-b bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
          <div className="mb-10 flex items-center justify-between gap-4">
            <Button
              asChild
              variant="ghost"
              className="rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
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
              <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
                Oxford 3000 · A1 beginner path
              </Badge>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Start learning A1 words step by step.
                </h1>

                <p className="max-w-2xl text-base leading-7 text-zinc-300">
                  Learn the Oxford 3000 A1 words through small units instead of
                  scrolling through a long vocabulary list. Start with Unit 1,
                  then continue through the path.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-zinc-300">
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  {words.length} A1 entries
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  {units.length} units
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  {unitSize} words per unit
                </div>
              </div>

              {firstUnit && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-full bg-pink-600 px-6 text-white hover:bg-pink-500"
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
                    className="h-12 rounded-full border-white/15 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
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
              <Card className="rounded-3xl border-white/10 bg-white/10 text-white">
                <CardContent className="p-6">
                  <Badge className="rounded-full bg-pink-600 text-white hover:bg-pink-600">
                    First lesson
                  </Badge>

                  <h2 className="mt-5 text-2xl font-semibold">
                    Unit 1 · Basic A1 words
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {firstUnit.wordRange}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {firstUnit.words.slice(0, 6).map((word) => (
                      <Badge
                        key={word.id}
                        variant="outline"
                        className="rounded-full border-white/15 bg-white/5 text-white"
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
              <Card key={step.title} className="rounded-3xl bg-white">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={
                        index === 0
                          ? "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-pink-600 text-white"
                          : "flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white"
                      }
                    >
                      <Icon className="size-5" />
                    </div>

                    <div>
                      <p className="text-sm font-medium text-zinc-500">
                        Step {index + 1}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">
                        {step.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">
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
              A1 lesson path
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
                    ? "relative rounded-3xl border-zinc-950 bg-white shadow-sm"
                    : "relative rounded-3xl bg-white"
                }
              >
                <CardContent className="grid gap-5 p-5 sm:grid-cols-[56px_1fr_auto] sm:items-center">
                  <div
                    className={
                      isFirst
                        ? "relative z-10 flex size-14 items-center justify-center rounded-2xl bg-pink-600 text-sm font-semibold text-white"
                        : "relative z-10 flex size-14 items-center justify-center rounded-2xl border bg-white text-sm font-semibold text-zinc-700"
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
                        {unit.words.length} words
                      </Badge>

                      {isFirst && (
                        <Badge className="rounded-full bg-zinc-950 text-white hover:bg-zinc-950">
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
                        ? "rounded-full bg-pink-600 text-white hover:bg-pink-500"
                        : "rounded-full bg-white"
                    }
                    variant={isFirst ? "default" : "outline"}
                  >
                    <Link href={unit.href}>
                      {isFirst ? "Start" : "Preview"}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-4 rounded-3xl border-dashed bg-white">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-100">
                <Layers3 className="size-5 text-zinc-700" />
              </div>

              <div>
                <h3 className="font-semibold">More units are ready</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {Math.max(units.length - visibleUnits.length, 0)} more A1
                  units are already available in the extracted seed data.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <CheckCircle2 className="size-4 text-pink-600" />
              No long word list on this page
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
