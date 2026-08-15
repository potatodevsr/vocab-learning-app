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
    /*
      Every box style is on the `focus:` variant, and none on the base.

      `sr-only` works by collapsing the element to a 1x1 clipped box with `padding: 0`.
      Putting `px-4 py-2 border-3` alongside it re-inflated that box — same specificity,
      later in the cascade — so the link stayed invisible but occupied real space under
      the header. The hover sweep in `e2e/hover-states.spec.ts` then found a control it
      could not reach and failed every public page with "covered by another element".
      An `sr-only` element must actually be 1x1 until it is focused.
    */
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:border-3 focus:border-ink focus:bg-card focus:px-4 focus:py-2 focus:font-bold focus:text-ink"
    >
      {t("skipToContent")}
    </a>
  );
}
