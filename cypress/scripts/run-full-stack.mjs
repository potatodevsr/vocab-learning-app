#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, rmSync } from "node:fs";
import net from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BACKEND = resolve(ROOT, "backend");
const ARTIFACTS = resolve(ROOT, "cypress/artifacts");
const LOGS = resolve(ARTIFACTS, "logs");
const STATE = resolve(BACKEND, ".wrangler/cypress-state");
const WEB_PORT = 3200;
const API_PORT = 4200;
const JWT_SECRET =
  "49022f773409abad1e30a7057912cbe866a42791804a6dd2b0f763055da2b106";
const open = process.argv.includes("--open");
const specIndex = process.argv.indexOf("--spec");
const spec = specIndex >= 0 ? process.argv[specIndex + 1] : undefined;
if (specIndex >= 0 && !spec) throw new Error("--spec requires a Cypress spec path");
const children = [];

rmSync(ARTIFACTS, { recursive: true, force: true });
mkdirSync(LOGS, { recursive: true });

const lifecycleLog = createWriteStream(resolve(LOGS, "lifecycle.log"), {
  flags: "w",
});

const note = (message) => {
  const line = `[cypress-harness] ${message}`;
  process.stdout.write(`${line}\n`);
  lifecycleLog.write(`${line}\n`);
};

const assertPortAvailable = (port) =>
  new Promise((resolvePort, reject) => {
    const probe = net.createServer();

    probe.unref();
    probe.once("error", (error) => {
      reject(
        new Error(
          `Port ${port} is already in use. The Cypress harness never reuses servers. (${error.message})`,
        ),
      );
    });
    probe.listen({ host: "127.0.0.1", port }, () => {
      probe.close(() => resolvePort());
    });
  });

