import { expect, test, type Page } from "@playwright/test";

import { registerThroughUi } from "./support/actions";

/**
 * The craft bar from SPEC §6.1, asserted rather than assumed. These are the rules that
 * fail silently: a palette that looks cheerful but fails contrast, an animation that
 * ignores `prefers-reduced-motion`, a focus ring left as the browser default.
 */
const contrastRatio = (a: number[], b: number[]) => {
  const luminance = ([r, g, b]: number[]) => {
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (light + 0.05) / (dark + 0.05);
};

/** Chrome reports computed colours as `oklch(...)`, so let the browser convert. */
const TO_RGB = `(colour) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 1, 1);
  return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
}`;

type HeroPhase = {
  root: { top: number; height: number };
  followingTop: number;
  frontWord: string;
  frontMatrix: number[];
  rearTransforms: string[];
  zIndices: number[];
  opacities: string[];
  backgrounds: number[][];
  cardSurface: number[];
  frontContained: boolean;
  frontContentContained: boolean;
  maxRearOverflow: number;
  rearHeadingsOccluded: boolean;
  overflow: number;
  contrast: Array<{ label: string; ratio: number }>;
};

const seekHeroAt = async (page: Page, time: number) => {
  const illustration = page.getByTestId("hero-word-illustration");
  await illustration.scrollIntoViewIfNeeded();
  await expect(page.getByTestId("hero-card-stage")).toBeVisible();
  await illustration.locator(".hero-card-cycle").evaluateAll((cards, currentTime) => {
    cards.forEach((card) => {
      card.getAnimations().forEach((animation) => {
        animation.pause();
        animation.currentTime = currentTime;
      });
    });
  }, time);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};

const readHeroPhase = async (page: Page): Promise<HeroPhase> =>
  page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(
      '[data-testid="hero-word-illustration"]',
    );
    const cards = [...document.querySelectorAll<HTMLElement>(
      '[data-testid="hero-word-illustration"] .hero-card-cycle',
    )];
    if (!root || cards.length !== 3) throw new Error("Hero deck is incomplete");

    const rgba = (colour: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas colour conversion unavailable");
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = colour;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const luminance = ([r, g, b]: number[]) => {
      const channel = (value: number) => {
        const normal = value / 255;
        return normal <= 0.03928
          ? normal / 12.92
          : ((normal + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const ratio = (a: number[], b: number[]) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const rootRect = root.getBoundingClientRect();
    const front = cards.find((card) => getComputedStyle(card).zIndex === "30");
    if (!front) throw new Error("Hero deck has no front card");
    const frontRect = front.getBoundingClientRect();
    const inside = (rect: DOMRect, container: DOMRect, tolerance = 1) =>
      rect.left >= container.left - tolerance &&
      rect.top >= container.top - tolerance &&
      rect.right <= container.right + tolerance &&
      rect.bottom <= container.bottom + tolerance;
    const matrix = new DOMMatrix(getComputedStyle(front).transform);
    const rear = cards.filter((card) => card !== front);
    const maxRearOverflow = Math.max(
      0,
      ...rear.flatMap((card) => {
        const rect = card.getBoundingClientRect();
        return [
          rootRect.left - rect.left,
          rootRect.top - rect.top,
          rect.right - rootRect.right,
          rect.bottom - rootRect.bottom,
        ];
      }),
    );
    const contrast = [...front.querySelectorAll<HTMLElement>("h3, p, span")]
      .filter((node) => node.textContent?.trim())
      .map((node) => {
        let ancestor: HTMLElement | null = node;
        let background = rgba("transparent");
        while (ancestor) {
          background = rgba(getComputedStyle(ancestor).backgroundColor);
          if (background[3] === 255) break;
          ancestor = ancestor.parentElement;
        }
        return {
          label: node.textContent?.trim().replace(/\s+/g, " ") ?? node.tagName,
          ratio: ratio(rgba(getComputedStyle(node).color), background),
        };
      });
    const section = root.closest("section");
    const followingTop = section?.nextElementSibling?.getBoundingClientRect().top;
    if (followingTop === undefined) throw new Error("Hero following section is missing");

    return {
      root: { top: rootRect.top, height: rootRect.height },
      followingTop,
      frontWord: front.dataset.heroWord ?? "",
      frontMatrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
      rearTransforms: rear.map((card) => getComputedStyle(card).transform),
      zIndices: cards.map((card) => Number(getComputedStyle(card).zIndex)).sort((a, b) => a - b),
      opacities: cards.map((card) => getComputedStyle(card).opacity),
      backgrounds: cards.map((card) => rgba(getComputedStyle(card).backgroundColor)),
      cardSurface: rgba(
        getComputedStyle(document.documentElement).getPropertyValue("--card"),
      ),
      frontContained: inside(frontRect, rootRect),
      frontContentContained: [...front.querySelectorAll<HTMLElement>("*")]
        .filter((node) => node.getBoundingClientRect().width > 0)
        .every((node) => inside(node.getBoundingClientRect(), frontRect) &&
          inside(node.getBoundingClientRect(), rootRect)),
      maxRearOverflow,
      rearHeadingsOccluded: rear.every((card) => {
        const heading = card.querySelector("h3");
        if (!heading) return false;
        const rect = heading.getBoundingClientRect();
        const stack = document.elementsFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return stack.indexOf(front) >= 0 && stack.indexOf(front) < stack.indexOf(card);
      }),
      overflow: document.documentElement.scrollWidth - innerWidth,
      contrast,
    };
  });

const expectValidHeroPhase = (phase: HeroPhase) => {
  expect(phase.zIndices).toEqual([10, 20, 30]);
  expect(phase.opacities).toEqual(["1", "1", "1"]);
  phase.backgrounds.forEach((background) => {
    expect(background).toEqual(phase.cardSurface);
    expect(background[3]).toBe(255);
  });
  phase.frontMatrix.forEach((value, index) => {
    expect(value).toBeCloseTo(index === 0 || index === 3 ? 1 : 0, 3);
  });
  expect(new Set(phase.rearTransforms).size).toBe(2);
  expect(phase.frontContained).toBe(true);
  expect(phase.frontContentContained).toBe(true);
  expect(phase.maxRearOverflow).toBeLessThanOrEqual(8);
  expect(phase.rearHeadingsOccluded).toBe(true);
  expect(phase.overflow).toBeLessThanOrEqual(1);
  phase.contrast.forEach(({ label, ratio }) =>
    expect(ratio, `${label} contrast`).toBeGreaterThanOrEqual(4.5),
  );
};

const answerMixedItem = async (page: Page) => {
  const spelling = page.getByTestId("session-spelling-input");
  if (await spelling.isVisible().catch(() => false)) {
    await spelling.fill("placeholder");
    await page.getByTestId("session-continue").click();
  } else {
    const type = await page.getByTestId("session-card").getAttribute("data-item-type");
    await page.getByTestId("session-option").first().click();
    if (type === "match-pairs") await page.getByTestId("session-option").first().click();
  }
  await expect(page.getByTestId("session-feedback")).toBeVisible();
};

test.describe("the play palette", () => {
  test("magic-link recovery stays inside a 390px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const locale of ["en", "th"]) {
      await page.goto(`/${locale}/auth/verify`);
      const boundary = page.getByTestId("magic-verify-invalid");
      await expect(boundary).toBeVisible();
      await expect(boundary.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
    }
  });

  test("the canvas is bright, not near-black", async ({ page }) => {
    await page.goto("/en/english/a1");

    const [r, g, b] = await page.evaluate(
      ([toRgb]) =>
        (eval(toRgb) as (c: string) => number[])(
          getComputedStyle(document.body).backgroundColor,
        ),
      [TO_RGB],
    );

    const brightness = (r + g + b) / 3;

    expect(brightness).toBeGreaterThan(200);
  });

  test("body text clears WCAG AA against the canvas", async ({ page }) => {
    await page.goto("/en/english/a1");

    const { colour, background } = await page.evaluate(
      ([toRgb]) => {
        const convert = eval(toRgb) as (c: string) => number[];
        const style = getComputedStyle(document.body);

        return {
          colour: convert(style.color),
          background: convert(style.backgroundColor),
        };
      },
      [TO_RGB],
    );

    expect(contrastRatio(colour, background)).toBeGreaterThanOrEqual(4.5);
  });

  test("learner surfaces are not dark — measured on what is actually painted", async ({
    page,
  }) => {
    // Measuring document.body alone was not enough: the page can be bright while every
    // visible section paints a near-black background over it, which is exactly what the
    // old palette did.
    for (const path of [
      "/en/english/a1",
      "/en/english/a1/unit/1",
      "/en/english/words/word1",
      "/en/faq",
      "/en/quiz?level=A1&unit=1",
    ]) {
      await page.goto(path);

      const darkArea = await page.evaluate(
        ([toRgb]) => {
          const convert = eval(toRgb) as (c: string) => number[];
          let dark = 0;
          let total = 0;

          for (const el of Array.from(document.querySelectorAll("section, main, div"))) {
            const rect = el.getBoundingClientRect();
            const area = rect.width * rect.height;
            if (area < 20000) continue;

            const bg = getComputedStyle(el).backgroundColor;
            if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue;

            const [r, g, b] = convert(bg);
            total += area;
            if ((r + g + b) / 3 < 90) dark += area;
          }

          return total === 0 ? 0 : dark / total;
        },
        [TO_RGB],
      );

      expect(darkArea, `${path} is mostly dark`).toBeLessThan(0.5);
    }
  });

  test("the semantic tokens are all defined", async ({ page }) => {
    await page.goto("/en/english/a1");

    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return [
        "--brand",
        "--success",
        "--warn",
        "--danger",
        "--accent-sky",
        "--accent-mint",
        "--accent-sun",
        "--accent-grape",
        "--ink",
        "--ease-play",
        "--dur-fast",
        "--dur-slow",
      ].map((token) => [token, style.getPropertyValue(token).trim()]);
    });

    for (const [token, value] of tokens) {
      expect(value, `${token} is unset`).not.toBe("");
    }
  });

  test("there is one motion language: two durations, one curve", async ({
    page,
  }) => {
    await page.goto("/en/english/a1");

    const { fast, slow, ease } = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        fast: style.getPropertyValue("--dur-fast").trim(),
        slow: style.getPropertyValue("--dur-slow").trim(),
        ease: style.getPropertyValue("--ease-play").trim(),
      };
    });

    const ms = (value: string) =>
      value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000;

    expect(ms(fast)).toBe(150);
    expect(ms(slow)).toBe(400);
    expect(ease).toContain("cubic-bezier");
  });
});

