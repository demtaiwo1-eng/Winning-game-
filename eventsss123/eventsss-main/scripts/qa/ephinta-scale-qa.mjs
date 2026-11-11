#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const planOnly = args.has("--plan-only");
const personaCounts = { CLIENT: 100, VENDOR: 100, VERIFIER: 100 };
const scenarios = Array.from({ length: 100 }, (_, index) => ({
  client: { id: `CLIENT-${String(index + 1).padStart(3, "0")}`, eventType: ["PERSONAL", "CORPORATE", "SOCIAL", "SPORTS", "CULTURAL", "RELIGIOUS", "ENTERTAINMENT", "EDUCATIONAL", "VIRTUAL"][index % 9], guests: 30 + ((index * 17) % 970), city: ["Lagos", "Abuja", "Ibadan", "Port Harcourt", "Kano"][index % 5] },
  vendor: { id: `VENDOR-${String(index + 1).padStart(3, "0")}`, category: ["Venue", "Catering", "Photography", "Decor", "Production", "Transport", "Security", "Rentals"][index % 8] },
  verifier: { id: `VERIFIER-${String(index + 1).padStart(3, "0")}`, readinessScenario: ["PENDING", "GREEN", "AMBER", "RED"][index % 4] },
}));

if (planOnly) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), personas: personaCounts, uniqueUsers: 300, uniqueClientEventScenarios: scenarios.length, sample: scenarios.slice(0, 5) }, null, 2));
  process.exit(0);
}

if (process.env.QA_SCALE_CONFIRM !== "YES") {
  console.error("Refusing to run. Set QA_SCALE_CONFIRM=YES after confirming this is a disposable QA database.");
  process.exit(2);
}
if (process.env.NODE_ENV === "production" || process.env.DATABASE_MODE === "online") {
  console.error("Refusing to run against production/online database. Use an isolated local or dedicated QA database.");
  process.exit(2);
}
const configuredUrl = process.env.DATABASE_URL || "";
if (configuredUrl && /(render\.com|neon\.tech|supabase\.(co|com))/i.test(configuredUrl)) {
  console.error("Refusing to use a managed/production-style DATABASE_URL. Configure DATABASE_MODE=local and DATABASE_URL_LOCAL for a disposable QA database.");
  process.exit(2);
}

const report = { startedAt: new Date().toISOString(), personas: personaCounts, uniqueUsers: 300, phases: [], status: "running" };
const phases = [
  { name: "300-persona database journeys", command: "npm", args: ["run", "test:db", "-w", "apps/api", "--", "tests/scale-journeys.db.test.ts"], env: { RUN_SCALE_DB_TESTS: "1", NODE_ENV: "test", DATABASE_MODE: "local" } },
  { name: "API and web unit checks", command: "npm", args: ["run", "check"], env: { NODE_ENV: "test", DATABASE_MODE: "local" } },
  { name: "responsive web production build", command: "npm", args: ["run", "build:web"], env: { NODE_ENV: "test" } },
  { name: "strict design quality gate", command: "npm", args: ["run", "design:audit:strict", "-w", "apps/web"], env: { NODE_ENV: "test" } },
  { name: "browser end-to-end regression", command: "npm", args: ["run", "test:e2e", "-w", "apps/web"], env: { CI: "1", NODE_ENV: "test", DATABASE_MODE: "local" } },
];

function execute(phase) {
  return new Promise((resolve) => {
    console.log(`\n[EPHINTA QA] ${phase.name}\n> ${phase.command} ${phase.args.join(" ")}`);
    const child = spawn(phase.command, phase.args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...phase.env },
    });
    child.once("error", (error) => resolve({ name: phase.name, status: "failed", error: error.message }));
    child.once("exit", (code) => resolve({ name: phase.name, status: code === 0 ? "passed" : "failed", exitCode: code ?? 1 }));
  });
}

for (const phase of phases) {
  const result = await execute(phase);
  report.phases.push(result);
  if (result.status !== "passed") {
    report.status = "failed";
    break;
  }
}
if (report.status === "running") report.status = "passed";
report.finishedAt = new Date().toISOString();
const reportDir = path.join(root, "artifacts");
await mkdir(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "ephinta-scale-qa-report.json");
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`\n[EPHINTA QA] ${report.status.toUpperCase()} — report: ${reportPath}`);
if (report.status !== "passed") process.exit(1);
