"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Every page used to simply stop. A footer is where a learner who scrolled to the
 * bottom finds the next thing to do, and where the levels the app actually covers are
 * linked for a crawler that arrived on one word page (SPEC §9.2 — no orphans).
 *
 * Hidden wherever the app bar is hidden, for the same reasons: a lesson is immersive,
 * and an auth screen is a single task.
 */
const HIDDEN_ON = [/^\/learn/, /^\/quiz/, /^\/auth\//];

const LEVELS = ["a1", "a2", "b1", "b2"] as const;

/**
 * Content and trust surfaces reachable from every page.
 *
 * These pages all existed and all shipped in the sitemap, but nothing in the UI linked
 * them: a crawl from the homepage reached 229 URLs and none of these were among them.
 * `/english` and `/english/words` are the content root and the A–Z index — the two hubs
 * SEO-CONTENT.md §5 leans on to distribute signal into the word long tail — so leaving
 * them orphaned wasted the pages that link *out* of them, not just the pages themselves.
 */
const EXPLORE = [
  { href: "/english", key: "englishHub" },
  { href: "/english/words", key: "allWords" },
  { href: "/thai-alphabet", key: "thaiAlphabet" },
] as const;

const ABOUT = [
  { href: "/about", key: "about" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/contact", key: "contact" },
] as const;

/** Legal + the HTML sitemap, which is itself the hub for everything above. */
const LEGAL = [
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
  { href: "/sitemap", key: "sitemap" },
] as const;

export function SiteFooter() {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const tFooter = useTranslations("Footer");

  if (HIDDEN_ON.some((pattern) => pattern.test(pathname))) return null;

  return (
    <footer className="border-t-3 border-ink bg-ink text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Link
            href="/"
            className="play-lift play-focus inline-flex items-center gap-2"
          >
            <span
              aria-hidden
              className="flex size-10 items-center justify-center rounded-2xl border-3 border-white bg-accent-sun text-ink"
            >
              <Sparkles className="size-5" />
            </span>
            <span className="text-lg font-extrabold">{t("brand")}</span>
          </Link>

          <p className="mt-4 max-w-sm text-sm leading-6 text-white/90">
            {tFooter("blurb")}
          </p>

          <div className="mt-6">
            <LanguageSwitcher tone="onColor" />
          </div>
        </div>

        <nav aria-label={tFooter("levelsHeading")}>
          <p className="text-sm font-bold uppercase tracking-widest text-accent-sun">
            {tFooter("levelsHeading")}
          </p>

          <ul className="mt-4 grid gap-2 text-sm">
            {LEVELS.map((level) => (
              <li key={level}>
                <Link
                  href={`/english/${level}`}
                  className="play-underline play-focus inline-flex min-h-11 items-center font-semibold"
                >
                  {tFooter("levelLink", { level: level.toUpperCase() })}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={tFooter("appHeading")}>
          <p className="text-sm font-bold uppercase tracking-widest text-accent-sun">
            {tFooter("appHeading")}
          </p>

          <ul className="mt-4 grid gap-2 text-sm">
            <li>
              <Link
                href="/learn?level=A1&unit=1"
                className="play-underline play-focus inline-flex min-h-11 items-center font-semibold"
              >
                {t("learn")}
              </Link>
            </li>
            <li>
              <Link
                href="/quiz?level=A1&unit=1"
                className="play-underline play-focus inline-flex min-h-11 items-center font-semibold"
              >
                {t("quiz")}
              </Link>
            </li>
            <li>
              <Link
                href="/review"
                className="play-underline play-focus inline-flex min-h-11 items-center font-semibold"
              >
                {t("review")}
              </Link>
            </li>
            <li>
              <Link
                href="/faq"
                className="play-underline play-focus inline-flex min-h-11 items-center font-semibold"
              >
                {tFooter("faq")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={tFooter("exploreHeading")}>
          <p className="text-sm font-bold uppercase tracking-widest text-accent-sun">
            {tFooter("exploreHeading")}
          </p>

          <ul className="mt-4 grid gap-2 text-sm">
            {EXPLORE.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="play-underline play-focus inline-flex min-h-11 items-center font-semibold"
                >
                  {tFooter(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={tFooter("aboutHeading")}>
          <p className="text-sm font-bold uppercase tracking-widest text-accent-sun">
            {tFooter("aboutHeading")}
          </p>

          <ul className="mt-4 grid gap-2 text-sm">
            {ABOUT.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="play-underline play-focus inline-flex min-h-11 items-center font-semibold"
                >
                  {tFooter(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 text-xs text-white/80 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>{tFooter("credit")}</p>

          <nav aria-label={tFooter("legalHeading")}>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LEGAL.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="play-underline play-focus inline-flex min-h-11 items-center font-semibold text-white"
                  >
                    {tFooter(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
