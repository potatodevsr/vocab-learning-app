const ROOT = '[data-testid="hero-word-illustration"]';
const STAGE = '[data-testid="hero-card-stage"]';
const CARDS = `${ROOT} .hero-card-cycle`;
const PHASES = [1000, 5000, 9000] as const;
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;
const LOCALES = ["en", "th"] as const;

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type HeroState = {
  root: Rect;
  followingTop: number;
  viewportWidth: number;
  scrollWidth: number;
  cardSurface: number[];
  cards: Array<{
    word: string;
    zIndex: number;
    opacity: string;
    background: number[];
    transform: string;
    rect: Rect;
  }>;
  frontWord: string;
  frontContained: boolean;
  frontContentContained: boolean;
  maxRearOverflow: number;
  rearHeadingsOccluded: boolean;
  contrast: Array<{ label: string; ratio: number }>;
};

const emulateReducedMotion = (value: "reduce" | "no-preference") =>
  cy.then(() => {
    if (Cypress.browser.family !== "chromium") {
      throw new Error("The hero motion contract requires Chromium CDP emulation");
    }

    return Cypress.automation("remote:debugger:protocol", {
      command: "Emulation.setEmulatedMedia",
      params: {
        features: [{ name: "prefers-reduced-motion", value }],
      },
    });
  });

const visitHome = (locale: string) => {
  cy.visit(`/${locale}`, {
    onBeforeLoad(win) {
      const tracked = win as Window & {
        __heroConsoleErrors?: string[];
        __heroLayoutShift?: number;
      };
      tracked.__heroConsoleErrors = [];
      tracked.__heroLayoutShift = 0;

      const originalError = win.console.error;
      win.console.error = (...args) => {
        tracked.__heroConsoleErrors?.push(args.map(String).join(" "));
        originalError.apply(win.console, args);
      };

      if ("PerformanceObserver" in win) {
        new win.PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & {
              hadRecentInput?: boolean;
              value?: number;
            };
            if (!shift.hadRecentInput) {
              tracked.__heroLayoutShift =
                (tracked.__heroLayoutShift ?? 0) + (shift.value ?? 0);
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      }
    },
  });
  cy.get(ROOT).scrollIntoView().should("be.visible");
  cy.get(STAGE).should("be.visible");
  cy.get(CARDS).should("have.length", 3);
};

const seekHero = (time: number) => {
  return cy.get(CARDS).then(($cards) => {
    [...$cards].forEach((card) => {
      card.style.animationPlayState = "paused";
      card.getAnimations().forEach((animation) => {
        animation.pause();
        animation.currentTime = time;
      });
    });
  }).then(() => cy.window()).then(
    (win) =>
      new Cypress.Promise<void>((resolve) => {
        win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()));
      }),
  );
};

