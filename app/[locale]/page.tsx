import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Languages,
  Mic2,
  Search,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroWordIllustration } from "@/components/hero-word-illustration";
import { fetchAPI } from "@/lib/api";
import { API_URL } from "@/constants/config";

type VocabWord = {
  id: string;
  word: string;
};

const features = [
  {
    title: "Oxford 3000 vocabulary",
    description:
      "Learn core English words from the Oxford 3000 list, organized by CEFR level.",
    icon: BookOpen,
  },
  {
    title: "Thai meaning",
    description: "Every word can include Thai meaning and simple explanation.",
    icon: Languages,
  },
  {
    title: "Pronunciation help",
    description: "Show Thai-style transcription for learners who need support.",
    icon: Mic2,
  },
  {
    title: "Review system",
    description: "Later, spaced repetition can help users review weak words.",
    icon: Brain,
  },
];

const steps = [
  "Choose your level",
  "Learn words with meaning and pronunciation",
  "Practice with short quizzes",
  "Review words again later",
];

export default async function Home() {
  const t = await getTranslations("Home");

  const data2 = await fetchAPI<VocabWord[]>({
    url: `${API_URL}/VocabWord`,
    params: {
      where: {
        level: "A1",
      },
    },
  });
  console.log("data", data2);

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <section className="border-b bg-zinc-950 text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 lg:px-8">
          <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-pink-600 text-white">
                <Sparkles className="size-5" />
              </div>

              <div>
                <p className="text-sm font-semibold leading-none">
                  Vocab Learning
                </p>
                <p className="text-xs text-zinc-400">{t("brandSubtitle")}</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
              <Link href="/english/a1" className="hover:text-white">
                A1 Words
              </Link>
              <Link href="/learn" className="hover:text-white">
                Learn
              </Link>
              <Link href="/quiz" className="hover:text-white">
                Quiz
              </Link>
              <Link href="/progress" className="hover:text-white">
                Progress
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />

              <Button
                asChild
                className="rounded-full bg-white text-zinc-950 hover:bg-zinc-200"
              >
                <Link href="/english/a1">
                  {t("start")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-8">
              <div className="space-y-5">
                <Badge className="rounded-full border-white/10 bg-white/10 px-4 py-1.5 text-sm text-white hover:bg-white/10">
                  {t("heroBadge")}
                </Badge>

                <div className="space-y-4">
                  <h1 className="max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                    {t("heroTitleStart")}{" "}
                    <span className="text-pink-500">
                      {t("heroTitleHighlight")}
                    </span>{" "}
                    {t("heroTitleEnd")}
                  </h1>

                  <p className="max-w-2xl text-lg leading-8 text-zinc-300">
                    {t("heroDescription")}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-pink-600 px-6 text-white hover:bg-pink-500"
                >
                  <Link href="/english/a1">
                    {t("exploreA1Words")}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-white/15 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/learn">{t("howLearningWorks")}</Link>
                </Button>
              </div>

              <div className="grid max-w-2xl gap-3 text-sm text-zinc-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  {t("heroStatWords")}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  {t("heroStatLevel")}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  {t("heroStatThai")}
                </div>
              </div>
            </div>

            <HeroWordIllustration />
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-20 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <Badge variant="outline" className="rounded-full">
                Core features
              </Badge>

              <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Built like a real learning product.
              </h2>
            </div>

            <p className="max-w-2xl text-base leading-7 text-zinc-600 lg:justify-self-end">
              The first frontend version should stay simple: word pages, level
              pages, pronunciation support, quiz flow, and room for progress
              tracking after login is added.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <Card key={feature.title} className="rounded-3xl">
                  <CardHeader>
                    <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                      <Icon className="size-5" />
                    </div>

                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm leading-6 text-zinc-600">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t bg-zinc-50">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="space-y-5">
            <Badge variant="outline" className="rounded-full bg-white">
              Learning flow
            </Badge>

            <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Simple enough to start, structured enough to grow.
            </h2>

            <p className="max-w-xl text-base leading-7 text-zinc-600">
              Start with mock data first. After the UI feels right, connect the
              backend, authentication, spaced repetition, and analytics.
            </p>

            <Button
              asChild
              className="rounded-full bg-zinc-950 text-white hover:bg-zinc-800"
            >
              <Link href="/learn">
                Start learning
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <Card className="rounded-3xl">
            <CardContent className="p-6">
              <div className="grid gap-4">
                {steps.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-4 rounded-2xl border bg-white p-4 transition-colors hover:border-zinc-400"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-sm font-semibold text-white">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <p className="font-medium">{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <div className="flex items-center gap-2">
              <Search className="size-5 text-pink-600" />
              <h2 className="text-2xl font-semibold">
                Ready for SEO-friendly word pages
              </h2>
            </div>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Later, every word can have its own page, such as
              /english/words/improve, with meaning, examples, pronunciation, and
              related words.
            </p>
          </div>

          <Button
            asChild
            size="lg"
            className="rounded-full bg-zinc-950 text-white hover:bg-zinc-800"
          >
            <Link href="/english/a1">
              Browse A1 words
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
