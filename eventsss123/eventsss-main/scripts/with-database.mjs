import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(repoRoot, "apps", "api");
dotenv.config({ path: path.join(apiRoot, ".env") });

const mode = (process.env.DATABASE_MODE ?? "auto").toLowerCase();
const localUrl = process.env.DATABASE_URL_LOCAL ?? "postgresql://ess:ess@127.0.0.1:5432/ess?schema=public";
const configuredDatabaseUrl = (process.env.DATABASE_URL ?? "").trim();
const configuredDatabaseHost = (() => {
  try { return new URL(configuredDatabaseUrl).hostname.toLowerCase(); }
  catch { return ""; }
})();
const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(configuredDatabaseHost);
const onlineUrl = process.env.DATABASE_URL_ONLINE?.trim()
  || (configuredDatabaseUrl && !isLoopback ? configuredDatabaseUrl : undefined);

function endpoint(connectionString) {
  try {
    const url = new URL(connectionString);
    return { host: url.hostname, port: Number(url.port || 5432) };
  } catch {
    return undefined;
  }
}

function reachable(connectionString, timeoutMs = 1200) {
  const target = endpoint(connectionString);
  if (!target) return Promise.resolve(false);
  return new Promise((resolve) => {
    const socket = net.createConnection(target.port, target.host);
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function startLocalPostgres() {
  console.log("[database] Local PostgreSQL is not reachable; attempting Docker Compose startup.");
  const composeFile = path.join(repoRoot, "compose.dev.yml");
  const started = await run("docker", ["compose", "-f", composeFile, "up", "-d", "postgres"]);
  if (!started) return false;

  const readyArgs = ["compose", "-f", composeFile, "exec", "-T", "postgres", "pg_isready", "-U", "ess", "-d", "ess"];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    // A TCP socket can open before PostgreSQL has finished initializing.
    // Wait for PostgreSQL itself to report readiness before Prisma connects.
    if (await run("docker", readyArgs, { stdio: "ignore" })) {
      for (let hostAttempt = 0; hostAttempt < 10; hostAttempt += 1) {
        if (await reachable(localUrl, 1000)) return true;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

let selectedUrl;
const useOnline = mode === "online" || (mode === "auto" && process.env.NODE_ENV === "production");
if (useOnline) {
  selectedUrl = onlineUrl;
} else if (await reachable(localUrl)) {
  selectedUrl = localUrl;
} else if ((mode === "auto" || mode === "local") && await startLocalPostgres()) {
  selectedUrl = localUrl;
} else if (mode === "local" || mode === "auto") {
  console.error(`[database] Local PostgreSQL is not reachable at ${endpoint(localUrl)?.host ?? "127.0.0.1"}:${endpoint(localUrl)?.port ?? 5432}.`);
  console.error("Start Docker Desktop / Docker Engine, or explicitly set DATABASE_MODE=online with DATABASE_URL_ONLINE.");
  process.exit(1);
}

if (!selectedUrl) {
  console.error("[database] No usable PostgreSQL database is configured.");
  console.error("Default: Docker Compose starts a local PostgreSQL 16 database on 127.0.0.1:5432.");
  console.error("Alternative: set DATABASE_MODE=online and DATABASE_URL_ONLINE in apps/api/.env.");
  process.exit(1);
}

if (useOnline && !(await reachable(selectedUrl))) {
  console.error("[database] The configured online PostgreSQL endpoint is not reachable.");
  process.exit(1);
}

console.log(`[database] Using ${selectedUrl === localUrl ? "local PostgreSQL" : "configured PostgreSQL"}`);
const child = spawn(process.argv[2], process.argv.slice(3), {
  cwd: apiRoot,
  env: { ...process.env, DATABASE_URL: selectedUrl },
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.once("error", (error) => {
  console.error("[database] Could not start database command:", error.message);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
