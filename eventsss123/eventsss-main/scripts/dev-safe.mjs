import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import net from "node:net";

async function findFreePort(startPort, maxAttempts = 25) {
  for (let port = startPort; port < startPort + maxAttempts; port += 1) {
    const isFree = await new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
    });
    if (isFree) return port;
  }
  throw new Error(`No free port found starting at ${startPort}`);
}

const services = [
  {
    name: "API",
    url: "http://127.0.0.1:5000/ready",
    command: "npm",
    args: ["run", "dev", "-w", "apps/api"],
    log: "/tmp/ephinta-api-dev.log",
  },
  {
    name: "WEB",
    url: "http://127.0.0.1:5173/",
    command: "npm",
    args: ["run", "dev", "-w", "apps/web"],
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

async function portOccupied(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(700),
    });
    return response.status > 0;
  } catch (error) {
    // A TCP listener that is not HTTP will generally return a fetch connection
    // error too, so use the OS socket probe below when available.
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
    env: process.env,
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

  const port = service.name === "API" ? 5000 : await findFreePort(5173);
  if (service.name === "WEB") {
    service.url = `http://127.0.0.1:${port}/`;
    service.args = ["run", "dev", "-w", "apps/web", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "false"];
  }

  const listening = await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(false)));
  });

  if (listening) {
    console.error(`[${service.name}] Port ${port} is occupied but ${service.url} is not healthy.`);
    console.error("Not terminating an unknown process. Inspect with: lsof -i :" + port);
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

const webUrl = services.find((service) => service.name === "WEB")?.url ?? "http://localhost:5173/";
console.log("EPHINTA development services are running. Press Ctrl+C to stop only services started by this launcher.");
console.log(`Open the application: ${webUrl}`);
console.log("API health: http://localhost:5000/health");
console.log("Database readiness: http://localhost:5000/ready");
await new Promise((resolve) => {
  for (const child of children) child.once("exit", resolve);
});