test.describe("the landing page is cheerful too", () => {
  test("the logged-out home page is not dark", async ({ page }) => {
    // The first screen anyone sees. It stayed on the old near-black palette after the
    // rest of the app was re-themed, and the body-only check did not notice.
    await page.goto("/en");

    const darkArea = await page.evaluate(
      ([toRgb]) => {
        const convert = eval(toRgb) as (c: string) => number[];
        let dark = 0;
        let total = 0;

        for (const el of Array.from(document.querySelectorAll("section, main, header"))) {
          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area < 20000) continue;

          const bg = getComputedStyle(el).backgroundColor;
          if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue;

          const [r, g, b] = convert(bg);
          total += area;
          if ((r + g + b) / 3 < 90) dark += area;
        }

        return total === 0 ? 0 : dark / total;
      },
      [TO_RGB],
    );

    expect(darkArea).toBeLessThan(0.5);
  });

  test("the 404 page is on-palette", async ({ page }) => {
    await page.goto("/en/english/words/no-such-word");

    const marker = page.getByTestId("not-found");
    await expect(marker).toBeVisible();

    // The page paints a gradient, so `backgroundColor` is transparent by definition —
    // checking that alone would read as "black" and fail on a correct implementation.
    const painted = await marker.evaluate((el) => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);

        if (style.backgroundImage !== "none") {
          return { kind: "gradient", value: style.backgroundImage };
        }

        if (style.backgroundColor !== "rgba(0, 0, 0, 0)") {
          return { kind: "colour", value: style.backgroundColor };
        }
      }

      return { kind: "none", value: "" };
    });

    // Flat by rule (SPEC §6.1): a solid brand colour, and definitely not near-black.
    expect(painted.kind).toBe("colour");

    const [r, g, b] = (painted.value.match(/\d+/g) ?? []).map(Number);
    expect((r + g + b) / 3).toBeGreaterThan(60);
  });
});

