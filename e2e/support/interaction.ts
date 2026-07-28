import { mkdirSync, writeFileSync } from "node:fs";

import type { Page } from "@playwright/test";

/**
 * The instrument behind `hover-states.spec.ts`.
 *
 * SPEC §6.1 craft bar #2 says every interactive element has four states — rest, hover,
 * active, focus-visible — and that focus is designed rather than inherited. That rule is
 * unenforceable by review: a button that looks fine at rest and does nothing on hover
 * reads as broken only when a real pointer is over it. So the sweep walks every
 * interactive element on a page, measures what the browser computes before and after the
 * pointer arrives, and photographs each one mid-hover.
 *
 * Screenshots land in `test-results/hover-states/<page>/` — one rest shot of the whole
 * page, then one viewport shot per element while it is hovered. That directory is
 * Playwright's own output root, so it is gitignored and cleared at the start of every
 * run: the pictures are always from the run you just did.
 */
export const SHOT_DIR = "test-results/hover-states";

/** Everything a pointer can meaningfully land on. */
export const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="switch"]',
  "select",
  "textarea",
  'input:not([type="hidden"])',
  "summary",
  '[tabindex="0"]',
].join(", ");

export type Finding = {
  element: string;
  reason: string;
};

type Stamped = {
  idx: number;
  desc: string;
  tag: string;
  cursor: string;
  disabled: boolean;
};

/**
 * Tags every visible interactive element with `data-hover-idx` so each one can be
 * addressed by a stable locator afterwards, and reports what it is.
 */
const stampInteractive = async (
  page: Page,
  root: string,
): Promise<Stamped[]> =>
  page.evaluate(([selector, rootSelector]) => {
    const describe = (el: Element) => {
      const testId = el.getAttribute("data-testid");
      const label = (el.getAttribute("aria-label") ?? el.textContent ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 44);
      const classes =
        typeof el.className === "string"
          ? el.className
              .split(/\s+/)
              .filter((name) => name.startsWith("play-"))
              .join(".")
          : "";

      return [
        el.tagName.toLowerCase(),
        testId ? `#${testId}` : "",
        label ? `"${label}"` : "",
        classes ? `.${classes}` : "",
      ]
        .filter(Boolean)
        .join(" ");
    };

    const out: {
      idx: number;
      desc: string;
      tag: string;
      cursor: string;
      disabled: boolean;
    }[] = [];

    const scope = document.querySelector(rootSelector) ?? document;

    Array.from(scope.querySelectorAll(selector)).forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);

      // Zero-size, hidden or fully transparent controls are not something a pointer can
      // reach — measuring them would only produce noise.
      if (rect.width < 6 || rect.height < 6) return;
      if (style.visibility === "hidden" || style.opacity === "0") return;

      el.setAttribute("data-hover-idx", String(index));

      out.push({
        idx: index,
        desc: describe(el),
        tag: el.tagName.toLowerCase(),
        cursor: style.cursor,
        disabled:
          el.hasAttribute("disabled") ||
          el.getAttribute("aria-disabled") === "true",
      });
    });

    return out;
  }, [INTERACTIVE_SELECTOR, root] as const);

/**
 * Everything a hover is allowed to change, for the element itself, its pseudo-elements,
 * its first descendants (`group-hover:` styling) and its nearest ancestors (a link inside
 * a sticker tile lifts the tile, and that is real feedback).
 */
const readState = (el: Element) => {
  const props = (style: CSSStyleDeclaration) =>
    [
      style.transform,
      style.translate,
      style.scale,
      style.rotate,
      style.backgroundColor,
      style.backgroundImage,
      style.backgroundPosition,
      style.color,
      style.borderColor,
      style.borderWidth,
      style.borderRadius,
      style.outlineColor,
      style.outlineWidth,
      style.opacity,
      style.boxShadow,
      style.textDecorationLine,
      style.textDecorationColor,
      style.filter,
      style.letterSpacing,
    ].join("|");

  const forNode = (node: Element) =>
    [
      props(getComputedStyle(node)),
      props(getComputedStyle(node, "::before")),
      props(getComputedStyle(node, "::after")),
    ].join("~");

  const parts = [forNode(el)];

  for (const child of Array.from(el.querySelectorAll("*")).slice(0, 16)) {
    parts.push(forNode(child));
  }

  let ancestor = el.parentElement;

  for (let depth = 0; depth < 3 && ancestor; depth += 1) {
    parts.push(forNode(ancestor));
    ancestor = ancestor.parentElement;
  }

  return parts.join("\n");
};

/** Put the element in the middle of the viewport so its photo has context around it. */
const centreInView = (el: Element) =>
  el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "element";

/**
 * Hovers every interactive element on the current page, photographs each hover, and
 * reports the ones that gave the pointer nothing back.
 *
 * `settle` covers `--dur-slow` (400ms) so a slow celebration transition is not mistaken
 * for a missing one.
 */