const readHero = (): Cypress.Chainable<HeroState> =>
  cy.window().then((win) => {
    const root = win.document.querySelector<HTMLElement>(ROOT);
    const cards = [...win.document.querySelectorAll<HTMLElement>(CARDS)];
    if (!root || cards.length !== 3) throw new Error("Hero deck is incomplete");

    const toRect = (element: Element): Rect => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const toRgba = (colour: string) => {
      const canvas = win.document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas colour conversion is unavailable");
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
    const stateCards = cards.map((card) => {
      const style = win.getComputedStyle(card);
      return {
        word: card.dataset.heroWord ?? "",
        zIndex: Number(style.zIndex),
        opacity: style.opacity,
        background: toRgba(style.backgroundColor),
        transform: style.transform,
        rect: toRect(card),
      };
    });
    const front = cards.find((card) => win.getComputedStyle(card).zIndex === "30");
    if (!front) throw new Error("Hero deck has no front card");
    const frontRect = front.getBoundingClientRect();
    const inside = (rect: DOMRect, container: DOMRect, tolerance = 1) =>
      rect.left >= container.left - tolerance &&
      rect.top >= container.top - tolerance &&
      rect.right <= container.right + tolerance &&
      rect.bottom <= container.bottom + tolerance;
    const frontDescendants = [...front.querySelectorAll<HTMLElement>("*")].filter(
      (node) => node.getBoundingClientRect().width > 0,
    );
    const rearCards = cards.filter((card) => card !== front);
    const maxRearOverflow = Math.max(
      0,
      ...rearCards.flatMap((card) => {
        const rect = card.getBoundingClientRect();
        return [
          rootRect.left - rect.left,
          rootRect.top - rect.top,
          rect.right - rootRect.right,
          rect.bottom - rootRect.bottom,
        ];
      }),
    );
    const rearHeadingsOccluded = rearCards.every((card) => {
      const heading = card.querySelector("h3");
      if (!heading) return false;
      const rect = heading.getBoundingClientRect();
      const stack = win.document.elementsFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      const frontIndex = stack.indexOf(front);
      const rearIndex = stack.indexOf(card);
      return frontIndex >= 0 && rearIndex >= 0 && frontIndex < rearIndex;
    });
    const contrast = [...front.querySelectorAll<HTMLElement>("h3, p, span")]
      .filter((node) => node.textContent?.trim())
      .map((node) => {
        let ancestor: HTMLElement | null = node;
        let background = toRgba("transparent");
        while (ancestor) {
          background = toRgba(win.getComputedStyle(ancestor).backgroundColor);
          if (background[3] === 255) break;
          ancestor = ancestor.parentElement;
        }
        return {
          label: node.textContent?.trim().replace(/\s+/g, " ") ?? node.tagName,
          ratio: ratio(toRgba(win.getComputedStyle(node).color), background),
        };
      });
    const section = root.closest("section");
    const followingTop = section?.nextElementSibling?.getBoundingClientRect().top;
    if (followingTop === undefined) throw new Error("Hero following section is missing");

    return {
      root: toRect(root),
      followingTop,
      viewportWidth: win.innerWidth,
      scrollWidth: win.document.documentElement.scrollWidth,
      cardSurface: toRgba(
        win.getComputedStyle(win.document.documentElement).getPropertyValue("--card"),
      ),
      cards: stateCards,
      frontWord: front.dataset.heroWord ?? "",
      frontContained: inside(frontRect, rootRect),
      frontContentContained: frontDescendants.every(
        (node) => inside(node.getBoundingClientRect(), frontRect) &&
          inside(node.getBoundingClientRect(), rootRect),
      ),
      maxRearOverflow,
      rearHeadingsOccluded,
      contrast,
    };
  });

const assertHeroSurfaceAndGeometry = (state: HeroState) => {
  expect(state.cards.map(({ zIndex }) => zIndex).sort((a, b) => a - b)).to.deep.equal([
    10, 20, 30,
  ]);
  state.cards.forEach((card) => {
    expect(card.opacity, `${card.word} opacity`).to.equal("1");
    expect(card.background, `${card.word} background`).to.deep.equal(state.cardSurface);
    expect(card.background[3], `${card.word} background alpha`).to.equal(255);
  });
  expect(state.frontContained, `${state.frontWord} front containment`).to.equal(true);
  expect(state.frontContentContained, `${state.frontWord} content containment`).to.equal(
    true,
  );
  expect(state.maxRearOverflow, "rear decorative edge overflow").to.be.at.most(8);
  expect(state.rearHeadingsOccluded, "rear headings are covered by the front").to.equal(
    true,
  );
  expect(state.scrollWidth).to.be.at.most(state.viewportWidth + 1);
  state.contrast.forEach(({ label, ratio }) => {
    expect(ratio, `${label} contrast`).to.be.at.least(4.5);
  });
};

const assertCleanRuntime = () =>
  cy.window().then((win) => {
    const tracked = win as Window & {
      __heroConsoleErrors?: string[];
      __heroLayoutShift?: number;
    };
    expect(tracked.__heroConsoleErrors ?? [], "browser console errors").to.deep.equal([]);
    expect(tracked.__heroLayoutShift ?? 0, "layout shift").to.be.at.most(0.001);
  });

describe("home hero word deck", () => {
  for (const { width, height } of VIEWPORTS) {
    for (const locale of LOCALES) {
      it(`${locale} cycles three opaque fronts at ${width}x${height}`, () => {
        cy.viewport(width, height);
        emulateReducedMotion("no-preference");
        visitHome(locale);

        cy.get(CARDS).each(($card) => {
          const style = getComputedStyle($card[0]);
          expect(style.animationName).to.contain("heroCardCycle");
          expect(style.animationDuration).to.equal("12s");
          expect(style.animationIterationCount).to.equal("infinite");
          expect(style.animationPlayState).to.equal("running");
          expect(style.willChange).to.contain("transform");
          expect(style.willChange).not.to.contain("opacity");
        });

        const fronts: string[] = [];
        let firstLayout: Pick<HeroState, "root" | "followingTop"> | undefined;
        cy.wrap([...PHASES]).each((phase: number) =>
          seekHero(phase)
            .then(() => readHero())
            .then((state) => {
            assertHeroSurfaceAndGeometry(state);
            fronts.push(state.frontWord);
            if (!firstLayout) firstLayout = { root: state.root, followingTop: state.followingTop };
            else {
              expect(state.root.top).to.be.closeTo(firstLayout.root.top, 0.5);
              expect(state.root.height).to.be.closeTo(firstLayout.root.height, 0.5);
              expect(state.followingTop).to.be.closeTo(firstLayout.followingTop, 0.5);
            }
            return readHero().then((captureState) => {
              expect(captureState.frontWord, "front immediately before capture").to.equal(
                state.frontWord,
              );
              return cy.get(ROOT).screenshot(
                `hero-cards/${locale}/${width}x${height}/normal-${state.frontWord}`,
                { overwrite: true, disableTimersAndAnimations: false },
              );
            });
            }),
        );

        cy.then(() => expect(new Set(fronts).size, "three changing fronts").to.equal(3));
        assertCleanRuntime();
      });

      it(`${locale} has a static reduced-motion deck at ${width}x${height}`, () => {
        cy.viewport(width, height);
        emulateReducedMotion("reduce");
        visitHome(locale);

        let initial: HeroState;
        readHero().then((state) => {
          initial = state;
          assertHeroSurfaceAndGeometry(state);
          expect(state.cards.map(({ transform }) => transform)).to.have.length(3);
          expect(new Set(state.cards.map(({ transform }) => transform)).size).to.equal(3);
          state.cards.forEach((card) => {
            const element = Cypress.$(`[data-hero-word="${card.word}"]`)[0];
            const style = getComputedStyle(element);
            expect(style.animationName).to.equal("none");
            expect(style.willChange).to.equal("auto");
          });
          cy.get(ROOT).screenshot(
            `hero-cards/${locale}/${width}x${height}/reduced-static-stack`,
            { overwrite: true, disableTimersAndAnimations: false },
          );
        });

        cy.wait(1000, { log: false });
        readHero().then((state) => {
          assertHeroSurfaceAndGeometry(state);
          expect(state.cards.map(({ transform, zIndex }) => ({ transform, zIndex }))).to.deep.equal(
            initial.cards.map(({ transform, zIndex }) => ({ transform, zIndex })),
          );
          state.cards.forEach((card, index) => {
            const before = initial.cards[index].rect;
            expect(card.rect.left).to.be.closeTo(before.left, 0.5);
            expect(card.rect.top).to.be.closeTo(before.top, 0.5);
            expect(card.rect.width).to.be.closeTo(before.width, 0.5);
            expect(card.rect.height).to.be.closeTo(before.height, 0.5);
          });
        });
        assertCleanRuntime();
      });
    }
  }
});
