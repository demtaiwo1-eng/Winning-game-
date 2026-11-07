import { spawn } from "node:child_process";

const root = process.cwd();
const command = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(command, ["run", "dev"], {
  cwd: root,
  env: { ...process.env, DATABASE_MODE: "auto", NODE_ENV: "development" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
  shell: process.platform === "win32",
});

const output = [];
const collect = (chunk) => {
  const value = chunk.toString();
  output.push(value);
  if (output.join("").length > 30_000) output.splice(0, output.length - 10);
};
child.stdout.on("data", collect);
child.stderr.on("data", collect);

const endpoints = [
  { name: "web", url: "http://127.0.0.1:5173/", check: async (response) => response.ok },
  { name: "API health", url: "http://127.0.0.1:5000/health", check: async (response) => response.ok && (await response.json()).status === "ok" },
  { name: "database readiness", url: "http://127.0.0.1:5000/ready", check: async (response) => response.ok && (await response.json()).status === "ready" },
];

async function stop() {
  if (child.exitCode !== null) return;
  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGINT");
    else child.kill("SIGINT");
  } catch { /* the child may have exited between the check and signal */ }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ]);
  if (process.platform !== "win32") {
    try { if (child.pid) process.kill(-child.pid, "SIGKILL"); } catch { /* already stopped */ }
  }
}

try {
  const deadline = Date.now() + 120_000;
  const ready = new Set();
  while (Date.now() < deadline && ready.size !== endpoints.length && child.exitCode === null) {
    for (const endpoint of endpoints) {
      if (ready.has(endpoint.name)) continue;
      try {
        const response = await fetch(endpoint.url, { signal: AbortSignal.timeout(2500) });
        if (await endpoint.check(response)) {
          ready.add(endpoint.name);
          console.log(`PASS: ${endpoint.name} is responding at ${endpoint.url}`);
        }
      } catch { /* retry while the stack starts */ }
    }
    if (ready.size !== endpoints.length) await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (ready.size !== endpoints.length) {
    throw new Error(`Full-stack startup timed out. Ready: ${[...ready].join(", ") || "none"}.`);
  }
  console.log("PASS: npm run dev started the frontend, API, and connected PostgreSQL database.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(output.join(""));
  process.exitCode = 1;
} finally {
  // Stop only the API/Vite process tree started by this smoke test.
  // Keep PostgreSQL available if it was already running or was started for development.
  await stop();
}
