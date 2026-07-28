"use client";

import { Languages } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

const locales = [
  { label: "EN", value: "en" },
  { label: "TH", value: "th" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-sm text-zinc-300">
      <div className="flex size-7 items-center justify-center text-zinc-400 sm:size-8">
        <Languages className="size-4" />
      </div>

      {locales.map((item) => {
        const isActive = locale === item.value;

        return (
          <Link
            key={item.value}
            href={pathname}
            locale={item.value}
            className={
              isActive
                ? "rounded-full bg-white px-2.5 py-1 font-semibold text-brand sm:px-3 sm:py-1.5"
                : "rounded-full px-2.5 py-1 hover:bg-white/10 hover:text-white sm:px-3 sm:py-1.5"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
