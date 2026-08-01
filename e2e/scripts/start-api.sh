#!/usr/bin/env bash
# Boot the API Worker for e2e against a freshly seeded, ISOLATED local D1.
#
# Two isolations matter here:
#   * --persist-to .wrangler/e2e-state  — its own database files, so wiping and reseeding
#     never touches the D1 you develop against (.wrangler/state).
#   * port 4100 — leaves 4000 free for `pnpm dev`.
#
# Ordering is why this is a script rather than a Playwright globalSetup: the database must
# be reset, migrated and seeded *before* the Worker starts serving, and Playwright does not
# guarantee globalSetup runs before webServer.
set -euo pipefail

cd "$(dirname "$0")/../../backend"

STATE_DIR=".wrangler/e2e-state"
PERSIST=(--persist-to "$STATE_DIR")

echo "[e2e] generating Prisma client runtime"
DATABASE_URL="${DATABASE_URL:-file:./dev.db}" \
  pnpm exec prisma generate --generator client >/dev/null

echo "[e2e] resetting isolated D1 state at $STATE_DIR"
rm -rf "$STATE_DIR"

echo "[e2e] applying migrations"
pnpm exec wrangler d1 migrations apply vocab --local "${PERSIST[@]}" >/dev/null

echo "[e2e] seeding deterministic fixtures"
pnpm exec wrangler d1 execute vocab --local "${PERSIST[@]}" --file=seed/e2e.sql >/dev/null

echo "[e2e] starting worker on :4100"
exec pnpm exec wrangler dev --local "${PERSIST[@]}" \
  --port 4100 \
  --var FRONTEND_URL:http://localhost:3100
