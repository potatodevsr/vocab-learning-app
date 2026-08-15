"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/language-switcher";
import { UserNavbar } from "@/components/user-navbar";
import { Link, usePathname } from "@/i18n/navigation";
import { useSession } from "@/lib/use-session";
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
  const { user, signedIn, clear } = useSession();

  if (HIDDEN_ON.some((pattern) => pattern.test(pathname))) return null;

  /**
   * `gated` links go behind the login wall.
   *
   * Shown to a logged-out visitor they were three dead ends: `/learn`, `/quiz` and
   * `/review` all 307 to the login form, they are all in `robots.txt`'s disallow list,
   * and Next prefetched every one of them on hover-free page load — so an anonymous
   * homepage visit fired ~23 server round-trips, several of them redirects into a login
   * page nobody asked for. Signed out, the bar now offers the two things that actually
   * work without an account.
   */
  const links = [
    { href: "/english/a1", label: t("words"), match: /^\/english/, gated: false },
    { href: "/english/a1/practice", label: t("tryFree"), match: /practice$/, gated: false },
    { href: "/learn?level=A1&unit=1", label: t("learn"), match: /^\/learn/, gated: true },
    { href: "/quiz?level=A1&unit=1", label: t("quiz"), match: /^\/quiz/, gated: true },
    { href: "/review", label: t("review"), match: /^\/review/, gated: true },
  ].filter((link) => !link.gated || signedIn);

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
        // `min-h-11` is 44px: the smallest target a finger reliably hits, and the floor
        // WCAG 2.2 sets. These links measured 35px tall. The padding grows the hit area
        // without changing how the row looks.
        className={cn(
          "play-underline play-focus flex min-h-11 items-center font-bold whitespace-nowrap",
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
        {/*
          The wordmark is hidden below `sm`, and the mark itself is `aria-hidden`, so on a
          phone this link used to contain nothing readable at all: no text, no label, no
          title. It is the first element in the tab order on every page, and it announced
          as nothing. An explicit label survives the breakpoint.
        */}
        <Link
          href="/"
          aria-label={t("homeLabel")}
          className="play-lift play-focus flex shrink-0 items-center gap-2"
        >
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-2xl border-3 border-ink bg-brand text-white"
          >
            <Sparkles className="size-5" />
          </span>

          <span aria-hidden className="hidden sm:block">
            <span className="block text-sm font-extrabold leading-tight">
              {t("brand")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("tagline")}
            </span>
          </span>
        </Link>

        <nav
          aria-label={t("sections")}
          className="mx-auto hidden items-center gap-6 text-sm md:flex"
        >
          {links.map((link) => navLink(link, ""))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2 md:ml-0">
          <LanguageSwitcher />
          <UserNavbar locale={locale} user={user} onSignedOut={clear} />
        </div>
      </div>

      {/*
        Mobile keeps the same links rather than hiding them behind a menu: this audience
        is on a phone by default (SPEC §6.1), and a burger would bury the only routes the
        app has. The row scrolls sideways instead of wrapping the bar to two tall lines.

        The two rows together measured 129px — 15% of an 844px viewport, permanently, on
        every page. Trimming this row and dropping the auth-gated links for signed-out
        visitors (see `links` above) is most of that back.
      */}
      <nav
        aria-label={t("sections")}
        className="flex items-center gap-5 overflow-x-auto border-t border-border px-4 text-sm md:hidden"
      >
        {links.map((link) => navLink(link, ""))}
      </nav>
    </header>
  );
}
