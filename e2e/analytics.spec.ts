import { expect, test } from "@playwright/test";

type DataLayerEntry = Record<string, unknown>;

const stubGa = async (page: import("@playwright/test").Page) => {
  await page.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ status: 204 }),
  );
};

/** Read every recorded `gtag('event', name, params)` call for one event name. */
const eventsNamed = (page: import("@playwright/test").Page, name: string) =>
  page.evaluate((eventName) => {
    const layer = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
    return layer
      .filter((entry) => entry[0] === "event" && entry[1] === eventName)
      .map((entry) => entry[2] as Record<string, unknown>);
  }, name);

test("learner pages load the configured Google Analytics tag with automatic page_view disabled", async ({
  page,
}) => {
  await stubGa(page);

  await page.goto("/en");

  await expect(
    page.locator(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-E2ETEST"]',
    ),
  ).toHaveCount(1);
  // Playwright's toContainText reads rendered innerText, which is deliberately empty for
  // script elements. Inspect the script payload itself.
  const configScript = await page.locator("script#google-analytics").textContent();
  expect(configScript).toContain("gtag('config', 'G-E2ETEST'");
  // GA4 Enhanced Measurement's automatic page_view reads the full URL, query string
  // included — it must be off so the manual tracker (pathname only) is the sole source.
  expect(configScript).toContain("send_page_view: false");
});

test("admin pages do not load Google Analytics", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(
    page.locator('script[src*="googletagmanager.com/gtag/js"]'),
  ).toHaveCount(0);
  await expect(page.locator("script#google-analytics")).toHaveCount(0);
});

test.describe("manual page_view tracker", () => {
  test("fires page_view with a pathname-only page_path on a plain page", async ({
    page,
  }) => {
    await stubGa(page);

    await page.goto("/en/english/A1");

    await expect
      .poll(async () => (await eventsNamed(page, "page_view")).length)
      .toBeGreaterThan(0);

    const [params] = await eventsNamed(page, "page_view");
    expect(params.page_path).toBe("/en/english/A1");
    expect(params.page_location).not.toContain("?");
  });

  test("never forwards the magic-link token or return path on /auth/verify", async ({
    page,
  }) => {
    await stubGa(page);

    // A token this specific would be unmistakable in a beacon if it leaked.
    await page.goto(
      "/en/auth/verify?token=super-secret-magic-token&from=%2Fen%2Fprofile",
    );

    await expect
      .poll(async () => (await eventsNamed(page, "page_view")).length)
      .toBeGreaterThan(0);

    for (const params of await eventsNamed(page, "page_view")) {
      const serialised = JSON.stringify(params);
      expect(serialised).not.toContain("super-secret-magic-token");
      expect(serialised).not.toContain("from=");
      expect(params.page_path).toBe("/en/auth/verify");
    }
  });

  test("carries a query-free page_path on the auth login screen too", async ({
    page,
  }) => {
    await stubGa(page);

    await page.goto("/en/auth/login?from=%2Fen%2Fprofile");

    await expect
      .poll(async () => (await eventsNamed(page, "page_view")).length)
      .toBeGreaterThan(0);

    const [params] = await eventsNamed(page, "page_view");
    expect(params.page_path).toBe("/en/auth/login");
    expect(JSON.stringify(params)).not.toContain("profile");
  });
});
