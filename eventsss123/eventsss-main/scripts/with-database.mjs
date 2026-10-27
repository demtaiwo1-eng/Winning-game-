import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(repoRoot, "apps", "api");
const apiEnvPath = path.join(apiRoot, ".env");
dotenv.config({ path: apiEnvPath });

const mode = (process.env.DATABASE_MODE ?? "auto").toLowerCase();
const localUrl = process.env.DATABASE_URL_LOCAL ?? "postgresql://ess:ess@127.0.0.1:5432/ess?schema=public";
const onlineUrl = (
  process.env.DATABASE_URL_ONLINE ??
  (process.env.NODE_ENV === "production" ? process.env.DATABASE_URL : undefined)
)?.trim();

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

const localAvailable = mode !== "online" && await reachable(localUrl);
const selectedUrl = mode === "local" || localAvailable ? localUrl : onlineUrl;

if (!selectedUrl) {
  console.error("No usable database is configured.");
  console.error("Start local PostgreSQL or set DATABASE_URL_ONLINE in apps/api/.env.");
  process.exit(1);
}

if (mode === "local" && !localAvailable) {
  console.error(`Local PostgreSQL is not reachable at ${endpoint(localUrl)?.host ?? "127.0.0.1"}:${endpoint(localUrl)?.port ?? 5432}.`);
  process.exit(1);
}

console.log(`[database] Using ${selectedUrl === localUrl ? "local" : "online"} PostgreSQL`);
const child = spawn(process.argv[2], process.argv.slice(3), {
  cwd: apiRoot,
  env: { ...process.env, DATABASE_URL: selectedUrl },
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
