"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/language-switcher";
import { UserNavbar } from "@/components/user-navbar";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * One shell for the whole app (SPEC §6).
 *
 * Before this there were three navigation patterns across four pages, plus a
 * `fixed top-4 right-4` account widget floating over every one of them — it overlapped
 * the landing page's own header, sat on top of the FAQ hero, and appeared in the corner
 * of the sign-in page offering to sign you in.
 *
 * Two rules decide where the bar appears:
 *
 * - **Sessions are immersive.** A lesson or a quiz shows no navigation; the only way out
 *   is the in-page back control, so nothing competes with the answer buttons.
 * - **Auth screens are a single task.** The bar would offer "log in" to someone already
 *   on the login form.
 */
const HIDDEN_ON = [/^\/learn/, /^\/quiz/, /^\/auth\//];

export function AppBar({ locale }: { locale: string }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  if (HIDDEN_ON.some((pattern) => pattern.test(pathname))) return null;

  const links = [
    { href: "/english/a1", label: t("words"), match: /^\/english/ },
    { href: "/learn?level=A1&unit=1", label: t("learn"), match: /^\/learn/ },
    { href: "/quiz?level=A1&unit=1", label: t("quiz"), match: /^\/quiz/ },
    { href: "/review", label: t("review"), match: /^\/review/ },
  ];

  const navLink = (
    link: (typeof links)[number],
    extra: string,
  ) => {
    const isActive = link.match.test(pathname);

    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "play-underline play-focus font-bold whitespace-nowrap",
          isActive ? "text-brand" : "text-ink",
          extra,
        )}
      >
        {link.label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b-3 border-ink bg-card">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="play-lift play-focus flex shrink-0 items-center gap-2"
        >
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-2xl border-3 border-ink bg-brand text-white"
          >
            <Sparkles className="size-5" />
          </span>

          <span className="hidden sm:block">
            <span className="block text-sm font-extrabold leading-tight">
              {t("brand")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("tagline")}
            </span>
          </span>
        </Link>

        <nav
          aria-label={t("brand")}
          className="mx-auto hidden items-center gap-6 text-sm md:flex"
        >
          {links.map((link) => navLink(link, ""))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2 md:ml-0">
          <LanguageSwitcher />
          <UserNavbar locale={locale} />
        </div>
      </div>

      {/*
        Mobile keeps the same links rather than hiding them behind a menu: this audience
        is on a phone by default (SPEC §6.1), and a burger would bury the only routes the
        app has. The row scrolls sideways instead of wrapping the bar to two tall lines.
      */}
      <nav
        aria-label={t("brand")}
        className="flex items-center gap-5 overflow-x-auto border-t border-border px-4 py-2 text-sm md:hidden"
      >
        {links.map((link) => navLink(link, "py-1"))}
      </nav>
    </header>
  );
}
