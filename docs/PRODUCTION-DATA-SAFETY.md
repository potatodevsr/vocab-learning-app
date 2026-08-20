# Production data safety

Production content in D1 must survive ordinary application deployments. The automated
deployment path therefore has three layers of protection:

1. `pnpm check:production-migrations` verifies that every migration already applied to
   production still has its original SHA-256 checksum. New migrations must have a number
   above the locked history and cannot contain destructive or data-rewriting SQL such as
   `DROP`, `DELETE`, `TRUNCATE`, `UPDATE`, `REPLACE`, table renames, or `PRAGMA`.
2. The deploy workflow records a D1 Time Travel bookmark in the GitHub Actions run summary
   immediately before applying migrations.
3. Wrangler applies only pending migrations. Its migration command rolls back the current
   migration if it errors; earlier successful migrations remain applied.

The historical `0005_drop_meaning_th_spelling.sql` is the only destructive migration in
the active D1 history. It removed a never-populated derived column before production
content entry began. Its exact checksum is locked, so it cannot be changed or reapplied as
a new migration.

Development and e2e seeds contain intentional deletes, but their package commands always
use `--local`. The production workflow must never contain `d1 execute ... --remote`, a seed
command, `prisma migrate deploy`, or `prisma migrate reset`; the deployment contract test
enforces this.

If a destructive schema change ever becomes unavoidable, do not weaken the automatic
guard. Prepare an additive replacement schema, copy and verify the data, document the D1
Time Travel restore bookmark, and ask for explicit approval before any contraction step.
Restoring a bookmark is intentionally never automated.
