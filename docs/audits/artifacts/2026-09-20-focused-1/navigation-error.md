# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation-continuity.spec.ts >> locale switching keeps search and header authentication intent
- Location: e2e/navigation-continuity.spec.ts:3:5

# Error details

```
Error: locator.click: Error: strict mode violation: getByRole('link', { name: 'TH', exact: true }) resolved to 2 elements:
    1) <a lang="th" hreflang="th" href="/th/english/search" class="play-lift play-focus flex min-h-11 items-center rounded-full px-2 text-sm font-bold transition-colors sm:px-3 text-ink hover:bg-white">TH</a> aka getByRole('banner').getByRole('link', { name: 'TH', exact: true })
    2) <a lang="th" hreflang="th" href="/th/english/search" class="play-lift play-focus flex min-h-11 items-center rounded-full px-2 text-sm font-bold transition-colors sm:px-3 text-white hover:bg-[color-mix(in_oklab,var(--ink)_55%,var(--brand))]">TH</a> aka getByRole('contentinfo').getByRole('link', { name: 'TH', exact: true })

Call log:
  - waiting for getByRole('link', { name: 'TH', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "Vocab Learning — home" [ref=e5] [cursor=pointer]:
        - /url: /en
        - img [ref=e6]
        - generic [ref=e11]:
          - generic [ref=e12]: Vocab Learning
          - generic [ref=e13]: Learn Thai with Oxford 3000
      - navigation "Sections" [ref=e14]:
        - link "Thai words" [ref=e15] [cursor=pointer]:
          - /url: /en/english/a1
        - link "Try free" [ref=e16] [cursor=pointer]:
          - /url: /en/english/a1/practice
      - generic [ref=e17]:
        - generic "Language" [ref=e18]:
          - img [ref=e20]
          - link "EN" [ref=e24] [cursor=pointer]:
            - /url: /en/english/search?q=about
          - link "TH" [ref=e25] [cursor=pointer]:
            - /url: /th/english/search?q=about
        - generic [ref=e26]:
          - link "Log in" [ref=e27] [cursor=pointer]:
            - /url: /en/auth/login?from=%2Fen%2Fenglish%2Fsearch%3Fq%3Dabout
          - link "Sign up" [ref=e28] [cursor=pointer]:
            - /url: /en/auth/register?from=%2Fen%2Fenglish%2Fsearch%3Fq%3Dabout
  - main [ref=e30]:
    - generic [ref=e32]:
      - navigation "breadcrumb" [ref=e33]:
        - link "Home" [ref=e34] [cursor=pointer]:
          - /url: /en
        - generic [ref=e35]: /
        - link "English words" [ref=e36] [cursor=pointer]:
          - /url: /en/english
        - generic [ref=e37]: /
        - generic [ref=e38]: Search
      - heading "Search the course" [level=1] [ref=e39]
      - paragraph [ref=e40]: Search 30 published words by their English spelling or by their Thai meaning.
    - generic [ref=e43]:
      - heading "Browse instead" [level=2] [ref=e44]
      - paragraph [ref=e45]: Every word grouped by its first letter, if you would rather look than type.
      - list [ref=e46]:
        - listitem [ref=e47]:
          - link "a" [ref=e48] [cursor=pointer]:
            - /url: /en/english/words/letter/a
        - listitem [ref=e49]:
          - link "w" [ref=e50] [cursor=pointer]:
            - /url: /en/english/words/letter/w
    - generic [ref=e51]:
      - heading "Start here" [level=2] [ref=e52]
      - paragraph [ref=e53]: Common A1 words to try if you are not looking for anything in particular.
      - list [ref=e54]:
        - listitem [ref=e55]:
          - link "word1 ความหมาย1" [ref=e56] [cursor=pointer]:
            - /url: /en/english/words/word1
            - generic [ref=e57]: word1
            - generic [ref=e58]: ความหมาย1
        - listitem [ref=e59]:
          - link "word2 ความหมาย2" [ref=e60] [cursor=pointer]:
            - /url: /en/english/words/word2
            - generic [ref=e61]: word2
            - generic [ref=e62]: ความหมาย2
        - listitem [ref=e63]:
          - link "word3 ความหมาย3" [ref=e64] [cursor=pointer]:
            - /url: /en/english/words/word3
            - generic [ref=e65]: word3
            - generic [ref=e66]: ความหมาย3
        - listitem [ref=e67]:
          - link "word4 ความหมาย4" [ref=e68] [cursor=pointer]:
            - /url: /en/english/words/word4
            - generic [ref=e69]: word4
            - generic [ref=e70]: ความหมาย4
        - listitem [ref=e71]:
          - link "word5 ความหมาย5" [ref=e72] [cursor=pointer]:
            - /url: /en/english/words/word5
            - generic [ref=e73]: word5
            - generic [ref=e74]: ความหมาย5
        - listitem [ref=e75]:
          - link "word6 ความหมาย6" [ref=e76] [cursor=pointer]:
            - /url: /en/english/words/word6
            - generic [ref=e77]: word6
            - generic [ref=e78]: ความหมาย6
        - listitem [ref=e79]:
          - link "word7 ความหมาย7" [ref=e80] [cursor=pointer]:
            - /url: /en/english/words/word7
            - generic [ref=e81]: word7
            - generic [ref=e82]: ความหมาย7
        - listitem [ref=e83]:
          - link "word8 ความหมาย8" [ref=e84] [cursor=pointer]:
            - /url: /en/english/words/word8
            - generic [ref=e85]: word8
            - generic [ref=e86]: ความหมาย8
        - listitem [ref=e87]:
          - link "word9 ความหมาย9" [ref=e88] [cursor=pointer]:
            - /url: /en/english/words/word9
            - generic [ref=e89]: word9
            - generic [ref=e90]: ความหมาย9
        - listitem [ref=e91]:
          - link "word10 ความหมาย10" [ref=e92] [cursor=pointer]:
            - /url: /en/english/words/word10
            - generic [ref=e93]: word10
            - generic [ref=e94]: ความหมาย10
        - listitem [ref=e95]:
          - link "word11 ความหมาย11" [ref=e96] [cursor=pointer]:
            - /url: /en/english/words/word11
            - generic [ref=e97]: word11
            - generic [ref=e98]: ความหมาย11
        - listitem [ref=e99]:
          - link "word12 ความหมาย12" [ref=e100] [cursor=pointer]:
            - /url: /en/english/words/word12
            - generic [ref=e101]: word12
            - generic [ref=e102]: ความหมาย12
        - listitem [ref=e103]:
          - link "word13 ความหมาย13" [ref=e104] [cursor=pointer]:
            - /url: /en/english/words/word13
            - generic [ref=e105]: word13
            - generic [ref=e106]: ความหมาย13
        - listitem [ref=e107]:
          - link "word14 ความหมาย14" [ref=e108] [cursor=pointer]:
            - /url: /en/english/words/word14
            - generic [ref=e109]: word14
            - generic [ref=e110]: ความหมาย14
        - listitem [ref=e111]:
          - link "word15 ความหมาย15" [ref=e112] [cursor=pointer]:
            - /url: /en/english/words/word15
            - generic [ref=e113]: word15
            - generic [ref=e114]: ความหมาย15
        - listitem [ref=e115]:
          - link "word16 ความหมาย16" [ref=e116] [cursor=pointer]:
            - /url: /en/english/words/word16
            - generic [ref=e117]: word16
            - generic [ref=e118]: ความหมาย16
        - listitem [ref=e119]:
          - link "word17 ความหมาย17" [ref=e120] [cursor=pointer]:
            - /url: /en/english/words/word17
            - generic [ref=e121]: word17
            - generic [ref=e122]: ความหมาย17
        - listitem [ref=e123]:
          - link "word18 ความหมาย18" [ref=e124] [cursor=pointer]:
            - /url: /en/english/words/word18
            - generic [ref=e125]: word18
            - generic [ref=e126]: ความหมาย18
        - listitem [ref=e127]:
          - link "word19 ความหมาย19" [ref=e128] [cursor=pointer]:
            - /url: /en/english/words/word19
            - generic [ref=e129]: word19
            - generic [ref=e130]: ความหมาย19
        - listitem [ref=e131]:
          - link "word20 ความหมาย20" [ref=e132] [cursor=pointer]:
            - /url: /en/english/words/word20
            - generic [ref=e133]: word20
            - generic [ref=e134]: ความหมาย20
        - listitem [ref=e135]:
          - link "word21 ความหมาย21" [ref=e136] [cursor=pointer]:
            - /url: /en/english/words/word21
            - generic [ref=e137]: word21
            - generic [ref=e138]: ความหมาย21
      - link "All words A–Z" [ref=e139] [cursor=pointer]:
        - /url: /en/english/words
        - text: All words A–Z
        - img [ref=e140]
  - contentinfo [ref=e142]:
    - generic [ref=e143]:
      - generic [ref=e144]:
        - link "Vocab Learning" [ref=e145] [cursor=pointer]:
          - /url: /en
          - img [ref=e146]
          - generic [ref=e151]: Vocab Learning
        - paragraph [ref=e152]: Learn the Oxford 3000 — the 3,000 English words that carry most of the language — with Thai meanings, pronunciation and short daily lessons.
        - generic "Language" [ref=e154]:
          - img [ref=e156]
          - link "EN" [ref=e160] [cursor=pointer]:
            - /url: /en/english/search?q=about
          - link "TH" [ref=e161] [cursor=pointer]:
            - /url: /th/english/search?q=about
      - navigation "Levels" [ref=e162]:
        - paragraph [ref=e163]: Levels
        - list [ref=e164]:
          - listitem [ref=e165]:
            - link "A1 vocabulary" [ref=e166] [cursor=pointer]:
              - /url: /en/english/a1
          - listitem [ref=e167]:
            - link "A2 vocabulary" [ref=e168] [cursor=pointer]:
              - /url: /en/english/a2
          - listitem [ref=e169]:
            - link "B1 vocabulary" [ref=e170] [cursor=pointer]:
              - /url: /en/english/b1
          - listitem [ref=e171]:
            - link "B2 vocabulary" [ref=e172] [cursor=pointer]:
              - /url: /en/english/b2
      - navigation "The app" [ref=e173]:
        - paragraph [ref=e174]: The app
        - list [ref=e175]:
          - listitem [ref=e176]:
            - link "Try free" [ref=e177] [cursor=pointer]:
              - /url: /en/english/a1/practice
          - listitem [ref=e178]:
            - link "Questions" [ref=e179] [cursor=pointer]:
              - /url: /en/faq
      - navigation "Explore" [ref=e180]:
        - paragraph [ref=e181]: Explore
        - list [ref=e182]:
          - listitem [ref=e183]:
            - link "English vocabulary" [ref=e184] [cursor=pointer]:
              - /url: /en/english
          - listitem [ref=e185]:
            - link "Level test" [ref=e186] [cursor=pointer]:
              - /url: /en/english/test
          - listitem [ref=e187]:
            - link "All words A–Z" [ref=e188] [cursor=pointer]:
              - /url: /en/english/words
          - listitem [ref=e189]:
            - link "Search words" [ref=e190] [cursor=pointer]:
              - /url: /en/english/search
          - listitem [ref=e191]:
            - link "Pronunciation guides" [ref=e192] [cursor=pointer]:
              - /url: /en/english/pronunciation
          - listitem [ref=e193]:
            - link "Minimal pairs" [ref=e194] [cursor=pointer]:
              - /url: /en/english/minimal-pairs
          - listitem [ref=e195]:
            - link "Phrasal verbs" [ref=e196] [cursor=pointer]:
              - /url: /en/english/phrasal-verbs
          - listitem [ref=e197]:
            - link "Thai alphabet" [ref=e198] [cursor=pointer]:
              - /url: /en/thai-alphabet
      - navigation "About" [ref=e199]:
        - paragraph [ref=e200]: About
        - list [ref=e201]:
          - listitem [ref=e202]:
            - link "About us" [ref=e203] [cursor=pointer]:
              - /url: /en/about
          - listitem [ref=e204]:
            - link "How it works" [ref=e205] [cursor=pointer]:
              - /url: /en/how-it-works
          - listitem [ref=e206]:
            - link "Contact" [ref=e207] [cursor=pointer]:
              - /url: /en/contact
    - generic [ref=e209]:
      - paragraph [ref=e210]: Built on the Oxford 3000 word list. Vocabulary data is used for study purposes.
      - navigation "Legal and site information" [ref=e211]:
        - list [ref=e212]:
          - listitem [ref=e213]:
            - link "Privacy" [ref=e214] [cursor=pointer]:
              - /url: /en/privacy
          - listitem [ref=e215]:
            - link "Terms" [ref=e216] [cursor=pointer]:
              - /url: /en/terms
          - listitem [ref=e217]:
            - link "Sitemap" [ref=e218] [cursor=pointer]:
              - /url: /en/sitemap
  - alert [ref=e219]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  |
  3  | test("locale switching keeps search and header authentication intent", async ({ page }) => {
  4  |   await page.goto("/en/english/search?q=about");
> 5  |   await page.getByRole("link", { name: "TH", exact: true }).click();
     |                                                             ^ Error: locator.click: Error: strict mode violation: getByRole('link', { name: 'TH', exact: true }) resolved to 2 elements:
  6  |   await expect(page).toHaveURL(/\/th\/english\/search\?q=about$/);
  7  |   const login = page.locator('a[href*="/auth/login?from="]').first();
  8  |   await expect(login).toHaveAttribute("href", "/th/auth/login?from=%2Fth%2Fenglish%2Fsearch%3Fq%3Dabout");
  9  | });
  10 |
  11 | test("auth language switch localizes and preserves the requested session", async ({ page }) => {
  12 |   await page.goto("/en/auth/login?from=%2Fen%2Flearn%3Flevel%3DA1%26unit%3D45%26mode%3Dreview");
  13 |   await page.getByRole("link", { name: "TH", exact: true }).click();
  14 |   await expect(page).toHaveURL(/\/th\/auth\/login\?from=/);
  15 |   expect(new URL(page.url()).searchParams.get("from")).toBe("/th/learn?level=A1&unit=45&mode=review");
  16 |   await page.getByRole("link", { name: "TH", exact: true }).click();
  17 |   expect(new URL(page.url()).searchParams.get("from")).toBe("/th/learn?level=A1&unit=45&mode=review");
  18 | });
  19 |
```