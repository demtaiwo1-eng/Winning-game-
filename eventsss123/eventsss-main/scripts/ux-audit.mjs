#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, [
  "playwright", "test", "e2e/responsive-ux-audit.spec.ts",
  "--project=chromium", "--workers=1"
], {
  cwd: new URL("../apps/web", import.meta.url),
  stdio: "inherit",
  env: { ...process.env, CI: process.env.CI || "1" }
});

if (result.error) {
  console.error("Unable to start Playwright:", result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
