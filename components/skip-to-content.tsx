import { getTranslations } from "next-intl/server";

/**
 * The first focusable element on every page.
 *
 * Without it a keyboard or switch user tabs through the logo, the locale toggle, both
 * account buttons and up to four navigation links — on every page, before reaching any
 * content. The app bar renders those links twice (a desktop row and a mobile row), so the
 * real cost was closer to a dozen stops.
 *
 * It stays out of the visual design by sitting off-screen until focused, which is the one
 * pattern screen-reader users and sighted keyboard users both expect.
 */
export async function SkipToContent() {
  const t = await getTranslations("Nav");

  return (
    <a
      href="#main"
      className="sr-only rounded-full border-3 border-ink bg-card px-4 py-2 font-bold text-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100]"
    >
      {t("skipToContent")}
    </a>
  );
}