test.describe("flat style", () => {
  test("no learner surface uses a gradient", async ({ page }) => {
    // "Flat" is a rule, not a mood: gradients crept back in twice while the palette was
    // being reworked, and only a check like this notices.
    for (const path of [
      "/en",
      "/en/english/a1",
      "/en/english/a1/unit/1",
      "/en/english/words/word1",
      "/en/faq",
      "/en/auth/login",
    ]) {
      await page.goto(path);

      const gradients = await page.evaluate(() =>
        Array.from(document.querySelectorAll("*"))
          .filter((el) => {
            const image = getComputedStyle(el).backgroundImage;
            return image.includes("gradient");
          })
          .map((el) => el.tagName + "." + (el.className || "").toString().slice(0, 40)),
      );

      expect(gradients, `${path} still has gradients`).toEqual([]);
    }
  });

  test("depth comes from solid offset blocks, not blur shadows", async ({ page }) => {
    await page.goto("/en");

    const blurred = await page.evaluate(() =>
      Array.from(document.querySelectorAll("*")).filter((el) => {
        const shadow = getComputedStyle(el).boxShadow;
        if (shadow === "none") return false;

        // A blur radius above zero is a soft drop shadow.
        const match = shadow.match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/);
        return match ? parseFloat(match[3]) > 0 : false;
      }).length,
    );

    expect(blurred).toBe(0);
  });

  test("the type scale is large enough for young readers", async ({ page }) => {
    await page.goto("/en");

    const sizes = await page.evaluate(() => ({
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      heading: parseFloat(
        getComputedStyle(document.querySelector("h1") as Element).fontSize,
      ),
    }));

    expect(sizes.root).toBeGreaterThanOrEqual(18);
    expect(sizes.heading).toBeGreaterThanOrEqual(36);
  });

  test("hover changes transform, not a shadow", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/en");

    const tile = page.locator(".play-tile").first();
    await expect(tile).toBeVisible();

    const before = await tile.evaluate((el) => getComputedStyle(el).transform);
    await tile.hover();
    await expect
      .poll(() => tile.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe(before);
  });

  test("the hero word deck cycles three opaque, contained fronts", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);

      for (const locale of ["en", "th"]) {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.goto(`/${locale}`);

        const cards = page.getByTestId("hero-word-illustration").locator(".hero-card-cycle");
        await expect(cards).toHaveCount(3);
        const animation = await cards.evaluateAll((elements) =>
          elements.map((element) => {
            const style = getComputedStyle(element);
            return {
              name: style.animationName,
              duration: style.animationDuration,
              iterations: style.animationIterationCount,
              state: style.animationPlayState,
              willChange: style.willChange,
            };
          }),
        );
        animation.forEach((card) => {
          expect(card.name).toContain("heroCardCycle");
          expect(card.duration).toBe("12s");
          expect(card.iterations).toBe("infinite");
          expect(card.state).toBe("running");
          expect(card.willChange).toContain("transform");
          expect(card.willChange).not.toContain("opacity");
        });

        const fronts = new Set<string>();
        let baseline: HeroPhase | undefined;
        for (const time of [1000, 5000, 9000]) {
          await seekHeroAt(page, time);
          const phase = await readHeroPhase(page);
          expectValidHeroPhase(phase);
          fronts.add(phase.frontWord);

          if (!baseline) baseline = phase;
          else {
            expect(phase.root.top).toBeCloseTo(baseline.root.top, 1);
            expect(phase.root.height).toBeCloseTo(baseline.root.height, 1);
            expect(phase.followingTop).toBeCloseTo(baseline.followingTop, 1);
          }
        }
        expect(fronts.size).toBe(3);
      }
    }
  });

  test("the reduced-motion hero is a deliberate static three-card deck", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en");

    const illustration = page.getByTestId("hero-word-illustration");
    await illustration.scrollIntoViewIfNeeded();
    const contract = await illustration.locator(".hero-card-cycle").evaluateAll((cards) =>
      cards.map((card) => {
        const style = getComputedStyle(card);
        return {
          animation: style.animationName,
          opacity: style.opacity,
          transform: style.transform,
          willChange: style.willChange,
          zIndex: Number(style.zIndex),
        };
      }),
    );
    expect(contract.map(({ zIndex }) => zIndex).sort((a, b) => a - b)).toEqual([
      10, 20, 30,
    ]);
    expect(new Set(contract.map(({ transform }) => transform)).size).toBe(3);
    contract.forEach((card) => {
      expect(card.animation).toBe("none");
      expect(card.opacity).toBe("1");
      expect(card.willChange).toBe("auto");
    });

    const before = await readHeroPhase(page);
    expectValidHeroPhase(before);
    await page.waitForTimeout(1000);
    const after = await readHeroPhase(page);
    expectValidHeroPhase(after);
    expect(after.frontWord).toBe(before.frontWord);
    expect(after.rearTransforms).toEqual(before.rearTransforms);
    expect(after.root.top).toBeCloseTo(before.root.top, 1);
    expect(after.root.height).toBeCloseTo(before.root.height, 1);
    expect(after.followingTop).toBeCloseTo(before.followingTop, 1);
  });
});

