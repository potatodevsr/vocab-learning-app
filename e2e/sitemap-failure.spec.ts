import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, openSync, readFileSync } from "node:fs";
import { createServer, type Server, get as httpGet } from "node:http";
import { AddressInfo, createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

/**
 * The HTML sitemap when its corpus reads fail — proved against a real HTTP response.
 *
 * This is the one contract in the suite that cannot be tested against the shared stack.
 * `/[locale]/sitemap` renders its header, five static link sections and its footer from
 * message strings alone, so an empty corpus produced a perfectly healthy-looking page: a
 * heading, a handful of links, `HTTP 200`, and `<meta name="robots" content="index,
 * follow">` in the head. A crawler asking for the site's link graph was told the honest
 * answer was "there is almost nothing here", and the URLs it could no longer see linked
 * lost the only page that exists to give them.
 *
 * The first version of this test asserted on the *source* of `error.tsx` — it grepped for
 * the string `noindex`. That passed while the raw response still said `index, follow`,
 * because the boundary's `<meta>` is emitted client-side and arrives only after hydration;
 * worse, once hydrated the document held two contradictory robots tags. A test that reads
 * the implementation rather than the response cannot catch that, which is the whole reason
 * this file exists instead.
 *
 * So: a stub API that answers every read with an empty corpus, a Next server of this
 * repo's own code pointed at it, and assertions on what actually comes back over the wire.
 *
 * **Why `next dev` here specifically.** `playwright.config.ts` is emphatic that the main
 * web server must never be `next dev`, and that stands — a dev server standing in for the
 * gate is how a green run once lied. This is the opposite situation: an isolated,
 * single-purpose server on its own port, asserting a failure contract the production
 * server structurally cannot show. `/[locale]/sitemap` carries `revalidate`, so a
 * `next start` would answer from the HTML prerendered at build time against the *healthy*
 * API and never consult the stub at all. `API_ORIGIN` is read at request time
 * (`constants/config.ts`), which is what lets a second server point somewhere else without
 * a rebuild.
 */

/** An API where every read succeeds and returns nothing — a reachable but empty corpus. */
const startEmptyApi = async (): Promise<{ server: Server; origin: string }> => {
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");

    if (req.url?.startsWith("/curriculum")) {
      res.end(JSON.stringify({ wordlistId: "oxford-3000", words: 0, levels: [] }));
      return;
    }

    if (req.url?.startsWith("/vocabword/paginated")) {
      res.end(JSON.stringify({ data: [], total: 0 }));
      return;
    }

    res.end(JSON.stringify({ data: [] }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return { server, origin: `http://127.0.0.1:${port}` };
};

/**
 * Whether something already holds a port.
 *
 * A previous run that timed out could leave an orphaned dev server behind — `SIGTERM` to
 * `pnpm exec` does not necessarily reach the `next` process it spawned — and the worst
 * outcome is silently testing against *that* server instead of this one's. Refusing to
 * start is the only safe answer.
 */
const portInUse = (port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" })
      .on("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .on("error", () => resolve(false));
  });

/**
 * `http.get` rather than `fetch`.
 *
 * Undici keeps a connection pool alive between polls, and a server that accepts a socket
 * and then dies mid-boot leaves that pool holding a half-open connection — which is how a
 * poll loop ends up waiting the entire budget on a process that is already gone. A plain
 * one-shot request per attempt cannot inherit that state.
 */
const pingOnce = (url: string, timeoutMs: number) =>
  new Promise<number | null>((resolve) => {
    const req = httpGet(url, (res) => {
      res.resume();
      resolve(res.statusCode ?? null);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
  });

const waitForServer = async (
  url: string,
  timeoutMs: number,
  logPath: string,
  child: () => ChildProcess | undefined,
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // A child that has already exited will never answer; say so immediately rather than
    // spending the whole budget discovering it.
    const proc = child();
    if (proc?.exitCode !== null && proc?.exitCode !== undefined) {
      throw new Error(
        `The dev server exited with code ${proc.exitCode} before answering ${url}.\n` +
          `--- its output ---\n${readLog(logPath)}`,
      );
    }

    const status = await pingOnce(url, 5_000);
    // Any answer at all means it is listening; the status is what the tests inspect.
    if (status !== null) return;

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${url}.\n` +
      `--- the dev server's output ---\n${readLog(logPath)}`,
  );
};

const readLog = (path: string) => {
  try {
    return readFileSync(path, "utf8").slice(-4_000) || "(the server produced no output)";
  } catch {
    return "(no log was captured)";
  }
};

/**
 * A cold `next dev` boot plus the first compile of this route, on a machine that has just
 * spent half an hour on `hover-states.spec.ts`.
 *
 * `test.describe.configure` is what raises the *tests'* budget; `test.setTimeout` inside
 * the hook is what raises the **hook's**, and they are genuinely separate. Setting only
 * the former left `beforeAll` on the default 30s, which was enough while `.next/dev` was
 * warm from a previous run and not enough from cold — a spec that passes alone and fails
 * in the suite, which is the worst kind.
 */
const BOOT_BUDGET_MS = 240_000;

test.describe("the HTML sitemap when the corpus cannot be read", () => {
  test.describe.configure({ timeout: BOOT_BUDGET_MS });

  let api: { server: Server; origin: string } | undefined;
  let web: ChildProcess | undefined;
  let logPath = "";
  const webPort = 3210;

  test.beforeAll(async () => {
    test.setTimeout(BOOT_BUDGET_MS);

    if (await portInUse(webPort)) {
      throw new Error(
        `Port ${webPort} is already in use. A previous run probably left a dev server ` +
          "behind; kill it rather than letting this spec assert against it.",
      );
    }

    api = await startEmptyApi();
    logPath = join(tmpdir(), `sitemap-failure-dev-${process.pid}.log`);
    const logFd = openSync(logPath, "w");

    /**
     * `next` directly, not `pnpm exec next`.
     *
     * `pnpm` sits between this process and the server it starts, which cost real debugging
     * time here: a `SIGTERM` aimed at `pnpm` need not reach the `next` process underneath,
     * so a run that timed out left an orphan holding the port and the *next* run then
     * silently asserted against it. `detached` plus a kill on the negative pid closes that
     * off by signalling the whole process group.
     */
    web = spawn(
      "node_modules/.bin/next",
      ["dev", "--port", String(webPort)],
      {
        cwd: process.cwd(),
        detached: true,
        // `Object.assign` rather than a spread: `cloudflare-env.d.ts` types `API_ORIGIN`
        // as the deployed Worker's literal URL, so an object literal assigning a plain
        // string to it does not typecheck once `pnpm cf:typegen` has run.
        env: Object.assign({}, process.env, {
          // Read at request time by `constants/config.ts`, so this server talks to the
          // stub while everything else in the run keeps talking to the real API.
          API_ORIGIN: api.origin,
          NEXT_PUBLIC_API_URL: api.origin,
          NEXT_PUBLIC_SITE_URL: `http://localhost:${webPort}`,
        }),
        stdio: ["ignore", logFd, logFd],
      },
    );

    closeSync(logFd);

    /**
     * Warm the server on a cheap route first.
     *
     * Turbopack compiles per route on first request, and `/en/sitemap` is the heaviest one
     * here — it pulls the whole layout, the message catalogue and this route's own tree.
     * Asking for `/en` first separates "the server is listening" from "this route has
     * compiled", so a slow boot cannot be mistaken for a broken page.
     */
    await waitForServer(`http://localhost:${webPort}/en`, BOOT_BUDGET_MS - 60_000, logPath, () => web);
    await waitForServer(`http://localhost:${webPort}/en/sitemap`, 60_000, logPath, () => web);
  });

  test.afterAll(async () => {
    // The whole process group: `next dev` forks workers, and killing only the parent
    // leaves them holding the port for whatever runs next.
    if (web?.pid) {
      try {
        process.kill(-web.pid, "SIGTERM");
      } catch {
        web.kill("SIGTERM");
      }
    }

    await new Promise<void>((resolve) => {
      if (!api) return resolve();
      api.server.close(() => resolve());
    });
  });

  test("the raw response is noindex, and carries no corpus it could be indexed for", async () => {
    const res = await fetch(`http://localhost:${webPort}/en/sitemap`);
    const html = await res.text();

    /**
     * The directive has to be in the bytes, not in the hydrated DOM.
     *
     * `generateMetadata` resolves before streaming begins, so this is the last moment the
     * page's crawler-visible answer can still be set — and HTML-limited crawlers read
     * nothing else. When the boundary owned this tag instead, the raw response said
     * `index, follow` and this assertion failed.
     */
    expect(html).toMatch(/<meta name="robots" content="noindex/);
    expect(html).not.toMatch(/<meta name="robots" content="index/);

    // Exactly one robots directive. Two — an `index` from the head and a `noindex` from
    // the boundary — is what the previous implementation produced after hydration.
    expect(html.match(/<meta name="robots"/g) ?? []).toHaveLength(1);

    // And nothing that looks like a working sitemap: no word links to be indexed for.
    expect(html).not.toMatch(/href="\/en\/english\/words\/[a-z]/);

    /**
     * The status is `200` and cannot be anything else: this route has a `loading.tsx`, so
     * the response commits before the page component runs (Next 16, "The HTTP contract").
     * Asserting it pins *why* the robots tag above is load-bearing — if this ever becomes
     * a 5xx, the tag stops being the only line of defence and this test should be revisited.
     */
    expect(res.status).toBe(200);
  });

  test("a reader gets the route's error boundary, not a header-and-footer page", async ({
    page,
  }) => {
    await page.goto(`http://localhost:${webPort}/en/sitemap`);

    await expect(page.getByTestId("sitemap-error")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.locator('a[href*="/english/words/"]')).toHaveCount(0);

    // Still noindex once React has hydrated, and still only one of them.
    await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});
