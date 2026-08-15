import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { RegisterForm } from "@/components/auth/register-form";
import { safeReturnPath } from "@/lib/return-path";
import { LanguageSwitcher } from "@/components/language-switcher";
import { privateMetadata } from "@/lib/seo";

type RegisterPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

/** Its own title — see the note on the login page. */
export async function generateMetadata({ params }: RegisterPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return privateMetadata(t("registerTitle"), locale, "auth/register");
}

/**
 * Server wrapper so the return target is resolved once, server-side, from the awaited
 * `searchParams` Promise (Next 16) — never read from `window.location.search` in a
 * client `useEffect`, which needed a lint-suppressed post-mount `setState` just to avoid
 * a hydration mismatch. `safeReturnPath` runs here, so `RegisterForm` only ever receives
 * an already-validated destination, not the raw attacker-controllable query value.
 */
export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const { locale } = await params;
  const t = await getTranslations("Auth");
  const { from: rawFrom } = await searchParams;
  const raw = Array.isArray(rawFrom) ? rawFrom[0] : rawFrom;
  const from = raw ? safeReturnPath(raw, locale) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand px-4">
      <div className="w-full max-w-md">
        {/*
          The app bar is hidden on auth screens, so this row is the only way back out —
          and the only place to change language. Without the switcher, a Thai speaker who
          followed a shared `/en/auth/register` link had no way to reach the Thai form
          except by leaving the flow entirely.
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

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">{t("registerTitle")}</h1>
          <p className="mt-2 text-sm text-white">{t("registerSubtitle")}</p>
        </div>

        <RegisterForm from={from} />
      </div>
    </div>
  );
}