test.describe("motion respects the learner", () => {
  test("confetti does not run when reduced motion is requested", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en/learn?level=A1&unit=1");

    for (let index = 0; index < 8; index += 1) {
      await answerMixedItem(page);
      await page.getByTestId("session-continue").click();
    }

    // The element may exist, but nothing may animate or paint.
    const visible = await page
      .locator(".play-confetti-piece")
      .first()
      .isVisible()
      .catch(() => false);

    expect(visible).toBe(false);
  });

  test("pressable elements do not transform under reduced motion", async ({
    page,
  }) => {
    await registerThroughUi(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/en/learn?level=A1&unit=1");

    const animation = await page
      .getByTestId("session-option")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);

    expect(["0s", "0s, 0s, 0s"]).toContain(animation);
  });
});

test.describe("interaction states are designed", () => {
  test("focus is designed, not left to the browser default", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/learn?level=A1&unit=1");

    // Programmatic focus does not reliably match :focus-visible, so assert the rule
    // itself is shipped and that it sets a real outline.
    const rule = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;

        try {
          rules = sheet.cssRules;
        } catch {
          continue; // cross-origin stylesheet
        }

        for (const cssRule of Array.from(rules)) {
          const text = cssRule.cssText;
          if (text.includes(":focus-visible") && text.includes("outline")) {
            return text;
          }
        }
      }

      return null;
    });

    expect(rule).toBeTruthy();
    expect(rule).toContain("outline");
  });

  test("the focused action really paints an outline", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/learn?level=A1&unit=1");

    await expect(page.getByTestId("session-option").first()).toBeVisible();

    // Focus the neighbour, then Tab: that makes the next focus keyboard-initiated,
    // which is the condition :focus-visible actually tests for.
    await page.getByTestId("session-option").first().focus();
    await page.keyboard.press("Tab");

    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;

      const style = getComputedStyle(el);
      return {
        matchesFocusVisible: el.matches(":focus-visible"),
        outlineWidth: parseFloat(style.outlineWidth),
      };
    });

    expect(focused?.matchesFocusVisible).toBe(true);
    expect(focused?.outlineWidth).toBeGreaterThan(0);
  });

  test("answer buttons carry an icon as well as colour", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/learn?level=A1&unit=1");

    await page.getByTestId("session-option").first().click();
    const feedback = page.getByTestId("session-feedback");
    await expect(feedback).toBeVisible();
    await expect(feedback.locator("svg")).toBeVisible();
  });
});

