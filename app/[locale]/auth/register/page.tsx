import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { RegisterForm } from "@/components/auth/register-form";
import { safeReturnPath } from "@/lib/return-path";

type RegisterPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

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
        {/* The app bar is hidden on auth screens, so this is the only way back out. */}
        <Link
          href={`/${locale}`}
          className="play-underline play-focus mb-6 inline-flex items-center gap-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="size-4" />
          {t("backHome")}
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">{t("registerTitle")}</h1>
          <p className="mt-2 text-sm text-white">{t("registerSubtitle")}</p>
        </div>

        <RegisterForm from={from} />
      </div>
    </div>
  );
}
