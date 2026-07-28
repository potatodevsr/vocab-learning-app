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
 * It also photographs each hover into `test-results/hover-states/<page>/` so the states
 * can be reviewed as pictures rather than as assertions.
 *
 * Adding a page? Add it here. A route with no entry in this file is a route whose
 * interaction states nobody has ever looked at.
 */
test.describe.configure({ timeout: 300_000 });

const report = (findings: Finding[]) =>
  findings.map((f) => `  · ${f.element} — ${f.reason}`).join("\n");

/** One sweep + its two assertions, so every page test reads the same way. */
const checkPage = async (page: Page, name: string, root?: string) => {
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
    { name: "register", path: "/en/auth/register" },
    { name: "level-a1", path: "/en/english/a1" },
    { name: "level-a1-th", path: "/th/english/a1" },
    { name: "unit-1", path: "/en/english/a1/unit/1" },
    { name: "word", path: `/en/english/words/${SEED.unit1.firstWord}` },
    { name: "not-found", path: "/en/english/words/no-such-word" },
  ];

  for (const { name, path } of PUBLIC_PAGES) {
    test(`${name} answers the pointer everywhere`, async ({ page }) => {
      await page.goto(path);
      await checkPage(page, name);
    });
  }
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
    await checkPage(page, "home-signed-in");
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

  test("the lesson answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");
    await expect(page.getByTestId("i-know-this")).toBeVisible();

    await checkPage(page, "lesson");
  });

  test("the lesson summary answers the pointer everywhere", async ({ page }) => {
    await page.goto("/en/learn?level=A1&unit=1");

    for (let index = 0; index < SEED.unit1.roundSizes[0]; index += 1) {
      await page.getByTestId("i-know-this").click();
    }

    await expect(page.getByTestId("summary-known")).toBeVisible();

    await checkPage(page, "lesson-summary");
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
    { name: "phone-word", path: `/en/english/words/${SEED.unit1.firstWord}` },
    { name: "phone-login", path: "/en/auth/login" },
  ];

  for (const { name, path } of PHONE_PAGES) {
    test(`${name} answers the pointer everywhere`, async ({ page }) => {
      await page.goto(path);
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
