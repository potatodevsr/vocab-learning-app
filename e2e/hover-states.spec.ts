import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { loginAsAdmin, registerThroughUi } from "./support/actions";
import { SEED } from "./support/fixtures";
import {
  findUnreadableControls,
  recordFindings,
  sweepHoverStates,
  type Finding,
} from "./support/interaction";

/**
 * Hover coverage for every page the app has.
 *
 * SPEC §6.1 craft bar #2: "Every interactive element has four states — rest, hover,
 * active, focus-visible — and focus is *designed*, not the browser default." Nothing
 * else in the suite can see a dead hover: the page renders, the click works, the test
 * passes, and the app still feels like a printout. This spec puts a real pointer on
 * every link, button and field of every route, and fails when one of them answers with
 * nothing.
 *
 * It also photographs each hover into `design-screens/<page>/` so the states
 * can be reviewed as pictures rather than as assertions.
 *
 * Adding a page? Add it here. A route with no entry in this file is a route whose
 * interaction states nobody has ever looked at.
 */
test.describe.configure({ timeout: 300_000 });

const report = (findings: Finding[]) =>
  findings.map((f) => `  · ${f.element} — ${f.reason}`).join("\n");

const freezeHeroAt = async (page: Page, time = 1000) => {
  const cards = page.locator('[data-testid="hero-word-illustration"] .hero-card-cycle');
  if ((await cards.count()) !== 3) return;

  await cards.evaluateAll((elements, currentTime) => {
    elements.forEach((element) => {
      element.getAnimations().forEach((animation) => {
        animation.pause();
        animation.currentTime = currentTime;
      });
    });
  }, time);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};

/** One sweep + its two assertions, so every page test reads the same way. */
const checkPage = async (page: Page, name: string, root?: string) => {
  if (["home-en", "home-th", "home-signed-in", "phone-home"].includes(name)) {
    await freezeHeroAt(page);
  }

  const hover = await sweepHoverStates(page, name, root);

  // Park the pointer before measuring contrast. The sweep ends with the mouse still on
  // the last control, and reading colours then measures that control's *hover* state —
  // which is how a passing button reported 3.56:1 while its rest state was 4.94:1.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(450);

  const unreadable = await findUnreadableControls(page, root);

  recordFindings(name, "contrast", unreadable);

  expect(
    hover,
    `${name}: interactive elements that do not respond to a pointer\n${report(hover)}`,
  ).toEqual([]);

  expect(
    unreadable,
    `${name}: controls that fail WCAG AA against what is painted behind them\n${report(unreadable)}`,
  ).toEqual([]);
};

test.describe("hover states — public pages", () => {
  const PUBLIC_PAGES = [
    { name: "home-en", path: "/en" },
    { name: "home-th", path: "/th" },
    { name: "faq", path: "/en/faq" },
    { name: "login", path: "/en/auth/login" },
    { name: "magic-link-invalid", path: "/en/auth/verify" },
    { name: "magic-link-invalid-th", path: "/th/auth/verify" },
    { name: "register", path: "/en/auth/register" },
    { name: "english-hub", path: "/en/english" },
    { name: "english-hub-th", path: "/th/english" },
    { name: "level-a1", path: "/en/english/a1" },
    { name: "level-a1-th", path: "/th/english/a1" },
    { name: "unit-1", path: "/en/english/a1/unit/1" },
    { name: "words-index", path: "/en/english/words" },
    { name: "words-index-th", path: "/th/english/words" },
    { name: "words-letter-a", path: "/en/english/words/letter/a" },
    { name: "words-letter-a-th", path: "/th/english/words/letter/a" },
    { name: "about", path: "/en/about" },
    { name: "how-it-works", path: "/en/how-it-works" },
    { name: "privacy", path: "/en/privacy" },
    { name: "terms", path: "/en/terms" },
    { name: "contact", path: "/en/contact" },
    { name: "thai-alphabet", path: "/en/thai-alphabet" },
    { name: "thai-alphabet-th", path: "/th/thai-alphabet" },
    { name: "html-sitemap", path: "/en/sitemap" },
    { name: "html-sitemap-th", path: "/th/sitemap" },
    { name: "word", path: `/en/english/words/${SEED.unit1.firstWord}` },
    { name: "not-found", path: "/en/english/words/no-such-word" },
  ];

  for (const { name, path } of PUBLIC_PAGES) {
    test(`${name} answers the pointer everywhere`, async ({ page }) => {
      await page.goto(path);
      await checkPage(page, name);
    });
  }

  // The practice trial card mounts client-side after `POST /practice/start` resolves
  // (LEARNER-LIFECYCLE.md §3.2), so unlike the rest of this file's server-rendered pages
  // these two wait for the first question to actually be on screen before sweeping.
  test("level-a1-practice answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/english/a1/practice");
    await expect(page.getByTestId("practice-option").first()).toBeVisible();
    await checkPage(page, "level-a1-practice");
  });

  test("unit-1-practice answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/english/a1/unit/1/practice");
    await expect(page.getByTestId("practice-option").first()).toBeVisible();
    await checkPage(page, "unit-1-practice");
  });
});

