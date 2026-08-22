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
import { WordTicker } from "@/components/word-ticker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  absoluteUrl,
  jsonLd,
  localePath,
  publicMetadata,
  ORGANISATION_ID,
  OXFORD_3000_TERMSET_ID,
  SITE_URL,
  WEBSITE_ID,
} from "@/lib/seo";
import { resolveLearnerMode } from "@/lib/learner-mode";
import { TrackPageView } from "@/components/track-page-view";

/**
 * The marketing home page, as a component rather than a route.
 *
 * `/[locale]` used to render this inline and read `cookies()` first, to decide whether a
 * signed-in learner should see their Today card instead (docs/LEARNER-LIFECYCLE.md
 * §8 L2). Reading a cookie makes a route dynamic, so every anonymous visitor and every
 * crawler paid a full server render of ~140 KB of HTML — measured at 327–714 ms of Worker
 * CPU — for a page that is identical for all of them.
 *
 * The session branch now happens in `middleware.ts`, which rewrites a signed-in request
 * for `/[locale]` to `/[locale]/today`. The URL the learner sees is unchanged; what
 * changed is that this render is cacheable and that one is not. `/[locale]/today` falls
 * back to this same component when the API declines to produce a summary, so the two
 * branches stay the single page they always were.
 */

const a1WordsHref = "/english/a1";
// A visitor's first CTA must be playable with no account
// (docs/LEARNER-LIFECYCLE.md §0, §3.1) — `/learn` is behind auth and was the highest-
// leverage acquisition defect the funnel audit found.
const practiceHref = "/english/a1/practice";

/** Copy lives in `messages/*.json`; the tile keeps its colour and the ink that
    colour can carry — grape is dark enough to need white, the rest take ink. */
const features = [
  { key: "Words", icon: BookOpen, block: "var(--accent-sky)", ink: "var(--ink)" },
  { key: "Meaning", icon: Languages, block: "var(--accent-mint)", ink: "var(--ink)" },
  { key: "Pronunciation", icon: Mic2, block: "var(--accent-sun)", ink: "var(--ink)" },
  { key: "Review", icon: Brain, block: "var(--accent-grape)", ink: "oklch(1 0 0)" },
] as const;

const steps = ["flowStep1", "flowStep2", "flowStep3", "flowStep4"] as const;

/**
 * The `<head>` for `/`, shared by both routes that can answer it.
 *
 * A rewrite keeps the URL, so `/[locale]/today` must describe `/` — same canonical, same
 * title, same OG card — or a signed-in learner's tab and share card would disagree with
 * the page they are on. `index` is the only thing that differs: the marketing render is
 * the indexable one, and `/[locale]/today` reached directly is not.
 */
