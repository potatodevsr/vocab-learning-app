import { safeReturnPath } from "@/lib/return-path";

/** Preserve learner navigation state, never auth tokens or arbitrary query parameters. */
export function localeHref(pathname: string, search: string, locale: string): string {
  const source = new URLSearchParams(search);
  const target = new URLSearchParams();
  for (const key of ["q", "level", "unit", "mode"]) {
    const value = source.get(key);
    if (value !== null) target.set(key, value);
  }
  const from = source.get("from");
  if (from !== null) {
    const safe = safeReturnPath(from, locale);
    const localized = /^\/(en|th)(\/|\?|#|$)/.test(safe)
      ? safe.replace(/^\/(en|th)/, `/${locale}`)
      : `/${locale}${safe}`;
    target.set("from", safeReturnPath(localized, locale));
  }
  const query = target.toString();
  return `/${locale}${pathname === "/" ? "" : pathname}${query ? `?${query}` : ""}`;
}