test.describe("hover states — learner pages", () => {
  /**
   * One account for the whole group, reused by cookie.
   *
   * Registering per test costs two PBKDF2-SHA256 hashes (≥210k iterations each) on the
   * Worker, and ten of them measurably slowed the shared suite down. Only the mistakes
   * bank needs a *fresh* learner — it asserts an empty bank, and the quiz tests above it
   * put wrong answers in one.
   */
  let session: Awaited<ReturnType<BrowserContext["cookies"]>> | null = null;

  test.beforeEach(async ({ page, context }) => {
    if (!session) {
      await registerThroughUi(page);
      session = await context.cookies();
      return;
    }

    await context.addCookies(session);
  });

  test("the signed-in home page answers the pointer everywhere", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.getByTestId("today-card")).toBeVisible();
    await checkPage(page, "home-signed-in");
  });

  test("the today card remains legible at the primary phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    await expect(page.getByTestId("today-card")).toBeVisible();
    await checkPage(page, "phone-today-card");
  });

  test("the account menu answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en");

    // The trigger only exists once /me resolves.
    const trigger = page.locator("[aria-haspopup]").first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();

    // Scoped to the menu: an open Radix menu covers the page behind it on purpose.
    await checkPage(page, "account-menu", '[role="menu"]');
  });

  test("the mixed session answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();

    await checkPage(page, "session");
  });

  test("the mixed session remains legible at the primary phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();

    await checkPage(page, "phone-session");
  });

  test("the mixed session result answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();

    for (let index = 0; index < 8; index += 1) {
      await expect(page.getByTestId("session-card")).toBeVisible();
      const spelling = page.getByTestId("session-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("placeholder");
        await page.getByTestId("session-continue").click();
      } else {
        const itemType = await page
          .getByTestId("session-card")
          .getAttribute("data-item-type");
        await page.getByTestId("session-option").first().click();
        // match-pairs is a tap-then-tap interaction (§4.1): a first tap only "picks up"
        // the word. Branch on the explicit item contract; probing feedback races the
        // asynchronous grade and can accidentally click a now-disabled ordinary option.
        if (itemType === "match-pairs") {
          await page.getByTestId("session-option").first().click();
        }
      }
      await expect(page.getByTestId("session-feedback")).toBeVisible();
      await page.getByTestId("session-continue").click();
    }

    await expect(page.getByTestId("session-result")).toBeVisible();
    await checkPage(page, "session-result");
  });

  test("the quiz intro answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();

    await checkPage(page, "quiz-intro");
  });

  test("a quiz question answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();
    await expect(page.getByTestId("quiz-option").first()).toBeVisible();

    await checkPage(page, "quiz-question");
  });

  test("quiz feedback answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/quiz?level=A1&unit=1");
    await page.getByRole("button", { name: "Start quiz" }).click();
    await page.getByTestId("quiz-option").first().click();
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.getByText(/Correct answer:/).first()).toBeVisible();

    await checkPage(page, "quiz-feedback");
  });

  test("the quiz that cannot start answers the pointer everywhere", async ({
    page,
  }) => {
    await page.goto("/en/quiz?level=A1&unit=2");
    await expect(page.getByText("Quiz is not ready yet")).toBeVisible();

    await checkPage(page, "quiz-not-ready");
  });

  test("the profile answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/profile");
    await expect(page.getByTestId("profile-username")).toBeVisible();

    await checkPage(page, "profile");
  });

  test("the mistakes bank answers the pointer everywhere", async ({ page }) => {
    // A learner of its own: the quiz tests above deliberately answer wrongly, and this
    // page is the empty state.
    await registerThroughUi(page);
    await page.goto("/en/review");
    await expect(page.getByTestId("mistakes-count")).toBeVisible();

    await checkPage(page, "review-empty");
  });

  // The unit checkpoint (LEARNER-LIFECYCLE.md §3.8) has three learner-visible surfaces
  // worth photographing: the not-ready gate, the in-progress card, and the result. Each
  // uses a *fresh* learner so its state is deterministic regardless of test order — the
  // shared session above completes sessions that would otherwise flip "not-ready" to
  // "ready" depending on ordering.
  const completeOneSession = async (page: Page) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("session-card")).toBeVisible();
    for (let index = 0; index < 8; index += 1) {
      await expect(page.getByTestId("session-card")).toBeVisible();
      const spelling = page.getByTestId("session-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("placeholder");
        await page.getByTestId("session-continue").click();
      } else {
        const itemType = await page.getByTestId("session-card").getAttribute("data-item-type");
        await page.getByTestId("session-option").first().click();
        if (itemType === "match-pairs") {
          await page.getByTestId("session-option").first().click();
        }
      }
      await expect(page.getByTestId("session-feedback")).toBeVisible();
      await page.getByTestId("session-continue").click();
    }
    await expect(page.getByTestId("session-result")).toBeVisible();
  };

  test("the checkpoint not-ready gate answers the pointer everywhere", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/english/a1/unit/1/checkpoint");
    await expect(page.getByTestId("checkpoint-not-ready")).toBeVisible();

    await checkPage(page, "checkpoint-not-ready");
  });

  test("the checkpoint card answers the pointer everywhere", async ({ page }) => {
    await registerThroughUi(page);
    await completeOneSession(page);
    await page.goto("/en/english/a1/unit/1/checkpoint");
    await expect(page.getByTestId("checkpoint-card")).toBeVisible();

    await checkPage(page, "checkpoint-card");
  });

  test("the checkpoint result answers the pointer everywhere", async ({ page }) => {
    await registerThroughUi(page);
    await completeOneSession(page);
    await page.goto("/en/english/a1/unit/1/checkpoint");
    await expect(page.getByTestId("checkpoint-card")).toBeVisible();

    for (let index = 0; index < 5; index += 1) {
      await expect(page.getByTestId("checkpoint-card")).toBeVisible();
      const spelling = page.getByTestId("checkpoint-spelling-input");
      if (await spelling.isVisible().catch(() => false)) {
        await spelling.fill("placeholder");
        await page.getByTestId("checkpoint-continue").click();
      } else {
        await page.getByTestId("checkpoint-option").first().click();
      }
      await expect(page.getByTestId("checkpoint-feedback")).toBeVisible();
      await page.getByTestId("checkpoint-continue").click();
    }

    await expect(page.getByTestId("checkpoint-result")).toBeVisible();
    await checkPage(page, "checkpoint-result");
  });
});

