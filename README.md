<p align="center">
  <img src="docs/assets/readme-hero.png" alt="Vocab Learning — playful language cards connecting English prompts to Thai vocabulary" width="100%" />
</p>

<h1 align="center">Vocab Learning</h1>

<p align="center">
  <strong>Learn Thai through English words you already know.</strong><br />
  Short, playful lessons built around Oxford 3000 prompts, Thai pronunciation, quizzes, and spaced review.
</p>

<p align="center">
  <a href="https://vocab-learning-app.hoshiku1997.workers.dev"><strong>Try the live app →</strong></a>
  · <a href="#run-it-locally">Run locally</a>
  · <a href="#contributing">Contribute</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-111827?style=flat-square&logo=next.js" />
  <img alt="React" src="https://img.shields.io/badge/React-19-087ea4?style=flat-square&logo=react" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat-square&logo=cloudflare&logoColor=white" />
</p>

## Why Vocab Learning?

Learning a new script is easier when the meaning is already familiar. Vocab Learning uses common English words as prompts, then helps learners connect them to Thai vocabulary, textbook letter forms, pronunciation, and real examples.

- **3,000 familiar prompts** based on the Oxford 3000 word list
- **Bilingual learning cards** with Thai readings and pronunciation support
- **Short quizzes** with immediate, useful feedback
- **Smart review loops** that bring difficult words back
- **Progress tracking** across lessons, quizzes, mastery, and mistakes
- **English and Thai interfaces**, responsive from mobile to desktop
- **Installable PWA** for a focused, app-like learning experience

## How a lesson works

```text
Choose a level  →  Learn the cards  →  Take a short quiz  →  Review weak words
```

The learning loop is intentionally small: a lesson takes only a few minutes, progress is saved to the learner’s account, and missed words return for another attempt.

## Built with

| Layer | Technology |
| --- | --- |
| Web app | Next.js 16, React 19, TypeScript, Tailwind CSS |
| API | Hono on Cloudflare Workers |
| Data | Cloudflare D1, Prisma |
| Internationalization | `next-intl` |
| Authentication | Email magic links, password auth, Google OAuth |
| Quality | ESLint, TypeScript, Playwright, Cypress |
| Deployment | OpenNext + Cloudflare Workers |

## Run it locally

### Prerequisites

- Node.js 20 or newer
- [pnpm](https://pnpm.io/) 10 or newer

### 1. Install dependencies

```bash
pnpm install
pnpm --dir backend install
```

### 2. Prepare the local database

```bash
pnpm --dir backend db:migrate:local
pnpm --dir backend db:seed:dev
```

### 3. Start the API and web app

Open two terminals:

```bash
# Terminal 1 — API at http://localhost:4000
pnpm --dir backend dev
```

```bash
# Terminal 2 — web app at http://localhost:3000
pnpm dev
```

Then visit [http://localhost:3000](http://localhost:3000). Local development uses Wrangler’s local D1 state, so it does not touch production data.

## Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js development server |
| `pnpm build` | Create a production web build |
| `pnpm lint` | Run ESLint |
| `pnpm exec tsc --noEmit` | Type-check the project |
| `pnpm test:e2e` | Run Playwright tests |
| `pnpm test:e2e:cypress` | Run the full-stack Cypress suite |
| `pnpm test:all` | Run the complete release gate |
| `pnpm cf:preview` | Preview the Cloudflare build locally |

## Project structure

```text
app/          Next.js routes, pages, metadata, and API forwarder
backend/      Hono API, Prisma schema, D1 migrations, and seed data
components/   Learning flows and reusable UI components
data/         Oxford 3000 source and vocabulary patches
docs/         Product, lifecycle, testing, and architecture notes
e2e/          Playwright end-to-end tests
lib/          Shared domain logic and typed API clients
messages/     English and Thai interface copy
```

For deeper implementation details, start with [the product specification](docs/SPEC.md), [the learner lifecycle](docs/LEARNER-LIFECYCLE.md), and [the test coverage map](docs/TEST-COVERAGE.md).

## Contributing

Thoughtful issues and pull requests are welcome. Before opening a PR:

1. Keep changes focused and consistent with the existing product language.
2. Run `pnpm lint` and `pnpm exec tsc --noEmit`.
3. Add or update a focused test when behavior changes.
4. Run the relevant end-to-end suite for the flow you touched.

If you are proposing a larger change, open an issue first so the direction can be discussed before implementation.

## Deployment

The web app and API deploy independently to Cloudflare Workers. The web app uses OpenNext and forwards `/api/*` requests to the API Worker through a service binding. See the workflow in [`.github/workflows/deploy-cloudflare.yml`](.github/workflows/deploy-cloudflare.yml) and the deployment contract in [docs/SPEC.md](docs/SPEC.md) for required variables and secrets.

---

<p align="center">
  Built to make Thai vocabulary practice feel small, clear, and worth returning to.
</p>
