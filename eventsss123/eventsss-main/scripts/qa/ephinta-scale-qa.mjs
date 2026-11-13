#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const planOnly = args.has("--plan-only");
const portalRoles = ["CLIENT", "ORGANIZATION", "VENDOR", "AFFILIATE", "CONSULTANT", "VERIFIER", "ADMIN"];
const usersPerPortal = 1000;
const personaCounts = Object.fromEntries(portalRoles.map((role) => [role, usersPerPortal]));
const totalUsers = portalRoles.length * usersPerPortal;
const runPrefix = process.env.QA_PORTAL_PREFIX || `qa-portal-scale-${Date.now()}`;
const scenarios = Array.from({ length: usersPerPortal }, (_, index) => ({
  index: index + 1,
  client: { id: `CLIENT-${String(index + 1).padStart(4, "0")}`, eventType: ["PERSONAL", "CORPORATE", "SOCIAL", "SPORTS", "CULTURAL", "RELIGIOUS", "ENTERTAINMENT", "EDUCATIONAL", "VIRTUAL"][index % 9], guests: 30 + ((index * 17) % 970), city: ["Lagos", "Abuja", "Ibadan", "Port Harcourt", "Kano"][index % 5] },
  vendor: { id: `VENDOR-${String(index + 1).padStart(4, "0")}`, category: ["Venue", "Catering", "Photography", "Decor", "Production", "Transport", "Security", "Rentals"][index % 8] },
  verifier: { id: `VERIFIER-${String(index + 1).padStart(4, "0")}`, readinessScenario: ["PENDING", "GREEN", "AMBER", "RED"][index % 4] },
}));

if (planOnly) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    usersPerPortal,
    personas: personaCounts,
    totalUsers,
    activePortals: portalRoles,
    excluded: { RIDER: "decommissioned in the current app; sign-in and refresh are disabled" },
    journeyTestCoverage: "The existing database journey suite exercises 100 clients, 100 vendors and 100 verifiers; the 7,000 fixtures are a separate population/portal-boundary test target.",
    sampleScenarios: scenarios.slice(0, 5),
  }, null, 2));
  process.exit(0);
}

if (process.env.QA_SCALE_CONFIRM !== "YES") {
  console.error("Refusing to run. Set QA_SCALE_CONFIRM=YES after confirming this is a disposable local QA database.");
  process.exit(2);
}
if (process.env.NODE_ENV === "production" || process.env.DATABASE_MODE === "online") {
  console.error("Refusing to run against production/online database.");
  process.exit(2);
}
const qaUrl = process.env.QA_DATABASE_URL || "";
let parsed;
try { parsed = new URL(qaUrl); } catch {
  console.error("Set QA_DATABASE_URL to a disposable local PostgreSQL database.");
  process.exit(2);
}
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  console.error("Refusing remote/managed database. QA_DATABASE_URL must use localhost/127.0.0.1/::1.");
  process.exit(2);
}
const configuredUrl = process.env.DATABASE_URL || "";
if (configuredUrl && /(render\.com|neon\.tech|supabase\.(co|com))/i.test(configuredUrl)) {
  console.error("Refusing a managed/production-style DATABASE_URL.");
  process.exit(2);
}

const report = {
  startedAt: new Date().toISOString(),
  personas: personaCounts,
  totalUsers,
  fixtureStatus: "not_started",
  journeyCoverage: { CLIENT: 100, VENDOR: 100, VERIFIER: 100 },
  phases: [],
  status: "running",
  notes: ["RIDER is excluded because the current application explicitly decommissions rider sign-in.", "ADMIN fixtures are privileged and are created only in the disposable local database."],
};
const commonEnv = {
  QA_SCALE_CONFIRM: "YES",
  QA_DATABASE_URL: qaUrl,
  QA_PORTAL_PREFIX: runPrefix,
  DATABASE_URL: qaUrl,
  DATABASE_URL_LOCAL: qaUrl,
  DATABASE_MODE: "local",
  NODE_ENV: "test",
};
const phases = [
  { name: `Seed ${totalUsers.toLocaleString("en-US")} isolated portal identities (1,000 per active portal)`, command: "node", args: ["scripts/qa/seed-portal-personas.mjs"], env: commonEnv, onPass: () => { report.fixtureStatus = "seeded"; } },
  { name: "300-user database workflow regression (100 client, 100 vendor, 100 verifier)", command: "npm", args: ["run", "test:db", "-w", "apps/api", "--", "tests/scale-journeys.db.test.ts"], env: { ...commonEnv, RUN_SCALE_DB_TESTS: "1" } },
  { name: "API and web unit checks", command: "npm", args: ["run", "check"], env: commonEnv },
  { name: "responsive web production build", command: "npm", args: ["run", "build:web"], env: commonEnv },
  { name: "strict design quality gate", command: "npm", args: ["run", "design:audit:strict", "-w", "apps/web"], env: commonEnv },
  { name: "browser end-to-end regression", command: "npm", args: ["run", "test:e2e", "-w", "apps/web"], env: { ...commonEnv, CI: "1" } },
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

try {
  for (const phase of phases) {
    const result = await execute(phase);
    report.phases.push(result);
    if (result.status !== "passed") {
      report.status = "failed";
      break;
    }
    phase.onPass?.();
  }
} finally {
  if (report.fixtureStatus === "seeded") {
    const cleanup = await execute({
      name: "Remove only this run's synthetic portal accounts and dependent QA data",
      command: "node",
      args: ["scripts/qa/seed-portal-personas.mjs", "--clean"],
      env: commonEnv,
    });
    report.phases.push(cleanup);
    if (cleanup.status !== "passed") report.cleanupStatus = "failed";
    else report.cleanupStatus = "passed";
  }
}
if (report.status === "running") report.status = report.phases.every((phase) => phase.status === "passed") ? "passed" : "failed";
if (report.cleanupStatus === "failed") report.status = "failed";
report.finishedAt = new Date().toISOString();
const reportDir = path.join(root, "artifacts");
await mkdir(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "ephinta-scale-qa-report.json");
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`\n[EPHINTA QA] ${report.status.toUpperCase()} — report: ${reportPath}`);
if (report.status !== "passed") process.exit(1);
