# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: practice.spec.ts >> public practice journey >> word landing reaches a five-item trial, signup, and one saved claim
- Location: e2e/practice.spec.ts:74:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/en\/english\/a1\/unit\/1\/practice$/
Received string:  "http://localhost:3100/en/english/words/word1"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    4 × unexpected value "http://localhost:3100/en/english/words/word1"

```

```yaml
- link "Skip to content":
  - /url: "#main"
- banner:
  - link "Vocab Learning — home":
    - /url: /en
  - link "EN":
    - /url: /en/english/words/word1
  - link "TH":
    - /url: /th/english/words/word1
  - link "Sign up":
    - /url: /en/auth/register?from=%2Fen%2Fenglish%2Fwords%2Fword1
  - navigation "Sections":
    - link "Thai words":
      - /url: /en/english/a1
    - link "Try free":
      - /url: /en/english/a1/practice
    - link "Log in":
      - /url: /en/auth/login?from=%2Fen%2Fenglish%2Fwords%2Fword1
- main:
  - navigation "breadcrumb":
    - link "Home":
      - /url: /en
    - link "A1 words":
      - /url: /en/english/a1
    - link "Unit 1":
      - /url: /en/english/a1/unit/1
    - text: word1
  - heading "word1 Listen to “word1” means ความหมาย1" [level=1]:
    - text: word1
    - button "Listen to “word1”"
    - text: means ความหมาย1
  - text: A1 1 entry noun
  - heading "Thai meaning" [level=2]
  - paragraph: ความหมาย1
  - heading "Pronunciation" [level=2]
  - paragraph: The Thai pronunciation of this word is being reviewed.
  - paragraph: /wɜːd1/
  - paragraph: How to say the Thai
  - button "Listen to the Thai “ความหมาย1”"
  - paragraph: ความ-หมาย-1
  - paragraph: khwam-mai-1
  - paragraph: The Thai letters, one by one
  - paragraph: Tap a letter to hear its name. The Roman name is what Thai people call the letter.
  - button "kho khwai": ค kho khwai ค ควาย
  - button "wo waen": ว wo waen ว แหวน
  - button "sara aa": า sara aa สระอา
  - button "mo ma": ม mo ma ม ม้า
  - button "ho hip": ห ho hip ห หีบ
  - button "mo ma": ม mo ma ม ม้า
  - button "sara aa": า sara aa สระอา
  - button "yo yak": ย yo yak ย ยักษ์
  - button "1" [disabled]: 1 ?
  - paragraph: Example
  - paragraph: This is an example sentence for word1.
  - paragraph: ประโยคตัวอย่างของ word1
  - navigation "Nearby words":
    - link "Next word word2":
      - /url: /en/english/words/word2
  - heading "Other words in unit 1" [level=2]
  - paragraph: These are learned in the same unit, so they come up together in practice.
  - list:
    - listitem:
      - link "word2 ความหมาย2":
        - /url: /en/english/words/word2
    - listitem:
      - link "word3 ความหมาย3":
        - /url: /en/english/words/word3
    - listitem:
      - link "word4 ความหมาย4":
        - /url: /en/english/words/word4
    - listitem:
      - link "word5 ความหมาย5":
        - /url: /en/english/words/word5
    - listitem:
      - link "word6 ความหมาย6":
        - /url: /en/english/words/word6
    - listitem:
      - link "word7 ความหมาย7":
        - /url: /en/english/words/word7
    - listitem:
      - link "word8 ความหมาย8":
        - /url: /en/english/words/word8
    - listitem:
      - link "word9 ความหมาย9":
        - /url: /en/english/words/word9
    - listitem:
      - link "word10 ความหมาย10":
        - /url: /en/english/words/word10
    - listitem:
      - link "word11 ความหมาย11":
        - /url: /en/english/words/word11
    - listitem:
      - link "word12 ความหมาย12":
        - /url: /en/english/words/word12
    - listitem:
      - link "word13 ความหมาย13":
        - /url: /en/english/words/word13
  - paragraph: Practise this word in its unit
  - paragraph: Words stick when you meet them again. Take unit 1 and see it in a short lesson.
  - link "Start unit 1":
    - /url: /en/english/a1/unit/1/practice
