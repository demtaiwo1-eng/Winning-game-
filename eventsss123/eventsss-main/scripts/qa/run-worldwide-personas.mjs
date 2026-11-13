#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../..");
const headed = process.argv.includes("--headed");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_MODE: "local",
  DATABASE_URL_LOCAL:
    process.env.DATABASE_URL_LOCAL ??
    "postgresql://ess:ess@127.0.0.1:5432/ess?schema=public",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    process.env.DATABASE_URL_LOCAL ??
    "postgresql://ess:ess@127.0.0.1:5432/ess?schema=public",
  JWT_SECRET:
    process.env.JWT_SECRET ??
    "ephinta-worldwide-qa-only-secret-change-me-0123456789abcdef",
  PORT: process.env.PORT ?? "5000",
};

function run(command, args, label, cwd = projectRoot) {
  return new Promise((resolve, reject) => {
    console.log(`\n[worldwide-qa] ${label}\n$ ${command} ${args.join(" ")}\n`);
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (exit=${code ?? "null"}, signal=${signal ?? "none"})`));
    });
  });
}

try {
  await run(
    "docker",
    ["compose", "-f", "compose.dev.yml", "up", "-d", "postgres"],
    "Start the local disposable PostgreSQL service",
  );
  await run(npm, ["run", "prisma:generate"], "Generate the Prisma client");
  await run(npm, ["run", "db:deploy", "-w", "apps/api"], "Apply local database migrations");

  const testArgs = ["run", "test:worldwide", "-w", "apps/web", "--", "--workers=1"];
  if (headed) testArgs.push("--headed");
  await run(
    npm,
    testArgs,
    headed ? "Run 100 country personas in a visible browser" : "Run 100 country personas headlessly",
  );

  console.log("\n[worldwide-qa] Finished. The suite stops at the local event brief and does not create accounts, book vendors, send notifications, or initiate payments.");
  console.log("[worldwide-qa] PostgreSQL remains running so you can inspect or reuse the local test database.");
} catch (error) {
  console.error(`\n[worldwide-qa] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
