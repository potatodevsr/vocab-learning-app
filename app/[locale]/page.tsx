import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Languages,
  Mic2,
  Sparkles,
} from "lucide-react";

import { HeroWordIllustration } from "@/components/hero-word-illustration";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { jsonLd, publicMetadata, SITE_URL } from "@/lib/seo";

const a1WordsHref = "/english/a1";
const learnHref = "/learn?level=A1&unit=1";

const features = [
  {
    title: "Oxford 3000 vocabulary",
    description:
      "Learn essential English words from the Oxford 3000 list, organized by CEFR level.",
    icon: BookOpen,
  },
  {
    title: "Thai meaning",
    description:
      "Understand each word through clear Thai meanings and simple explanations.",
    icon: Languages,
  },
  {
    title: "Pronunciation help",
    description:
      "Practice pronunciation with IPA and Thai-style pronunciation guidance.",
    icon: Mic2,
  },
  {
    title: "Review system",
    description:
      "Return to difficult words regularly and strengthen your long-term memory.",
    icon: Brain,
  },
];

const steps = [
  "Choose your English level",
  "Learn words with meaning and pronunciation",
  "Practice with short quizzes",
  "Review difficult words regularly",
];

type HomeProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });

  return publicMetadata({
    locale,
    title: `${t("heroTitleStart")} ${t("heroTitleHighlight")}`,
    description: t("heroDescription"),
  });
}

export default async function Home() {
  const t = await getTranslations("Home");

  return (
    <>
      {/* WebSite + EducationalOrganization: brand identity and sitelinks (SPEC §9.4). */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "Vocab Learning",
          url: SITE_URL,
          description: t("heroDescription"),
        })}
      />
    <main className="min-h-screen bg-background text-foreground">
      <section className="bg-brand text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 lg:px-8">
          <header className="flex items-center justify-between rounded-3xl bg-white/20 px-4 py-3 backdrop-blur">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-white text-brand">
                <Sparkles className="size-5" />
              </div>

              <div>
                <p className="text-sm font-semibold leading-none">
                  Vocab Learning
                </p>
                <p className="text-xs text-white/80">{t("brandSubtitle")}</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 text-sm font-medium text-white/90 md:flex">
              <Link href={a1WordsHref} className="play-underline">
                A1 Words
              </Link>

              <Link href={learnHref} className="play-underline">
                Learn
              </Link>

              <Link href="/quiz" className="play-underline">
                Quiz
              </Link>

              <Link href="/review" className="play-underline">
                Progress
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />

              <Button
                asChild
                className="play-press rounded-full bg-white font-semibold text-brand hover:bg-white"
              >
                <Link href={learnHref}>
                  {t("start")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-8">
              <div className="space-y-5">
                <Badge className="rounded-full border-0 bg-white/25 px-4 py-1.5 text-sm text-white hover:bg-white/25">
                  {t("heroBadge")}
                </Badge>

                <div className="space-y-4">
                  <h1 className="max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                    {t("heroTitleStart")}{" "}
                    <span className="text-accent-sun drop-shadow-sm">
                      {t("heroTitleHighlight")}
                    </span>{" "}
                    {t("heroTitleEnd")}
                  </h1>

                  <p className="max-w-2xl text-lg leading-8 text-white/90">
                    {t("heroDescription")}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="play-press h-12 rounded-full bg-white px-6 text-base font-semibold text-brand hover:bg-white"
                >
                  <Link href={a1WordsHref}>
                    {t("exploreA1Words")}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="play-press h-12 rounded-full border-2 border-white/60 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/20 hover:text-white"
                >
                  <Link href={learnHref}>{t("howLearningWorks")}</Link>
                </Button>
              </div>

              <div className="grid max-w-2xl gap-3 text-sm text-white sm:grid-cols-3">
                <div className="rounded-2xl bg-white/20 px-4 py-3 font-medium">
                  {t("heroStatWords")}
                </div>

                <div className="rounded-2xl bg-white/20 px-4 py-3 font-medium">
                  {t("heroStatLevel")}
                </div>

                <div className="rounded-2xl bg-white/20 px-4 py-3 font-medium">
                  {t("heroStatThai")}
                </div>
              </div>
            </div>

            <HeroWordIllustration />
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-20 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <Badge className="rounded-full border-0 bg-accent-mint/25 text-accent-mint hover:bg-accent-mint/25">
                Core features
              </Badge>

              <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything you need to build lasting vocabulary.
              </h2>
            </div>

            <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">
              Build a strong English foundation through structured vocabulary
              lessons, pronunciation guidance, short quizzes, and regular
              review.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <Card key={feature.title} className="play-tile rounded-[28px] border-0 [--tile-block:var(--accent-sky)]">
                  <CardHeader>
                    <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand text-white">
                      <Icon className="size-5" />
                    </div>

                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-brand-soft/40">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="space-y-5">
            <Badge className="rounded-full border-0 bg-brand text-white hover:bg-brand">
              Learning flow
            </Badge>

            <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Simple to begin, structured for steady progress.
            </h2>

            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Choose your level, study each word with clear guidance, test your
              understanding, and return regularly to review difficult words.
            </p>

            <Button
              asChild
              className="play-press rounded-full bg-brand px-6 text-white hover:bg-brand"
            >
              <Link href={learnHref}>
                Start learning
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <Card className="play-card rounded-[28px] border-0">
            <CardContent className="p-6">
              <div className="grid gap-4">
                {steps.map((step, index) => (
                  <div
                    key={step}
                    className="play-tile flex items-center gap-4 rounded-2xl bg-white p-4 [--tile-block:var(--accent-mint)]"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-sky text-sm font-semibold text-white">
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
    </main>
    </>
  );
}
