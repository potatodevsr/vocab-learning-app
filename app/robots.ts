import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

/**
 * Crawl rules (docs/SPEC.md §9.5). The disallow list is the same boundary `middleware.ts`
 * enforces: anything personal or internal. Keep the two in step — a route that needs a
 * login has no business in an index either.
 */
export default function robots(): MetadataRoute.Robots {
  // `/today` is the signed-in half of `/`, reached only by an internal rewrite from
  // `middleware.ts`. It is a protected path there, so it is a disallowed one here.
  const private_ = ["/learn", "/quiz", "/review", "/profile", "/progress", "/auth", "/today"];

  const disallow = [
    "/admin",
    "/api",
    ...private_,
    // The same routes under each locale prefix.
    ...private_.flatMap((path) => [`/en${path}`, `/th${path}`]),
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },

      /**
       * Assistant crawlers, named explicitly.
       *
       * The wildcard above already allows every one of these, so this changes no
       * behaviour — it states an intention. Without a named rule there is no way to tell
       * "we thought about AI crawlers and said yes" from "nobody looked", and no place to
       * decline a specific one later without rewriting the wildcard.
       *
       * These are the crawlers that put content in front of a reader and can cite us
       * back. A Thai learner asking an assistant "ability แปลว่าอะไร" is exactly the
       * query this site should be the answer to.
       */
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-User",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "Applebot-Extended",
        ],
        allow: "/",
        disallow,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl(""),
  };
}
