import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function LocaleNotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex min-h-screen items-center justify-center bg-accent-deep-sky px-6 text-white">
      <div className="w-full max-w-md text-center" data-testid="not-found">
        {/* The code, set as an outline, is the whole illustration — no payload. */}
        <p aria-hidden className="play-outline-word play-display text-white">
          {t("code")}
        </p>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-white">{t("body")}</p>

        <Button
          asChild
          className="play-key mt-8 h-14 rounded-2xl bg-accent-sun px-7 text-base font-extrabold text-ink hover:bg-accent-sun"
        >
          <Link href="/english/a1">
            <ArrowLeft className="size-4" />
            {t("cta")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
