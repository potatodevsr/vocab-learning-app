import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/**
 * SEO plumbing (docs/SPEC.md §9).
 *
 * The governing rule: **public content is indexable, anything personal is `noindex`.**
 * Every page picks a side explicitly — there is no safe default when a learner's profile
 * and a dictionary entry live in the same app.
 */

export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export type Locale = (typeof routing.locales)[number];

/** `/en/english/a1` — locale-prefixed absolute path. */
export const localePath = (locale: string, path = "") => {
    const clean = path.replace(/^\//, "");
    return clean ? `/${locale}/${clean}` : `/${locale}`;
};

export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;

/**
 * Canonical + hreflang for one logical page.
 *
 * Without these the `en` and `th` renderings of the same word compete with each other,
 * and Google picks a winner we did not choose.
 */
export const alternatesFor = (locale: string, path = ""): Metadata["alternates"] => {
    const languages: Record<string, string> = {};

    for (const other of routing.locales) {
        languages[other] = absoluteUrl(localePath(other, path));
    }

    languages["x-default"] = absoluteUrl(
        localePath(routing.defaultLocale, path),
    );

    return {
        canonical: absoluteUrl(localePath(locale, path)),
        languages,
    };
};

/** Metadata for a public, indexable page. */
export const publicMetadata = ({
    locale,
    path = "",
    title,
    description,
}: {
    locale: string;
    path?: string;
    title: string;
    description: string;
}): Metadata => ({
    title,
    description,
    alternates: alternatesFor(locale, path),
    robots: { index: true, follow: true },
    openGraph: {
        type: "website",
        title,
        description,
        url: absoluteUrl(localePath(locale, path)),
        locale,
        siteName: "Vocab Learning",
    },
    twitter: { card: "summary_large_image", title, description },
});

/**
 * Metadata for anything personal or transactional. `noindex, nofollow` and no canonical —
 * a learner's mistakes bank must never be a search result.
 */
export const privateMetadata = (title: string): Metadata => ({
    title,
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
});

/** JSON-LD helper — returns the props for a `<script type="application/ld+json">`. */
export const jsonLd = (data: Record<string, unknown>) => ({
    type: "application/ld+json" as const,
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
});
