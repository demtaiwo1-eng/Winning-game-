import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import net from "node:net";
import dotenv from "dotenv";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiRoot = join(repoRoot, "apps", "api");
dotenv.config({ path: join(apiRoot, ".env") });

const API_PORT = Number(process.env.PORT || 5000);
const WEB_PORT = Number(process.env.WEB_PORT || 5173);
process.env.PORT = String(API_PORT);
process.env.JWT_SECRET ||= randomBytes(48).toString("hex");
process.env.DATABASE_MODE ||= "auto";
process.env.DATABASE_URL ||= process.env.DATABASE_URL_LOCAL || "postgresql://ess:ess@127.0.0.1:5432/ess?schema=public";

const services = [
  {
    name: "API",
    port: API_PORT,
    url: `http://127.0.0.1:${API_PORT}/ready`,
    command: "npm",
    args: ["run", "dev", "-w", "apps/api"],
    env: { PORT: String(API_PORT) },
    log: join(tmpdir(), "ephinta-api-dev.log"),
  },
  {
    name: "WEB",
    port: WEB_PORT,
    url: `http://127.0.0.1:${WEB_PORT}/`,
    command: "npm",
    args: ["run", "dev", "-w", "apps/web", "--", "--host", "0.0.0.0", "--port", String(WEB_PORT), "--strictPort"],
    env: {},
    log: join(tmpdir(), "ephinta-web-dev.log"),
  },
];

async function healthy(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function portOccupied(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(false)));
  });
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.once("error", (error) => {
      console.error(`[setup] Could not run ${command}: ${error.message}`);
      resolve(false);
    });
    child.once("exit", (code) => resolve(code === 0));
  });
}

const children = [];
let stopping = false;
function stopChildren() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child && child.exitCode === null) child.kill("SIGTERM");
  }
}
process.on("SIGINT", () => { stopChildren(); process.exitCode = 130; });
process.on("SIGTERM", () => { stopChildren(); process.exitCode = 143; });
process.on("exit", stopChildren);

async function waitHealthy(service, child, seconds = 60) {
  for (let i = 0; i < seconds; i++) {
    if (await healthy(service.url)) return true;
    if (child.exitCode !== null) return false;
    await delay(1000);
  }
  return false;
}

function start(service) {
  console.log(`[${service.name}] Starting; log: ${service.log}`);
  const stream = createWriteStream(service.log, { flags: "a" });
  const child = spawn(service.command, service.args, {
    cwd: repoRoot,
    env: { ...process.env, ...service.env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  child.stdout.pipe(stream);
  child.stderr.pipe(stream);
  child.on("exit", (code, signal) => {
    stream.end();
    if (!stopping) {
      console.error(`[${service.name}] exited (code=${code}, signal=${signal}). See ${service.log}`);
      stopChildren();
      process.exitCode = code ?? 1;
    }
  });
  children.push(child);
  return child;
}

const apiService = services[0];
if (!(await healthy(apiService.url))) {
  console.log("[setup] Generating Prisma Client...");
  const generated = await runCommand("npm", ["run", "prisma:generate"]);
  if (!generated) {
    console.error("[setup] Prisma Client generation failed. Run npm ci and inspect the output above.");
    process.exit(1);
  }
  console.log("[setup] Preparing PostgreSQL and applying pending Prisma migrations...");
  const migrated = await runCommand("npm", ["run", "db:deploy", "-w", "apps/api"]);
  if (!migrated) {
    console.error("[setup] Database setup failed. Install/start Docker Desktop, or configure DATABASE_MODE=online and DATABASE_URL_ONLINE in apps/api/.env.");
    process.exit(1);
  }
  const seeded = await runCommand("npm", ["run", "db:seed", "-w", "apps/api"]);
  if (!seeded) {
    console.error("[setup] Database migrations succeeded, but reference-data seeding failed.");
    process.exit(1);
  }
}

for (const service of services) {
  if (await healthy(service.url)) {
    console.log(`[${service.name}] Already healthy; reusing it.`);
    continue;
  }

  if (await portOccupied(service.port)) {
    console.error(`[${service.name}] Port ${service.port} is occupied but ${service.url} is not healthy.`);
    console.error("Not terminating an unknown process. Check the process using that port, then retry.");
    stopChildren();
    process.exit(1);
  }

  const child = start(service);
  if (!(await waitHealthy(service, child))) {
    console.error(`[${service.name}] Did not become healthy. Inspect ${service.log}`);
    stopChildren();
    process.exit(1);
  }
  console.log(`[${service.name}] Healthy at ${service.url}`);
}

if (children.length === 0) {
  console.log("All EPHINTA services were already healthy. Nothing new was started.");
  process.exit(0);
}

console.log("EPHINTA development services are running. Press Ctrl+C to stop services started by this launcher.");
console.log(`Frontend: http://localhost:${WEB_PORT}`);
console.log(`API health: http://localhost:${API_PORT}/health`);
console.log(`Database readiness: http://localhost:${API_PORT}/ready`);
await new Promise((resolve) => {
  for (const child of children) child.once("exit", resolve);
});
