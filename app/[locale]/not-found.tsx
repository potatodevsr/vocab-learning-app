import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function LocaleNotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex min-h-screen items-center justify-center bg-accent-deep-sky px-6 text-white">
      <div className="w-full max-w-md text-center" data-testid="not-found">
        <p className="text-sm font-bold text-white">{t("code")}</p>
        <h1 className="mt-2 text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-white">{t("body")}</p>

        <Button
          asChild
          className="play-press mt-6 h-11 rounded-full bg-white px-6 font-semibold text-brand hover:bg-white"
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