export async function homeMetadata({
  locale,
  index = true,
}: {
  locale: string;
  index?: boolean;
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Home" });

  return publicMetadata({
    locale,
    title: `${t("heroTitleStart")} ${t("heroTitleHighlight")}`,
    description: t("heroDescription"),
    index,
  });
}

export async function MarketingHome({ locale }: { locale: string }) {
  const t = await getTranslations("Home");
  const mode = resolveLearnerMode(locale);

  return (
    <>
      <TrackPageView family="home" locale={locale} />
      {/*
        The entity graph: publisher, site, and the word list itself, each with a stable
        `@id` that the rest of the site references rather than restates.

        The comment above this block used to promise "WebSite + EducationalOrganization"
        and only the organisation was ever emitted — with no `logo` and no `sameAs`, so
        there was nothing to tie the brand to anything outside this domain, and no node
        for the ~5,600 word pages to point at when they claimed membership of the Oxford
        3000. `potentialAction`/`SearchAction` is deliberately absent: there is no site
        search to point it at, and declaring one that does not exist is worse than none.
      */}
      <script
        {...jsonLd({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "EducationalOrganization",
              "@id": ORGANISATION_ID,
              name: "Vocab Learning",
              url: SITE_URL,
              description: t("heroDescription"),
              logo: {
                "@type": "ImageObject",
                url: absoluteUrl("/icon-512.png"),
                width: 512,
                height: 512,
              },
              image: absoluteUrl("/og.png"),
            },
            {
              "@type": "WebSite",
              "@id": WEBSITE_ID,
              url: SITE_URL,
              name: "Vocab Learning",
              description: t("heroDescription"),
              inLanguage: ["th", "en"],
              publisher: { "@id": ORGANISATION_ID },
            },
            {
              "@type": "DefinedTermSet",
              "@id": OXFORD_3000_TERMSET_ID,
              name: "Oxford 3000",
              description: t("heroDescription"),
              url: absoluteUrl(localePath(locale, "english/words")),
              inLanguage: "en",
              publisher: { "@id": ORGANISATION_ID },
            },
          ],
        })}
      />
    <main className="min-h-screen bg-background text-foreground">
      {/*
        The hero is one poster: a kicker, a headline with the accent phrase set in a
        highlighter block rather than in a colour that fails on blue, two actions, and
        three claims a visitor can check. The illustration sits under the type on a
        phone, beside it on a desk — the same content, re-ordered, not a second layout.
      */}
      <section className="border-b-3 border-ink bg-brand text-white">
        {/*
          Vertical rhythm is halved below `sm`. The desktop hero can afford 80px of
          padding above the kicker and a 48px grid gap; a 390×844 phone cannot — that
          alone was 128px of the space the primary CTA needed to clear the fold.
        */}
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 sm:gap-12 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <span className="play-stamp bg-accent-sun px-4 py-1.5 text-sm font-extrabold text-ink">
              {t("heroKicker")}
            </span>

            <h1 className="play-display mt-4 sm:mt-6">
              {t("heroLead")}{" "}
              <span className="play-highlight">{t("heroHighlight")}</span>{" "}
              {t("heroTrail")}
            </h1>

            <p className="mt-4 max-w-xl text-base leading-7 text-white sm:mt-6 sm:text-lg sm:leading-8">
              {t("heroDescription")}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="play-key h-14 rounded-2xl bg-accent-sun px-7 text-base font-extrabold text-ink hover:bg-accent-sun"
              >
                <Link href={a1WordsHref}>
                  {t("exploreA1Words")}
                  <ArrowRight className="size-5" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="play-key h-14 rounded-2xl border-white bg-transparent px-7 text-base font-extrabold text-white hover:bg-white/15 hover:text-white"
              >
                <Link href={practiceHref} data-testid="home-practice-cta">{t("howLearningWorks")}</Link>
              </Button>
            </div>

            {/*
              The third door, and the quietest on purpose.

              "Which level am I?" is the question that stops a first-time visitor from
              starting at all, and until now the only page that answered it was reachable
              from the footer. It sits under the two primary CTAs rather than beside them:
              a visitor who already knows where to start should not be handed a test.
            */}
            <p className="mt-4 text-sm">
              {/*
                Full white, not `white/90`. On `--brand` that opacity composites to 4.31:1
                and fails AA at this size — `hover-states.spec` measured it against the
                painted backdrop and refused the build.

                The hover feedback is the *underline* going from half-opacity to solid, so
                the text colour never moves and the contrast measured above cannot move
                with it. Thickness alone was not enough: `readState` in
                `e2e/support/interaction.ts` watches `textDecorationColor` and not
                `textDecorationThickness`, so a heavier-underline hover read as "hover
                changes nothing".
              */}
              <Link
                href="/english/test"
                data-testid="home-level-test"
                className="font-semibold text-white underline decoration-white/50 decoration-2 underline-offset-4 hover:decoration-white"
              >
                {t("levelTestCta")}
              </Link>
            </p>

            {/* Three claims, each one checkable on the site itself. */}
            <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3 sm:mt-10">
              {[
                { value: t("proofWords"), label: t("proofWordsLabel"), tilt: "-1.5deg" },
                { value: t("proofMinutes"), label: t("proofMinutesLabel"), tilt: "1deg" },
                { value: t("proofFree"), label: t("proofFreeLabel"), tilt: "-0.5deg" },
              ].map((proof) => (
                <div
                  key={proof.label}
                  className="play-sticker p-4 text-ink [--tile-block:var(--ink)]"
                  style={{ transform: `rotate(${proof.tilt})` }}
                >
                  <dt className="text-2xl font-extrabold tracking-tight">
                    {proof.value}
                  </dt>
                  <dd className="mt-1 text-xs font-medium leading-4 text-muted-foreground">
                    {proof.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <HeroWordIllustration mode={mode} />
        </div>
      </section>

      <WordTicker />

      {/* Features: four stickers, each with its own colour, each tilted a hair
          differently so the row reads as objects placed by hand. */}
      <section className="bg-background">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 sm:gap-10 sm:py-20 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <span className="play-stamp bg-accent-mint px-4 py-1.5 text-sm font-extrabold text-ink">
                {t("featuresBadge")}
              </span>

              <h2 className="mt-5 max-w-xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                {t("featuresTitle")}
              </h2>
            </div>

            <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">
              {t("featuresBody")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <Card
                  key={feature.key}
                  className="play-tile gap-0 rounded-[28px] border-0 p-6"
                  style={
                    {
                      "--tile-block": feature.block,
                      "--tile-tilt": `${index % 2 === 0 ? "-0.8deg" : "0.8deg"}`,
                    } as React.CSSProperties
                  }
                >
                  <CardHeader className="p-0">
                    <div
                      className="mb-4 flex size-14 items-center justify-center rounded-2xl border-3 border-ink"
                      style={{ background: feature.block, color: feature.ink }}
                    >
                      <Icon className="size-6" />
                    </div>

                    <CardTitle className="text-lg font-extrabold">
                      {t(`feature${feature.key}Title`)}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-0">
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t(`feature${feature.key}Body`)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* The loop, drawn as the path it is: four numbered nodes on one ink rule.
          This is the product's core metaphor, so it is a picture, not a list. */}
      <section className="border-y-3 border-ink bg-accent-mint">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <span className="play-stamp bg-white px-4 py-1.5 text-sm font-extrabold text-ink">
              {t("pathBadge")}
            </span>

            <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {t("pathTitle")}
            </h2>

            <p className="mt-4 text-base leading-7 text-ink/80">{t("pathBody")}</p>
          </div>

          <ol className="relative mt-8 grid gap-6 sm:mt-12 md:grid-cols-4">
            {/* The rule the nodes sit on. Decorative: the ordered list carries the
                sequence for anyone not looking at it. */}
            <div
              aria-hidden
              className="absolute left-7 right-7 top-7 hidden h-1 rounded-full bg-ink/40 md:block"
            />

            {steps.map((step, index) => (
              <li key={step} className="relative">
                <span className="relative z-10 flex size-14 items-center justify-center rounded-2xl border-3 border-ink bg-white text-lg font-extrabold text-ink">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <p className="mt-4 text-base font-semibold leading-6 text-ink">
                  {t(step)}
                </p>
              </li>
            ))}
          </ol>

          <Button
            asChild
            size="lg"
            className="play-key mt-12 h-14 rounded-2xl bg-brand px-7 text-base font-extrabold text-white hover:bg-brand"
          >
            <Link href={practiceHref} data-testid="home-practice-cta-bottom">
              {t("flowCta")}
              <ArrowRight className="size-5" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
    </>
  );
}
