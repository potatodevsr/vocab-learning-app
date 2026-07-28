import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

/**
 * Crawl rules (docs/SPEC.md §9.5). The disallow list is the same boundary `proxy.ts`
 * enforces: anything personal or internal. Keep the two in step — a route that needs a
 * login has no business in an index either.
 */
export default function robots(): MetadataRoute.Robots {
  const private_ = ["/learn", "/quiz", "/review", "/profile", "/auth"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          ...private_,
          // The same routes under each locale prefix.
          ...private_.flatMap((path) => [`/en${path}`, `/th${path}`]),
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl(""),
  };
}