test.describe("hover states — admin pages", () => {
  test("the admin login answers the pointer everywhere", async ({ page }) => {
    await page.goto("/admin/login");
    await checkPage(page, "admin-login");
  });

  test.describe("signed in", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page, SEED.admin);
    });

    const ADMIN_PAGES = [
      { name: "admin-dashboard", path: "/admin/dashboard" },
      { name: "admin-vocabulary", path: "/admin/vocabulary" },
      { name: "admin-users", path: "/admin/users" },
    ];

    for (const { name, path } of ADMIN_PAGES) {
      test(`${name} answers the pointer everywhere`, async ({ page }) => {
        await page.goto(path);
        await checkPage(page, name);
      });
    }

    test("the curation form answers the pointer everywhere", async ({
      page,
    }) => {
      // /admin/vocabulary above only ever shows the list — the editor mounts once a word
      // is picked, and it is where all the typing happens. The multi-part word brings the
      // per-part-of-speech blocks along with it.
      await page.goto("/admin/vocabulary");
      await page
        .getByTestId("word-item")
        .filter({ hasText: SEED.multiPosWord.word })
        .first()
        .click();
      await expect(page.getByTestId("pos-usages")).toBeVisible();

      await checkPage(page, "admin-vocabulary-editor");
    });
  });
});

/**
 * The app is designed at 390px (SPEC §6.1), so the phone is the real target, not the
 * fallback. A pointer still exists there — trackpads on small windows, Android with a
 * mouse — but what this pass really catches is a hover state that only works because a
 * desktop layout gave it room.
 */
test.describe("hover states — phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const PHONE_PAGES = [
    { name: "phone-home", path: "/en" },
    { name: "phone-level-a1", path: "/en/english/a1" },
    { name: "phone-unit-1", path: "/en/english/a1/unit/1" },
    { name: "phone-words-index", path: "/en/english/words" },
    { name: "phone-word", path: `/en/english/words/${SEED.unit1.firstWord}` },
    { name: "phone-login", path: "/en/auth/login" },
    { name: "phone-level-a1-practice", path: "/en/english/a1/practice" },
  ];

  for (const { name, path } of PHONE_PAGES) {
    test(`${name} answers the pointer everywhere`, async ({ page }) => {
      await page.goto(path);
      if (name === "phone-level-a1-practice") {
        await expect(page.getByTestId("practice-option").first()).toBeVisible();
      }
      await checkPage(page, name);

      // The app bar is the usual culprit: brand mark + language switcher + account
      // button do not fit 390px at desktop padding, and the whole document scrolls
      // sideways rather than the bar clipping.
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );

      expect(overflows, `${name} scrolls sideways at 390px`).toBe(false);
    });
  }
});