test.describe("mobile-first", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the lesson does not scroll sideways on a phone", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/learn?level=A1&unit=1");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );

    expect(overflows).toBe(false);
  });

  test("answer buttons are thumb-sized", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/learn?level=A1&unit=1");

    const button = page.getByTestId("session-option").first();

    // Wait for the card to settle: boundingBox() is null while the route is still
    // showing its loading state, which reads as a 0px button rather than a slow one.
    await expect(button).toBeVisible();

    const box = await button.boundingBox();

    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("the profile does not scroll sideways either", async ({ page }) => {
    await registerThroughUi(page);
    await page.goto("/en/profile");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );

    expect(overflows).toBe(false);
  });

  /**
   * The landing page's job is to get a first-time visitor into a word list, and a phone is
   * the default device (SPEC §6.1). The primary action used to sit below 844px: the hero
   * spent 80px of padding above a 49.5px headline that wrapped to five lines of Thai, so
   * the one control the page exists for was reachable only by scrolling.
   *
   * Asserted in both locales because Thai wraps to more lines than English at the same
   * size — the locale that fits is not evidence for the one that has to.
   */
  for (const locale of ["th", "en"] as const) {
    test(`the landing page's primary action is above the fold (${locale})`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);

      const cta = page.locator("section a[href*='english/a1']").first();
      await expect(cta).toBeVisible();

      const box = await cta.boundingBox();

      expect(box, "primary CTA has no box").not.toBeNull();
      expect(
        box!.y + box!.height,
        `${locale} primary CTA ends below the 844px fold`,
      ).toBeLessThanOrEqual(844);
    });
  }
});
