"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const locales = [
  { label: "EN", value: "en" },
  { label: "TH", value: "th" },
];

/**
 * Announcing a locale link in the language it leads to, not the one the page is in — so
 * "TH" is not read out with English phonology to a Thai speaker, and vice versa. `lang`
 * does the announcing; `hrefLang` states the relationship. Both chips get both: only the
 * English one carried `hrefLang` before, and neither carried `lang`.
 */
const LANG_TAG: Record<string, string> = { en: "en", th: "th" };

/**
 * A segmented control, in two tones.
 *
 * `onColor` is for the ink-tier hero bands (brand, grape, deep-sky); `onSurface` is for
 * the app bar and anything on the warm canvas. The old single design was built for a
 * dark chrome that no longer exists: `text-zinc-300` on a `bg-white/5` track measured
 * 2.0:1 on the blue hero and vanished entirely on the light one.
 */
export function LanguageSwitcher({
  tone = "onSurface",
}: {
  tone?: "onColor" | "onSurface";
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const onColor = tone === "onColor";

  return (
    <div
      aria-label={t("language")}
      className={cn(
        "flex items-center gap-1 rounded-full p-1",
        onColor ? "bg-ink/25" : "bg-brand-soft",
      )}
    >
      {/* Decoration, and the first thing to go when the bar is 390px wide. */}
      <span
        aria-hidden
        className={cn(
          "hidden size-7 items-center justify-center sm:flex",
          onColor ? "text-white" : "text-brand",
        )}
      >
        <Languages className="size-4" />
      </span>

      {locales.map((item) => {
        const isActive = locale === item.value;

        return (
          <Link
            key={item.value}
            href={pathname}
            locale={item.value}
            lang={LANG_TAG[item.value]}
            hrefLang={LANG_TAG[item.value]}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "play-lift play-focus flex min-h-11 items-center rounded-full px-2.5 text-sm font-bold transition-colors sm:px-3",
              isActive && onColor && "bg-white text-brand",
              isActive && !onColor && "bg-brand text-white",
              // The inactive chip stays readable in its own right — it is a link, not a
              // placeholder. Hover deepens it rather than revealing it.
              !isActive && onColor && "text-white hover:bg-white/25",
              !isActive && !onColor && "text-ink hover:bg-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
