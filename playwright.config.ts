import { defineConfig, devices } from "@playwright/test";

/**
 * Full-stack e2e: real Next.js build, real Hono Worker on `wrangler dev --local`,
 * real D1 database. No mocks and no stubbed network — tests drive the UI and the
 * rows they create are really committed.
 *
 * The API server command resets + migrates + seeds D1 before booting the Worker, so
 * every run starts from an identical, deterministic database.
 */
/**
 * Deliberately NOT 3000/4000: those belong to `pnpm dev`. The e2e stack runs on its own
 * ports with its own D1 state directory (see e2e/scripts/start-api.sh) so a test run can
 * never reuse — or wipe — the database you are developing against.
 */
const API_PORT = 4100;
const WEB_PORT = 3100;

// Must match backend/.dev.vars — middleware verifies user tokens the API signed. Both are
// dev-only throwaways; production signs with a secret set via `wrangler secret put`.
const JWT_SECRET =
  "49022f773409abad1e30a7057912cbe866a42791804a6dd2b0f763055da2b106";

// Unit specs import `constants/config`, which reads this. Without it they would fall back
// to :4000 — the database you develop against — instead of the disposable e2e one.
process.env.NEXT_PUBLIC_API_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // one shared database — parallel writers would race
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      // Reset → migrate → seed → serve. Deterministic on every run.
      command: "bash e2e/scripts/start-api.sh",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Production build, not `next dev` — so a broken build fails the suite, which is
      // the point of gating commits on e2e. Never reuse an existing server: a `next dev`
      // on another port would be built against a different API and a different database.
      command: `pnpm build && pnpm start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/en`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        // Canonicals and the sitemap are absolute; they must match where the suite runs.
        NEXT_PUBLIC_SITE_URL: `http://localhost:${WEB_PORT}`,
        // A non-production ID verifies that the production build wires GA into learner
        // pages. Requests to Google are blocked by the analytics e2e test.
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-E2ETEST",
        // One secret, same name on both sides — middleware verifies what the API signed.
        JWT_SECRET,
      },
    },
  ],
});
