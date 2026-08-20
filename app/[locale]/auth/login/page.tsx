import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { privateMetadata } from "@/lib/seo";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
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

/** Static shell: the client form validates query-dependent return and error state. */
export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params;
  const t = await getTranslations("Auth");

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

        {/* Query-dependent return/error state belongs to the client island. Keeping it
            out of this server page lets both locale variants be emitted once at build
            time instead of spending Worker CPU on every sign-in visit. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
