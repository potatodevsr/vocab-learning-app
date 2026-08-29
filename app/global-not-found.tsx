import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Noto_Sans_Thai } from "next/font/google";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";

import "./globals.css";

/**
 * The 404 for a URL that matches no route at all.
 *
 * `app/[locale]/not-found.tsx` cannot serve these. `not-found.tsx` renders when
 * `notFound()` is thrown *inside a segment that matched*, and this app's root layout is
 * `app/[locale]/layout.tsx` — a top-level dynamic segment. Next's own docs name that as
 * the case where "you can't build a 404 page using a combination of `layout.js` and
 * `not-found.js`", and point here.
 *
 * Until this file existed, `/en/english/c3`, a non-numeric unit, and every other shape
 * `middleware.ts` rejects were answered with Next's built-in 404: unstyled, untranslated,
 * English — to an audience the whole product exists to serve in Thai. It was a correct
 * status code wrapped around the wrong page, and it broke `AGENTS.md` rule 3 on the one
 * surface nobody was looking at.
 *
 * This route bypasses the layout by design, so everything the layout would have provided
 * has to be repeated here: the stylesheet, the fonts, `<html>` and `<body>`. Only the two
 * font families this page can actually use are loaded — the mono face has no caller here,
 * and `next/font` preloads whatever is declared.
 */

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const notoSansThai = Noto_Sans_Thai({
    variable: "--font-noto-sans-thai",
    subsets: ["thai"],
    display: "swap",
});

/**
 * Which language to apologise in.
 *
 * `middleware.ts` sets `x-app-locale` on the rewrite it issues for a rejected URL, because
 * this route has no `[locale]` segment to read. Anything that reaches here without one —
 * a request that never passed through middleware — falls back to the routing default,
 * which is Thai (`i18n/routing.ts`), the primary audience.
 */
const resolveLocale = async () => {
    const header = (await headers()).get("x-app-locale");

    return routing.locales.includes(header as (typeof routing.locales)[number])
        ? (header as (typeof routing.locales)[number])
        : routing.defaultLocale;
};

export async function generateMetadata(): Promise<Metadata> {
    const locale = await resolveLocale();
    const t = await getTranslations({ locale, namespace: "NotFound" });

    return {
        title: t("title"),
        robots: { index: false, follow: true },
    };
}

export default async function GlobalNotFound() {
    const locale = await resolveLocale();
    const t = await getTranslations({ locale, namespace: "NotFound" });

    return (
        <html
            lang={locale}
            className={`${geistSans.variable} ${notoSansThai.variable}`}
        >
            <body className="antialiased">
                {/* Deliberately the same body, testid and copy as the in-segment
                    `app/[locale]/not-found.tsx`: a reader should not be able to tell which
                    of the two answered them. */}
                <main className="flex min-h-screen items-center justify-center bg-accent-deep-sky px-6 text-white">
                    <div className="w-full max-w-md text-center" data-testid="not-found">
                        <p
                            aria-hidden
                            className="play-outline-word play-display"
                            style={{ ["--outline-color" as string]: "#fff" }}
                        >
                            {t("code")}
                        </p>

                        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
                            {t("title")}
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-white">{t("body")}</p>

                        {/* A plain anchor, not `next/link`: this document is outside the
                            app's router tree, so a client-side navigation from here has no
                            router to hand off to. */}
                        <a
                            href={`/${locale}`}
                            className="play-key mt-8 inline-flex h-14 items-center rounded-2xl bg-accent-sun px-7 text-base font-extrabold text-ink hover:bg-accent-sun"
                        >
                            {t("cta")}
                        </a>
                    </div>
                </main>
            </body>
        </html>
    );
}