- contentinfo:
  - link "Vocab Learning":
    - /url: /en
  - paragraph: Learn the Oxford 3000 — the 3,000 English words that carry most of the language — with Thai meanings, pronunciation and short daily lessons.
  - link "EN":
    - /url: /en/english/words/word1
  - link "TH":
    - /url: /th/english/words/word1
  - navigation "Levels":
    - paragraph: Levels
    - list:
      - listitem:
        - link "A1 vocabulary":
          - /url: /en/english/a1
      - listitem:
        - link "A2 vocabulary":
          - /url: /en/english/a2
      - listitem:
        - link "B1 vocabulary":
          - /url: /en/english/b1
      - listitem:
        - link "B2 vocabulary":
          - /url: /en/english/b2
  - navigation "The app":
    - paragraph: The app
    - list:
      - listitem:
        - link "Try free":
          - /url: /en/english/a1/practice
      - listitem:
        - link "Questions":
          - /url: /en/faq
  - navigation "Explore":
    - paragraph: Explore
    - list:
      - listitem:
        - link "English vocabulary":
          - /url: /en/english
      - listitem:
        - link "Level test":
          - /url: /en/english/test
      - listitem:
        - link "All words A–Z":
          - /url: /en/english/words
      - listitem:
        - link "Search words":
          - /url: /en/english/search
      - listitem:
        - link "Pronunciation guides":
          - /url: /en/english/pronunciation
      - listitem:
        - link "Minimal pairs":
          - /url: /en/english/minimal-pairs
      - listitem:
        - link "Phrasal verbs":
          - /url: /en/english/phrasal-verbs
      - listitem:
        - link "Thai alphabet":
          - /url: /en/thai-alphabet
  - navigation "About":
    - paragraph: About
    - list:
      - listitem:
        - link "About us":
          - /url: /en/about
      - listitem:
        - link "How it works":
          - /url: /en/how-it-works
      - listitem:
        - link "Contact":
          - /url: /en/contact
  - paragraph: Built on the Oxford 3000 word list. Vocabulary data is used for study purposes.
  - navigation "Legal and site information":
    - list:
      - listitem:
        - link "Privacy":
          - /url: /en/privacy
      - listitem:
        - link "Terms":
          - /url: /en/terms
      - listitem:
        - link "Sitemap":
          - /url: /en/sitemap
