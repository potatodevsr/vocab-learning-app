# Cypress full-stack harness

The release gate has two complementary full-stack suites. Playwright owns the broad
route, behavior, API, accessibility, hover, and design inventory. Cypress independently
checks its focused browser flows and visual behavior. Neither suite replaces the other.

## Commands

```bash
pnpm test:e2e:cypress       # headless, CI-safe run
pnpm test:e2e:cypress:open  # interactive Cypress runner against the same isolated stack
pnpm test:release           # Playwright first, then Cypress; each owns its own stack
pnpm test:all               # coverage audit + typecheck + the sequential release gate
```

The repository-native Node lifecycle runner owns the entire stack. Every invocation:

1. fails if either Cypress port is already occupied (servers are never reused),
2. installs the backend's locked dependencies and generates only the Prisma client,
3. wipes `backend/.wrangler/cypress-state`, applies Wrangler D1 migrations, and loads the
   deterministic e2e SQL seed,
4. starts the real Hono Worker under `wrangler dev --local` on port 4200 with
   `APP_URL=http://localhost:3200` and explicit local-only `MAGIC_LINK_DEV_MODE=true`,
5. creates a Turbopack production build with the Cypress API origin baked in,
6. starts `next start` on port 3200, then runs Cypress, and
7. terminates both process groups even when setup or a test fails.

The full-stack smoke spec registers `cypress-harness-001@example.com` through the browser,
checks the host-only HTTP-only login cookie, and calls the real `/user/me` API with that
cookie. The magic-link spec registers a second account, clears its session, redeems a real
development magic link, checks destination preservation, and verifies localized invalid-
link recovery at the 390px mobile baseline. The hero spec covers its animation phases,
reduced-motion behavior, containment, contrast, and layout stability.

`pnpm test:release` is deliberately a plain sequential composition. Playwright starts and
stops its isolated 3100/4100 stack before the Cypress lifecycle runner builds and starts
its separate 3200/4200 stack. It does not wrap either suite in another server launcher,
so there are no recursive or shared servers.

## Isolation and topology

| Suite | Web | API | D1 state |
| --- | ---: | ---: | --- |
| Development | 3000 | 4000 | `backend/.wrangler/state` |
| Playwright | 3100 | 4100 | `backend/.wrangler/e2e-state` |
| Cypress | 3200 | 4200 | `backend/.wrangler/cypress-state` |

Browser application requests use the web Worker's same-origin `/api/*` forwarder. The
Cypress configuration exposes the isolated API origin only for explicit API assertions;
the app itself does not bypass the forwarder.

## Artifacts

- screenshots: `cypress/artifacts/screenshots/`
- videos: `cypress/artifacts/videos/`
- lifecycle, build, server, and Cypress logs: `cypress/artifacts/logs/`

Artifacts are replaced on each run and ignored by Git. Retries are disabled in both run
and interactive modes so a transient or shared-state failure remains visible.

The broader route/branch coverage inventory remains in `docs/TEST-COVERAGE.md`. Cypress
coverage must be represented there alongside Playwright coverage when its current owner
finishes the coordinated coverage-map update.
