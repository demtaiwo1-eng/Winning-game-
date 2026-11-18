import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  ["../../scripts/with-database.mjs", "vitest", "run"],
  {
    cwd: new URL("../apps/api/", import.meta.url),
    env: { ...process.env, DATABASE_MODE: "local", RUN_DB_TESTS: "1" },
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

child.once("error", (error) => {
  console.error("[test:db] Could not start database-backed tests:", error.message);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
