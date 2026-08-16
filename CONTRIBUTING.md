# Contributing

Thanks for helping improve Vocab Learning. Focused bug reports, accessibility fixes,
content corrections, and well-scoped product improvements are welcome.

## Before you start

- Check existing issues before opening a duplicate.
- Open an issue before starting a large feature or architectural change.
- Never include production credentials, learner data, or licensed source material.
- Keep English and Thai interface copy in sync.

## Local workflow

1. Install the web and API dependencies with `pnpm install` and
   `pnpm --dir backend install`.
2. Follow the local database and development instructions in [README.md](README.md).
3. Make one focused change with a clear reason.
4. Add or update the test that proves changed behavior.
5. Run the relevant checks before opening a pull request.

```bash
pnpm test:coverage-audit
pnpm lint
pnpm exec tsc --noEmit
pnpm test:e2e
```

## Pull requests

Describe the user-visible outcome, testing performed, and any deployment or data impact.
Include screenshots for interface changes. Avoid unrelated cleanup in the same pull
request so the behavior remains easy to review.
