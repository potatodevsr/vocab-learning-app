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

# Refuse a second run before anything destructive happens.
#
# The next steps wipe `$STATE_DIR` and re-apply migrations. Doing that while another run
# is using the same directory deletes its database mid-flight, and what surfaces is not a
# clear conflict but a spray of unrelated failures: `wrangler d1 migrations apply` killed
# with `Terminated: 15`, `worker exited with status 143`, and `internal error; reference =
# ...` from a Worker whose files vanished underneath it.
#
# The lock is a directory because `mkdir` is atomic — two launchers racing cannot both
# win it, which a `test -e` followed by a `touch` cannot promise. It is taken before
# anything else runs.
#
# A port probe is not enough on its own and was the first attempt at this: nothing listens
# on 4100 until `wrangler dev` starts, which is a minute of `prisma generate`, migrations
# and seeding later. For that whole minute the state directory is in use and the port is
# free, so a second launcher sails past the probe and deletes it. The port check stays
# below as a second line for the case the lock cannot see — a worker left listening by a
# run whose shell died without running its trap.
LOCK_DIR=".wrangler/e2e-state.lock"

mkdir -p "$(dirname "$LOCK_DIR")"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  owner="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"

  # An empty pid file is not an abandoned lock. It is one taken microseconds ago whose
  # owner has not stamped it yet — the gap between the `mkdir` above and the `echo` below.
  # Without this pause two launchers racing both read nothing, both conclude "stale", and
  # both wipe the state: the exact failure the lock exists to prevent, just with a
  # millisecond-wide window instead of a minute-wide one. A live owner stamps immediately,
  # so anything still empty a second later really is debris.
  if [[ -z "$owner" ]]; then
    sleep 1
    owner="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  fi

  if [[ -n "$owner" ]] && kill -0 "$owner" 2>/dev/null; then
    echo "[e2e] another run (pid $owner) owns $STATE_DIR. The Playwright harness is" >&2
    echo "[e2e] single-tenant: the next step wipes that directory, so this refuses rather" >&2
    echo "[e2e] than delete the database a run in progress is using." >&2
    exit 1
  fi

  # The owner is gone, so the lock is debris from a killed run rather than a live claim.
  echo "[e2e] clearing a stale lock left by pid ${owner:-unknown}"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
fi

echo "$$" > "$LOCK_DIR/pid"

release_lock() {
  rm -rf "$LOCK_DIR"
}

trap release_lock EXIT

if (exec 3<>/dev/tcp/127.0.0.1/4100) 2>/dev/null; then
  exec 3<&- 3>&-
  echo "[e2e] port 4100 is already in use. The Playwright harness never reuses servers," >&2
  echo "[e2e] and the next step wipes $STATE_DIR — refusing rather than destroying the" >&2
  echo "[e2e] database a run already in progress is using." >&2
  exit 1
fi

echo "[e2e] generating Prisma client runtime"
DATABASE_URL="${DATABASE_URL:-file:./dev.db}" \
  pnpm exec prisma generate --generator client >/dev/null

echo "[e2e] resetting isolated D1 state at $STATE_DIR"
rm -rf "$STATE_DIR"

echo "[e2e] applying migrations"
pnpm exec wrangler d1 migrations apply vocab --local "${PERSIST[@]}" >/dev/null

echo "[e2e] seeding deterministic fixtures"
pnpm exec wrangler d1 execute vocab --local "${PERSIST[@]}" --file=seed/e2e.sql >/dev/null

# Pre-generated audio, minus the model call. The suite has to exercise the real serving
# path — R2 object -> GET /audio/* -> <audio> element — and Workers AI is a remote,
# billed, non-deterministic dependency that has no place in a test gate. `seed/audio/
# fixture.mp3` is a valid silent clip; `seed/e2e.sql` points word1's `audioKeyEn` at it.
echo "[e2e] seeding audio fixtures into local R2"
for id in e2e-a1-0001 e2e-a1-0005; do
  pnpm exec wrangler r2 object put "vocab-audio/audio/en/$id.mp3" \
    --file=seed/audio/fixture.mp3 --content-type=audio/mpeg \
    --local "${PERSIST[@]}" >/dev/null
done

echo "[e2e] starting worker on :4100"
worker_pid=""

stop_worker() {
  if [[ -n "$worker_pid" ]] && kill -0 "$worker_pid" 2>/dev/null; then
    kill "$worker_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
  fi
  release_lock
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