const start = (label, command, args, options = {}) => {
  const log = createWriteStream(resolve(LOGS, `${label}.log`), { flags: "w" });
  const env = { ...process.env, ...options.env };
  for (const name of options.unsetEnv ?? []) delete env[name];
  const child = spawn(command, args, {
    cwd: options.cwd ?? ROOT,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const entry = { child, label, log, closed: false };
  children.push(entry);

  const relay = (target) => (chunk) => {
    log.write(chunk);
    target.write(chunk);
  };
  child.stdout.on("data", relay(process.stdout));
  child.stderr.on("data", relay(process.stderr));

  entry.done = new Promise((resolveDone) => {
    child.once("close", (code, signal) => {
      entry.closed = true;
      log.end();
      resolveDone({ code, signal });
    });
  });

  child.once("error", (error) => {
    log.write(`Failed to start ${command}: ${error.stack ?? error.message}\n`);
  });

  return entry;
};

const run = async (label, command, args, options = {}) => {
  note(`running ${label}`);
  const entry = start(label, command, args, options);
  const result = await entry.done;

  if (result.code !== 0) {
    throw new Error(
      `${label} failed with ${result.signal ?? `exit code ${result.code}`}; see cypress/artifacts/logs/${label}.log`,
    );
  }
};

const waitForHttp = async (label, url, entry, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = "not ready";

  while (Date.now() < deadline) {
    if (entry.closed) {
      const result = await entry.done;
      throw new Error(
        `${label} exited before becoming ready (${result.signal ?? result.code}); see cypress/artifacts/logs/${entry.label}.log`,
      );
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }

  throw new Error(`${label} was not ready after ${timeoutMs}ms (${lastError})`);
};

const stop = async () => {
  const running = children.filter(({ closed }) => !closed).reverse();

  for (const { child } of running) {
    try {
      if (process.platform === "win32") child.kill("SIGTERM");
      else process.kill(-child.pid, "SIGTERM");
    } catch {
      // It may have exited between the filter and signal.
    }
  }

  await Promise.race([
    Promise.all(running.map(({ done }) => done)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);

  for (const { child, closed } of running) {
    if (closed) continue;
    try {
      if (process.platform === "win32") child.kill("SIGKILL");
      else process.kill(-child.pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
};

let shuttingDown = false;
const handleSignal = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  note(`received ${signal}; stopping Cypress stack`);
  await stop();
  lifecycleLog.end();
  process.exit(signal === "SIGINT" ? 130 : 143);
};

process.on("SIGINT", () => void handleSignal("SIGINT"));
process.on("SIGTERM", () => void handleSignal("SIGTERM"));

const webEnv = {
  NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
  NEXT_PUBLIC_SITE_URL: `http://localhost:${WEB_PORT}`,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-CYPRESSTEST",
  JWT_SECRET,
  NEXT_TELEMETRY_DISABLED: "1",
};

let exitCode = 0;

try {
  await Promise.all([
    assertPortAvailable(WEB_PORT),
    assertPortAvailable(API_PORT),
  ]);

  await run("backend-install", "pnpm", ["install", "--frozen-lockfile"], {
    cwd: BACKEND,
  });

  await run(
    "prisma-client",
    "pnpm",
    ["exec", "prisma", "generate", "--generator", "client"],
    {
      cwd: BACKEND,
      env: {
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "file:./.wrangler/cypress-prisma-client-fallback.db",
      },
    },
  );

  note(`resetting isolated D1 state at ${STATE}`);
  rmSync(STATE, { recursive: true, force: true });

  const persistArgs = ["--persist-to", ".wrangler/cypress-state"];
  await run(
    "d1-migrate",
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "vocab",
      "--local",
      ...persistArgs,
    ],
    { cwd: BACKEND },
  );
  await run(
    "d1-seed",
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "vocab",
      "--local",
      ...persistArgs,
      "--file=seed/e2e.sql",
    ],
    { cwd: BACKEND },
  );

  note(`starting real Hono Worker on :${API_PORT}`);
  const api = start(
    "api",
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--local",
      ...persistArgs,
      "--port",
      String(API_PORT),
      "--var",
      `FRONTEND_URL:http://localhost:${WEB_PORT}`,
      "--var",
      `APP_URL:http://localhost:${WEB_PORT}`,
      "--var",
      "MAGIC_LINK_DEV_MODE:true",
    ],
    { cwd: BACKEND },
  );
  await waitForHttp(
    "API Worker",
    `http://localhost:${API_PORT}/health`,
    api,
    120_000,
  );

  await run("next-build", "pnpm", ["build"], { env: webEnv });

  note(`starting production Next server on :${WEB_PORT}`);
  const web = start(
    "web",
    "pnpm",
    ["start", "--port", String(WEB_PORT)],
    { env: webEnv },
  );
  await waitForHttp(
    "Next production server",
    `http://localhost:${WEB_PORT}/en`,
    web,
    120_000,
  );
  note("API and web are ready; starting Cypress");

  const cypress = start(
    "cypress",
    "pnpm",
    [
      "exec",
      "cypress",
      open ? "open" : "run",
      "--config-file",
      "cypress.config.ts",
      ...(spec ? ["--spec", spec] : []),
    ],
    // Codex and some Node launchers set this for their own Electron integration. Cypress
    // is itself an Electron app; inheriting it makes the binary run as plain Node and
    // reject Cypress' --smoke-test/--no-sandbox launch flags before any spec can start.
    { unsetEnv: ["ELECTRON_RUN_AS_NODE"] },
  );
  const result = await cypress.done;
  exitCode = result.code ?? 1;

  if (exitCode !== 0) {
    throw new Error(
      `Cypress failed with ${result.signal ?? `exit code ${exitCode}`}; see cypress/artifacts/logs/cypress.log`,
    );
  }

  note("Cypress completed successfully");
} catch (error) {
  exitCode ||= 1;
  note(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  await stop();
  note("API and web processes stopped");
  lifecycleLog.end();
}

process.exitCode = exitCode;
