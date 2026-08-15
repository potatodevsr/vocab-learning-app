import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { safeReturnPath } from "@/lib/return-path";
import { LanguageSwitcher } from "@/components/language-switcher";
import { privateMetadata } from "@/lib/seo";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string | string[]; error?: string | string[] }>;
};

/**
 * Its own title, rather than the layout's shared "Account". Login and register produced
 * identical tabs and identical history entries; telling them apart mattered most to
 * exactly the person who had both open.
 */
export async function generateMetadata({ params }: LoginPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return privateMetadata(t("loginTitle"), locale, "auth/login");
}

/**
 * Server wrapper so the return target is resolved once, server-side, from the awaited
 * `searchParams` Promise (Next 16) — never read from `window.location.search` in a
 * client `useEffect`, which needed a lint-suppressed post-mount `setState` just to avoid
 * a hydration mismatch. `safeReturnPath` runs here, so `LoginForm` only ever receives an
 * already-validated destination, not the raw attacker-controllable query value.
 */
export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  const t = await getTranslations("Auth");
  const { from: rawFrom, error: rawError } = await searchParams;
  const raw = Array.isArray(rawFrom) ? rawFrom[0] : rawFrom;
  const from = raw ? safeReturnPath(raw, locale) : null;
  /**
   * The Google callback bounces here on any failure, deliberately without saying which
   * check rejected it (see `google-auth.ts`) — naming the failing check would tell an
   * attacker which half of the handshake to work on.
   *
   * `google_unavailable` is the one case worth distinguishing, because it is not a
   * failure the visitor can do anything about: no OAuth credentials are configured, so
   * the button could never have worked. Saying "try again" there would be a lie.
   */
  const errorCode = Array.isArray(rawError) ? rawError[0] : rawError;
  const googleFailed = errorCode === "google";
  const googleUnavailable = errorCode === "google_unavailable";

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand px-4">
      <div className="w-full max-w-md">
        {/*
          The app bar is hidden on auth screens, so this row is the only way back out —
          and the only place to change language. Without the switcher, a Thai speaker who
          followed a shared `/en/auth/login` link had no way to reach the Thai form except
          by leaving the flow entirely.
        */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href={`/${locale}`}
            className="play-underline play-focus inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white"
          >
            <ArrowLeft className="size-4" />
            {t("backHome")}
          </Link>

          <LanguageSwitcher tone="onColor" />
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">{t("magicTitle")}</h1>
          <p className="mt-2 text-sm text-white">{t("magicSubtitle")}</p>
        </div>

        <LoginForm
          from={from}
          googleFailed={googleFailed}
          googleUnavailable={googleUnavailable}
        />
      </div>
    </div>
  );
}
