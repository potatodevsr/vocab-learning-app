import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { RegisterForm } from "@/components/auth/register-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { privateMetadata } from "@/lib/seo";

type RegisterPageProps = {
  params: Promise<{ locale: string }>;
};

/** Its own title — see the note on the login page. */
export async function generateMetadata({ params }: RegisterPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return privateMetadata(t("registerTitle"), locale, "auth/register");
}

/** Static shell: the client form validates its optional return destination. */
export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale } = await params;
  const t = await getTranslations("Auth");

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
            prefetch={false}
            className="play-underline play-focus inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white"
          >
            <ArrowLeft className="size-4" />
            {t("backHome")}
          </Link>

          <LanguageSwitcher tone="onColor" prefetch={false} />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">{t("registerTitle")}</h1>
          <p className="mt-2 text-sm text-white">{t("registerSubtitle")}</p>
        </div>

        <Suspense fallback={null}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