- alert
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   |
  3   | import { newUser, SEED } from "./support/fixtures";
  4   | import { registerThroughUi } from "./support/actions";
  5   |
  6   | const finishTrial = async (page: import("@playwright/test").Page) => {
  7   |   for (let index = 0; index < 5; index += 1) {
  8   |     await expect(page.getByTestId("practice-counter")).toContainText(`${index + 1} of 5`);
  9   |     await page.getByTestId("practice-option").first().click();
  10  |     await expect(page.getByTestId("practice-feedback")).toBeVisible();
  11  |     await expect(page.getByTestId("practice-pip").nth(index)).toHaveAttribute(
  12  |       "data-filled",
  13  |       "true",
  14  |     );
  15  |     await page.getByTestId("practice-continue").click();
  16  |   }
  17  |   await expect(page.getByTestId("practice-result")).toBeVisible();
  18  | };
  19  |
  20  | test.describe("public practice journey", () => {
  21  |   test.use({ viewport: { width: 390, height: 844 } });
  22  |
  23  |   test("claim stays visibly saving until the server confirms", async ({ page }) => {
  24  |     await registerThroughUi(page);
  25  |     let release!: () => void;
  26  |     const held = new Promise<void>(resolve => { release = resolve; });
  27  |     await page.route("**/api/practice/claim", async route => {
  28  |       await held;
  29  |       await route.continue();
  30  |     });
  31  |     try {
  32  |       await page.goto("/en/english/a1/practice");
  33  |       await finishTrial(page);
  34  |       await expect(page.getByTestId("practice-claim-status")).toHaveText("Saving your progress…");
  35  |       await expect(page.getByTestId("practice-saved")).toHaveCount(0);
  36  |     } finally {
  37  |       release();
  38  |     }
  39  |     await expect(page.getByTestId("practice-saved")).toBeVisible();
  40  |   });
  41  |
  42  |   test("failed claim is not saved, never auto-loops, and can be retried", async ({ page }) => {
  43  |     await registerThroughUi(page);
  44  |     let claims = 0;
  45  |     await page.route("**/api/practice/claim", async route => {
  46  |       claims += 1;
  47  |       await route.fulfill({ status: 503, json: { message: "unavailable" } });
  48  |     });
  49  |     await page.goto("/en/english/a1/practice");
  50  |     await finishTrial(page);
  51  |     await expect(page.getByTestId("practice-claim-status")).toContainText("could not be saved");
  52  |     await expect(page.getByTestId("practice-saved")).toHaveCount(0);
  53  |     // Exercise a re-render without scheduling another automatic claim.
  54  |     await page.setViewportSize({ width: 400, height: 844 });
  55  |     await expect(page.getByTestId("practice-claim-retry")).toBeVisible();
  56  |     expect(claims).toBe(1);
  57  |     await page.unroute("**/api/practice/claim");
  58  |     await page.getByTestId("practice-claim-retry").click();
  59  |     await expect(page.getByTestId("practice-saved")).toBeVisible();
  60  |   });
  61  |
  62  |   test("expired claim explains recovery without claiming success", async ({ page }) => {
  63  |     await registerThroughUi(page);
  64  |     await page.route("**/api/practice/claim", route =>
  65  |       route.fulfill({ status: 404, json: { message: "expired" } }));
  66  |     await page.goto("/en/english/a1/practice");
  67  |     await finishTrial(page);
  68  |     await expect(page.getByTestId("practice-claim-status")).toContainText("can no longer be saved");
  69  |     await expect(page.getByTestId("practice-saved")).toHaveCount(0);
  70  |     await expect(page.getByTestId("practice-claim-retry")).toHaveCount(0);
  71  |     await expect(page.getByTestId("practice-result").getByRole("link", { name: "Continue", exact: true })).toBeVisible();
  72  |   });
  73  |
  74  |   test("word landing reaches a five-item trial, signup, and one saved claim", async ({
  75  |     page,
  76  |   }) => {
  77  |     test.setTimeout(60_000);
  78  |     const user = newUser();
  79  |
  80  |     await page.goto(`/en/english/words/${SEED.unit1.firstWord}`);
  81  |     const cta = page.getByTestId("word-practice-cta");
  82  |     await expect(cta).toBeVisible();
  83  |     await cta.click();
> 84  |     await expect(page).toHaveURL(/\/en\/english\/a1\/unit\/1\/practice$/);
      |                        ^ Error: expect(page).toHaveURL(expected) failed
  85  |
  86  |     await expect(page.getByTestId("practice-option")).toHaveCount(4);
  87  |     await finishTrial(page);
  88  |     await expect(page.getByTestId("result-heading")).toContainText("of 5 recalled");
  89  |
  90  |     await page.getByTestId("save-progress-cta").click();
  91  |     await expect(page).toHaveURL(/\/en\/auth\/register\?from=/);
  92  |     await page.fill("#firstName", user.firstName);
  93  |     await page.fill("#lastName", user.lastName);
  94  |     await page.fill("#email", user.email);
  95  |     await page.fill("#username", user.username);
  96  |     await page.fill("#password", user.password);
  97  |     await page.click('button[type="submit"]');
  98  |
  99  |     await expect(page).toHaveURL(/\/en\/english\/a1\/unit\/1\/practice$/, {
  100 |       timeout: 20_000,
  101 |     });
  102 |     await expect(page.getByTestId("practice-result")).toBeVisible();
  103 |     await expect(page.getByTestId("practice-saved")).toBeVisible();
  104 |
  105 |     const summary = await page.evaluate<{ wordsSeen: number }>(async () =>
  106 |       fetch("/api/progress/summary", { credentials: "include" }).then((response) =>
  107 |         response.json(),
  108 |       ),
  109 |     );
  110 |     expect(summary.wordsSeen).toBe(5);
  111 |   });
  112 |
  113 |   test("Thai keyboard answer is server-graded and refresh resumes at the next item", async ({
  114 |     page,
  115 |   }) => {
  116 |     await page.goto("/th/english/a1/practice");
  117 |     await expect(page.getByTestId("practice-option").first()).toBeVisible();
  118 |
  119 |     await page.keyboard.press("1");
  120 |     await expect(page.getByTestId("practice-feedback")).toBeVisible();
  121 |     await expect(page.getByTestId("practice-continue")).toContainText("ดำเนินการต่อ");
  122 |     await page.getByTestId("practice-continue").click();
  123 |
  124 |     await page.reload();
  125 |     await expect(page.getByTestId("practice-counter")).toContainText("ข้อ 2 จาก 5");
  126 |     await expect(page.getByTestId("practice-pip").first()).toHaveAttribute(
  127 |       "data-filled",
  128 |       "true",
  129 |     );
  130 |
  131 |     await page.keyboard.press("Escape");
  132 |     await expect(page.getByTestId("practice-close-confirm")).toBeVisible();
  133 |     await page.keyboard.press("Escape");
  134 |     await expect(page.getByTestId("practice-close-confirm")).toHaveCount(0);
  135 |   });
  136 |
  137 |   test("a failed start shows a retry path and does not guess an answer", async ({ page }) => {
  138 |     await page.route("**/api/practice/start", (route) =>
  139 |       route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"down"}' }),
  140 |     );
  141 |     await page.goto("/en/english/a1/practice");
  142 |     await expect(page.getByTestId("practice-error")).toBeVisible();
  143 |     await expect(page.getByTestId("practice-feedback")).toHaveCount(0);
  144 |
  145 |     await page.unroute("**/api/practice/start");
  146 |     await page.getByTestId("practice-retry").click();
  147 |     await expect(page.getByTestId("practice-option").first()).toBeVisible();
  148 |   });
  149 | });
  150 |
  151 | /**
  152 |  * The `PracticeSession` render branches the happy-path journey above never dwells on: the
  153 |  * loading spinner, the 429 "already in progress elsewhere" block, and the full result
  154 |  * summary (insight line, per-item pips, and the next-unit preview).
  155 |  */
  156 | test.describe("public practice UI branches", () => {
  157 |   test.use({ viewport: { width: 390, height: 844 } });
  158 |
  159 |   test("the loading spinner shows while the trial is being prepared", async ({ page }) => {
  160 |     // Hold the start response open long enough to observe the loading branch, then let it
  161 |     // through so the real trial renders — no mocked payload.
  162 |     await page.route("**/api/practice/start", async (route) => {
  163 |       await new Promise((resolve) => setTimeout(resolve, 800));
  164 |       await route.continue();
  165 |     });
  166 |
  167 |     await page.goto("/en/english/a1/practice");
  168 |     await expect(page.getByTestId("practice-loading")).toBeVisible();
  169 |     await expect(page.getByTestId("practice-card")).toBeVisible();
  170 |   });
  171 |
  172 |   test("a 429 start shows the already-in-progress block, not an error", async ({ page }) => {
  173 |     await page.route("**/api/practice/start", (route) =>
  174 |       route.fulfill({ status: 429, contentType: "application/json", body: '{"message":"rate limited"}' }),
  175 |     );
  176 |
  177 |     await page.goto("/en/english/a1/practice");
  178 |     await expect(page.getByTestId("practice-blocked")).toBeVisible();
  179 |     await expect(page.getByTestId("practice-error")).toHaveCount(0);
  180 |   });
  181 |
  182 |   test("the trial renders its card and prompt and the full result summary", async ({ page }) => {
  183 |     await page.goto("/en/english/a1/practice");
  184 |     await expect(page.getByTestId("practice-card")).toBeVisible();
```