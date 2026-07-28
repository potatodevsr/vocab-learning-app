import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Languages,
  Mic2,
} from "lucide-react";

import { HeroWordIllustration } from "@/components/hero-word-illustration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { jsonLd, publicMetadata, SITE_URL } from "@/lib/seo";

const a1WordsHref = "/english/a1";
const learnHref = "/learn?level=A1&unit=1";

/** Copy lives in `messages/*.json`; only the icon and the tile colour live here. */
const features = [
  { key: "Words", icon: BookOpen, block: "var(--accent-sky)" },
  { key: "Meaning", icon: Languages, block: "var(--accent-mint)" },
  { key: "Pronunciation", icon: Mic2, block: "var(--accent-sun)" },
  { key: "Review", icon: Brain, block: "var(--accent-grape)" },
] as const;

const steps = ["flowStep1", "flowStep2", "flowStep3", "flowStep4"] as const;

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
        <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-6 lg:px-8">
          <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-8">
              <div className="space-y-5">
                {/* Solid, not translucent: white-on-white/25 measured 3.2:1. */}
                <Badge className="rounded-full border-0 bg-white px-4 py-1.5 text-sm font-bold text-brand hover:bg-white">
                  {t("heroBadge")}
                </Badge>

                <div className="space-y-4">
                  <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                    {t("heroTitleStart")}{" "}
                    <span className="text-accent-sun drop-shadow-sm">
                      {t("heroTitleHighlight")}
                    </span>{" "}
                    {t("heroTitleEnd")}
                  </h1>

                  <p className="max-w-2xl text-lg leading-8 text-white">
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

              <div className="grid max-w-2xl gap-3 text-sm sm:grid-cols-3">
                {["heroStatWords", "heroStatLevel", "heroStatThai"].map((key) => (
                  <div
                    key={key}
                    className="rounded-2xl border-3 border-ink bg-white px-4 py-3 font-bold text-ink"
                  >
                    {t(key)}
                  </div>
                ))}
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
              <Badge className="rounded-full border-3 border-ink bg-accent-mint text-sm font-bold text-ink hover:bg-accent-mint">
                {t("featuresBadge")}
              </Badge>

              <h2 className="mt-4 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("featuresTitle")}
              </h2>
            </div>

            <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">
              {t("featuresBody")}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <Card
                  key={feature.key}
                  className="play-tile rounded-[28px] border-0"
                  style={{ "--tile-block": feature.block } as React.CSSProperties}
                >
                  <CardHeader>
                    <div className="mb-2 flex size-12 items-center justify-center rounded-2xl border-3 border-ink bg-brand text-white">
                      <Icon className="size-5" />
                    </div>

                    <CardTitle className="text-lg">
                      {t(`feature${feature.key}Title`)}
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t(`feature${feature.key}Body`)}
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
            <Badge className="rounded-full border-0 bg-brand text-sm font-bold text-white hover:bg-brand">
              {t("flowBadge")}
            </Badge>

            <h2 className="max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("flowTitle")}
            </h2>

            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              {t("flowBody")}
            </p>

            <Button
              asChild
              className="play-press rounded-full bg-brand px-6 text-white hover:bg-brand"
            >
              <Link href={learnHref}>
                {t("flowCta")}
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
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-3 border-ink bg-accent-sun text-sm font-extrabold text-ink">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <p className="font-medium">{t(step)}</p>
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
