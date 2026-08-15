import { getLocale, getTranslations } from "next-intl/server";

import {
  absoluteUrl,
  jsonLd,
  localePath,
  ORGANISATION_ID,
  WEBSITE_ID,
} from "@/lib/seo";

/**
 * `WebPage` + `BreadcrumbList` for the standing pages — about, contact, how-it-works,
 * privacy, terms.
 *
 * All five shipped with no structured data at all, which is the worst place to have none:
 * they are exactly the pages a quality rater or an assistant reads to establish who is
 * behind a site making thousands of dictionary claims. Tying each one to the publisher
 * node costs nothing and closes that gap.
 *
 * Deliberately *not* `HowTo` for the how-it-works page. It looks like the obvious fit and
 * it is a trap — the type has produced no rich result since 2023, so it is markup that
 * only creates a maintenance obligation.
 */
export async function PageSchema({
  path,
  title,
  description,
  type = "WebPage",
}: {
  /** Locale-relative, no leading slash — matches `publicMetadata`'s `path`. */
  path: string;
  title: string;
  description: string;
  type?: "WebPage" | "AboutPage" | "ContactPage";
}) {
  // These pages render without params, so the locale comes from the request rather than
  // from a prop every caller would have to thread through.
  const locale = await getLocale();
  const tNav = await getTranslations("Nav");
  const url = absoluteUrl(localePath(locale, path));

  return (
    <script
      {...jsonLd({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": type,
            "@id": `${url}#page`,
            url,
            name: title,
            description,
            inLanguage: locale,
            isPartOf: { "@id": WEBSITE_ID },
            publisher: { "@id": ORGANISATION_ID },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: tNav("home"),
                item: absoluteUrl(localePath(locale)),
              },
              { "@type": "ListItem", position: 2, name: title },
            ],
          },
        ],
      })}
    />
  );
}
