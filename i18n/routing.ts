import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
    locales: ["en", "th"],

    /**
     * Thai, not English.
     *
     * This decides three things at once: where bare `/` sends someone with no language
     * preference, what `x-default` points at, and which locale the app treats as the
     * canonical one. `en` was wrong on all three. AGENTS.md rule 3 is explicit that Thai
     * is the primary audience — and the two locales are not translations of each other,
     * they are different courses (`/th` teaches English to Thai speakers, `/en` teaches
     * Thai to English speakers), so the default is a product decision rather than a
     * formatting one. Sending unlabelled traffic to the smaller of the two courses was
     * costing us the audience the app was built for.
     */
    defaultLocale: "th",

    /**
     * No `NEXT_LOCALE` cookie.
     *
     * next-intl sets one on **every** response by default, which makes every response
     * `private` — Next emits `Cache-Control: private, no-cache, no-store, max-age=0,
     * must-revalidate` on every HTML page as a result, and nothing on the site can be
     * cached at Cloudflare's edge. With ~6,000 word URLs that is a Worker invocation and
     * a D1 read for every crawler hit, forever.
     *
     * Nothing needs the cookie: the locale is in the URL on every page (`localePrefix` is
     * `always`), the switcher links to explicit locale paths, and bare `/` can fall back
     * to `Accept-Language`.
     */
    localeCookie: false,

    /**
     * No automatic hreflang `Link:` header — `lib/seo.ts` emits the tags instead.
     *
     * next-intl built its `x-default` by stripping the locale segment, producing
     * unprefixed URLs like `/english/words/ability` that 307 straight back to a locale.
     * An hreflang target that redirects is not a valid target, and it disagreed with the
     * correct `<link rel="alternate">` set in the head — two different answers to the
     * same question on every one of ~6,000 URLs. The head tags are the ones we control
     * and test, so the header goes.
     */
    alternateLinks: false,
});
