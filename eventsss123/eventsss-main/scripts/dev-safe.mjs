import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import net from "node:net";

const API_PORT = 5000;
const WEB_PORT = 5173;

const services = [
  {
    name: "API",
    port: API_PORT,
    url: `http://127.0.0.1:${API_PORT}/ready`,
    command: "npm",
    args: ["run", "dev", "-w", "apps/api"],
    env: { PORT: String(API_PORT) },
    log: "/tmp/ephinta-api-dev.log",
  },
  {
    name: "WEB",
    port: WEB_PORT,
    url: `http://127.0.0.1:${WEB_PORT}/`,
    command: "npm",
    args: ["run", "dev", "-w", "apps/web"],
    env: {},
    log: "/tmp/ephinta-web-dev.log",
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

async function waitHealthy(service, child, seconds = 35) {
  for (let i = 0; i < seconds; i++) {
    if (await healthy(service.url)) return true;
    if (child.exitCode !== null) return false;
    await delay(1000);
  }
  return false;
}

function start(service) {
  console.log(`[${service.name}] Starting service; logs: ${service.log}`);
  const fs = awaitlessFs();
  const stream = fs.createWriteStream(service.log, { flags: "a" });
  const child = spawn(service.command, service.args, {
    cwd: process.cwd(),
    env: { ...process.env, ...service.env },
    stdio: ["ignore", "pipe", "pipe"],
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

// Import fs synchronously via Node's built-in module.
function awaitlessFs() {
  return requireFs;
}
import * as requireFs from "node:fs";

for (const service of services) {
  if (await healthy(service.url)) {
    console.log(`[${service.name}] Already healthy; reusing existing service.`);
    continue;
  }

  const listening = await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.listen(service.port, "127.0.0.1", () => server.close(() => resolve(false)));
  });

  if (listening) {
    console.error(`[${service.name}] Port ${service.port} is occupied but ${service.url} is not healthy.`);
    console.error("Not terminating an unknown process. Inspect with: lsof -i :" + service.port);
    stopChildren();
    process.exit(1);
  }

  if (service.name === "WEB") {
    service.args = [
      "run", "dev", "-w", "apps/web", "--",
      "--host", "0.0.0.0", "--port", String(WEB_PORT), "--strictPort",
    ];
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

const webUrl = services.find((service) => service.name === "WEB")?.url ?? "http://localhost:5173/";
console.log("EPHINTA development services are running. Press Ctrl+C to stop only services started by this launcher.");
console.log(`Open the application: ${webUrl}`);
console.log("API health: http://localhost:5000/health");
console.log("Database readiness: http://localhost:5000/ready");
await new Promise((resolve) => {
  for (const child of children) child.once("exit", resolve);
});
