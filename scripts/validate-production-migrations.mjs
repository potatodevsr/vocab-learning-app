// Production D1 migrations run automatically on every main deployment. Keep that path
// additive: content edits belong to the admin API, and destructive/data-rewriting SQL
// requires a separately reviewed recovery plan.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : resolve(process.argv[index + 1]);
};

const migrationsDir = option(
  "--migrations-dir",
  join(ROOT, "backend", "migrations"),
);
const manifestPath = option(
  "--manifest",
  join(ROOT, "scripts", "production-migrations.json"),
);

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const locked = manifest.lockedMigrations;
const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const digest = (contents) =>
  createHash("sha256").update(contents).digest("hex");

const failures = [];

for (const [file, expected] of Object.entries(locked)) {
  if (!files.includes(file)) {
    failures.push(`${file}: applied production migration was removed`);
    continue;
  }

  const actual = digest(readFileSync(join(migrationsDir, file)));
  if (actual !== expected) {
    failures.push(`${file}: applied production migration was modified`);
  }
}

const lockedNumbers = Object.keys(locked).map((file) => Number(file.slice(0, 4)));
const lastLockedNumber = Math.max(...lockedNumbers);

const unsafePatterns = [
  ["DROP statement", /\bDROP\b/i],
  ["DELETE statement", /\bDELETE\s+FROM\b/i],
  ["TRUNCATE statement", /\bTRUNCATE\b/i],
  ["UPDATE statement", /\bUPDATE\s+[\w"'`\[]/i],
  ["REPLACE statement", /\b(?:REPLACE\s+INTO|INSERT\s+OR\s+REPLACE)\b/i],
  ["upsert that rewrites rows", /\bON\s+CONFLICT\b[\s\S]*?\bDO\s+UPDATE\b/i],
  ["table rename", /\bALTER\s+TABLE\b[^;]*\bRENAME\b/i],
  ["PRAGMA statement", /\bPRAGMA\b/i],
];

// Remove comments and string values without letting `--` inside a quoted value hide the
// SQL that follows it. Keeping whitespace/newlines makes diagnostics and token boundaries
// predictable while preventing content text such as "drop in price" from being flagged.
const executableSql = (sql) => {
  let output = "";
  let state = "sql";

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (state === "sql" && char === "-" && next === "-") {
      state = "line-comment";
      output += "  ";
      index += 1;
    } else if (state === "sql" && char === "/" && next === "*") {
      state = "block-comment";
      output += "  ";
      index += 1;
    } else if (state === "sql" && char === "'") {
      state = "string";
      output += " ";
    } else if (state === "line-comment") {
      if (char === "\n") {
        state = "sql";
        output += "\n";
      } else {
        output += " ";
      }
    } else if (state === "block-comment") {
      if (char === "*" && next === "/") {
        state = "sql";
        output += "  ";
        index += 1;
      } else {
        output += char === "\n" ? "\n" : " ";
      }
    } else if (state === "string") {
      if (char === "'" && next === "'") {
        output += "  ";
        index += 1;
      } else if (char === "'") {
        state = "sql";
        output += " ";
      } else {
        output += char === "\n" ? "\n" : " ";
      }
    } else {
      output += char;
    }
  }

  return output;
};

for (const file of files) {
  if (Object.hasOwn(locked, file)) continue;

  const match = file.match(/^(\d{4})_[a-z0-9_]+\.sql$/);
  if (!match) {
    failures.push(`${file}: migration name must match NNNN_description.sql`);
    continue;
  }

  if (Number(match[1]) <= lastLockedNumber) {
    failures.push(
      `${file}: new migration number must be greater than ${String(lastLockedNumber).padStart(4, "0")}`,
    );
  }

  const sql = executableSql(readFileSync(join(migrationsDir, file), "utf8"));
  for (const [label, pattern] of unsafePatterns) {
    if (pattern.test(sql)) failures.push(`${file}: contains ${label}`);
  }
}

if (failures.length > 0) {
  console.error("\nProduction migration safety check failed:\n");
  for (const failure of failures) console.error(`  ✘ ${failure}`);
  console.error(
    "\nAutomatic production migrations must be additive. Use a separately approved " +
      "migration and recovery plan for destructive or data-rewriting SQL.\n",
  );
  process.exit(1);
}

console.log(
  `✓ ${Object.keys(locked).length} applied migrations are immutable; ` +
    `${files.length - Object.keys(locked).length} new migration(s) are additive`,
);
