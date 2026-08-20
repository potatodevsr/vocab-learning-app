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
worker_pid=""

stop_worker() {
  if [[ -n "$worker_pid" ]] && kill -0 "$worker_pid" 2>/dev/null; then
    kill "$worker_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
  fi
  exit 0
}

trap stop_worker INT TERM

while true; do
  pnpm exec wrangler dev --local "${PERSIST[@]}" \
    --port 4100 \
    --var FRONTEND_URL:http://localhost:3100 \
    --var APP_URL:http://localhost:3100 \
    --var E2E_MODE:true \
    --var MAGIC_LINK_DEV_MODE:true \
    --var GOOGLE_AUTH_DEV_MODE:true &
  worker_pid="$!"

  set +e
  wait "$worker_pid"
  status="$?"
  set -e
  worker_pid=""

  if [[ "$status" -eq 0 ]]; then
    exit 0
  fi

  echo "[e2e] worker exited with status $status; restarting against existing isolated state"
done