export const sweepHoverStates = async (
  page: Page,
  name: string,
  /**
   * Narrows the sweep, for states where part of the page is deliberately unreachable:
   * an open dropdown puts a Radix overlay over everything behind it, and reporting the
   * page underneath as "covered" would be true but useless.
   */
  root = ":root",
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  // Park the pointer off every control first: a leftover hover from the previous action
  // would be measured as the rest state.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);

  await page.screenshot({
    path: `${SHOT_DIR}/${name}/00-rest.png`,
    fullPage: true,
  });

  const stamped = await stampInteractive(page, root);

  for (const [order, item] of stamped.entries()) {
    const element = page.locator(`[data-hover-idx="${item.idx}"]`);
    const file = `${SHOT_DIR}/${name}/${String(order + 1).padStart(2, "0")}-${slug(item.desc)}.png`;

    await page.mouse.move(0, 0);
    await element.evaluate(centreInView);
    await page.waitForTimeout(80);

    const rest = await element.evaluate(readState);

    try {
      await element.hover({ timeout: 3000 });
    } catch {
      // A disabled control is *meant* to be unreachable (`pointer-events: none`), so
      // failing to hover one is the design working. Anything else is a real layout bug:
      // a control a pointer cannot reach — SPEC §6 calls out exactly that, the floating
      // navbar colliding with page headers.
      if (!item.disabled) {
        findings.push({
          element: item.desc,
          reason: "covered by another element",
        });
      }

      continue;
    }

    // Past `--dur-slow`, so the photo catches the settled state rather than a frame
    // halfway through the transition.
    await page.waitForTimeout(420);

    const hovered = await element.evaluate(readState);

    // The viewport, not a clip: the element is centred, and one viewport capture is far
    // cheaper than re-rendering a 2,500px page for every control on it.
    await page.screenshot({ path: file });

    if (item.disabled) continue;

    if (rest === hovered) {
      findings.push({ element: item.desc, reason: "hover changes nothing" });
    }

    const wantsPointer =
      item.tag === "a" || item.tag === "button" || item.tag === "summary";

    if (wantsPointer && item.cursor !== "pointer") {
      findings.push({
        element: item.desc,
        reason: `cursor is "${item.cursor}", not "pointer"`,
      });
    }
  }

  recordFindings(name, "hover", findings);

  return findings;
};

/**
 * Findings are written next to the screenshots as they are measured: the reporter only
 * prints assertion detail once the whole file has finished, and a sweep this long is far
 * easier to act on page by page.
 */
export const recordFindings = (
  name: string,
  kind: string,
  findings: Finding[],
) => {
  mkdirSync(`${SHOT_DIR}/${name}`, { recursive: true });
  writeFileSync(
    `${SHOT_DIR}/${name}/${kind}.json`,
    JSON.stringify(findings, null, 2),
  );
};

/**
 * Contrast of every interactive label against what is *actually* painted behind it.
 *
 * `getComputedStyle(el).backgroundColor` is transparent for most controls, so the real
 * backdrop has to be composited down the ancestor chain — that is the difference between
 * "white text on a translucent white pill" reading as fine and reading as the invisible
 * button it is.
 */
export const findUnreadableControls = async (
  page: Page,
  root = ":root",
): Promise<Finding[]> =>
  page.evaluate(([selector, rootSelector]) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    /** Chrome computes colours as `oklch(...)`; let the browser do the conversion. */
    const rgba = (colour: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, 1, 1);

      const [r, g, b, a] = Array.from(ctx.getImageData(0, 0, 1, 1).data);

      return { r, g, b, a: a / 255 };
    };

    type Rgb = { r: number; g: number; b: number };

    const over = (top: { r: number; g: number; b: number; a: number }, under: Rgb): Rgb => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
    });

    const luminance = ({ r, g, b }: Rgb) => {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };

      return (
        0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
      );
    };

    const contrast = (a: Rgb, b: Rgb) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };

    /** Composite every painted ancestor background down onto white. */
    const backdrop = (el: Element): Rgb => {
      const stack: { r: number; g: number; b: number; a: number }[] = [];

      for (let node: Element | null = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const layer = rgba(style.backgroundColor);
        const alpha = layer.a * parseFloat(style.opacity || "1");

        if (alpha > 0.001) stack.push({ ...layer, a: alpha });
        if (alpha > 0.995) break;
      }

      let base: Rgb = { r: 255, g: 255, b: 255 };

      for (const layer of stack.reverse()) base = over(layer, base);

      return base;
    };

    const out: { element: string; reason: string }[] = [];

    const scope = document.querySelector(rootSelector) ?? document;

    for (const el of Array.from(scope.querySelectorAll(selector))) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);

      if (rect.width < 6 || rect.height < 6) continue;
      if (style.visibility === "hidden" || style.opacity === "0") continue;
      if (el.hasAttribute("disabled")) continue;

      const text = (el.textContent ?? "").trim();
      const hasGlyphs = text.length > 0 || el.querySelector("svg") !== null;

      if (!hasGlyphs) continue;

      const ink = rgba(style.color);
      const paper = backdrop(el);
      const ratio = contrast(over(ink, paper), paper);

      const size = parseFloat(style.fontSize);
      const weight = parseInt(style.fontWeight, 10) || 400;
      const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
      const floor = isLarge ? 3 : 4.5;

      if (ratio < floor) {
        const label =
          (el.getAttribute("aria-label") ?? text).replace(/\s+/g, " ").slice(0, 44) ||
          el.tagName.toLowerCase();

        out.push({
          element: `${el.tagName.toLowerCase()} "${label}"`,
          reason: `contrast ${ratio.toFixed(2)}:1 (needs ${floor}:1)`,
        });
      }
    }

    return out;
  }, [INTERACTIVE_SELECTOR, root] as const);
