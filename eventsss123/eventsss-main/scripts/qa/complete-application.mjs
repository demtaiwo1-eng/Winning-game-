#!/usr/bin/env node
/**
 * EPHINTA one-command completion gate.
 *
 * Runs every safe, repository-defined automated validation stage and writes
 * a redacted JSON/Markdown report. It deliberately does not alter production
 * data, deploy, enable live payments, invent provider credentials, or sign an
 * Android release without the owner's keystore.
 *
 * Usage: npm run complete:application
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const outDir = resolve(root, "artifacts/application-completion");
mkdirSync(outDir, { recursive: true });
const startedAt = new Date().toISOString();
const results = [];
const secretValues = Object.entries(process.env)
  .filter(([key, value]) => /SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY/i.test(key) && value)
  .map(([, value]) => value)
  .filter(value => value.length >= 6);

function redact(value = "") {
  let result = String(value);
  for (const secret of secretValues) result = result.split(secret).join("[REDACTED]");
  return result;
}

function run(name, command, args, { optional = false, env = process.env, retries = 0 } = {}) {
  console.log("\\n" + "=".repeat(72) + "\\n" + name + "\\n" + "=".repeat(72));
  let r;
  let attempt = 0;
  do {
    attempt += 1;
    r = spawnSync(command, args, {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env, maxBuffer: 20 * 1024 * 1024,
    });
    const combined = [r.stdout, r.stderr, r.error?.message].filter(Boolean).join("\\n");
    const transient = /429|Too Many Requests|502 Bad Gateway|503 Service Unavailable|ECONNRESET|ETIMEDOUT/i.test(combined);
    if (r.status === 0 || !transient || attempt > retries) break;
    const delayMs = Math.min(60_000, 10_000 * (2 ** (attempt - 1)));
    console.log(`[RETRY] ${name}: transient dependency/network failure (${attempt}/${retries}); waiting ${delayMs / 1000}s before retry`);
    // Give Maven Central time to clear HTTP 429 throttling before Gradle retries.
    spawnSync(process.execPath, ["-e", `setTimeout(() => process.exit(0), ${delayMs})`], { stdio: "ignore" });
  } while (attempt <= retries);
  const output = redact([r.stdout, r.stderr, r.error?.message].filter(Boolean).join("\\n")).slice(-18000);
  const passed = r.status === 0;
  const status = passed ? "PASS" : optional && r.error?.code === "ENOENT" ? "BLOCKED" : "FAIL";
  results.push({ name, status, exitCode: r.status, attempts: attempt, output });
  console.log(output.slice(-6500));
  console.log(`[${status}] ${name}`);
  return passed;
}

const packageJson = await (await import("node:fs/promises")).readFile(resolve(root, "package.json"), "utf8")
  .then(JSON.parse);
const requiredScripts = [
  "check", "build", "build:web", "mobile:verify", "ux:audit",
  "device-security:verify", "complete:application",
];
for (const name of requiredScripts) {
  results.push({
    name: `Repository script exists: ${name}`,
    status: packageJson.scripts?.[name] ? "PASS" : "FAIL",
    output: packageJson.scripts?.[name] || "Missing npm script",
  });
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
results.push({ name: "Node.js >= 20", status: nodeMajor >= 20 ? "PASS" : "FAIL", output: process.version });

const installOk = run("Install exact lockfile dependencies", "npm", ["ci"]);
if (installOk) {
  // Install the exact Playwright browser revision after npm ci; workflow-level installs can be invalidated by this clean install.
  run("Install matching Playwright Chromium", "npm", ["exec", "--workspace", "apps/web", "--", "playwright", "install", "--with-deps", "chromium"], { retries: 2 });
  // Run independently: a failure in one stage must not hide later diagnostics.
  run("Authentication capability, API and database readiness gate", "node", ["scripts/qa/complete-authentication.mjs"]);
  run("Full API, web and KYC automated checks", "npm", ["run", "check"]);
  run("API production build and Prisma client generation", "npm", ["run", "build"]);
  run("Web production build", "npm", ["run", "build:web"]);
  run("UX/accessibility audit", "npm", ["run", "ux:audit"]);
  run("Device security verification", "npm", ["run", "device-security:verify"]);
} else {
  for (const name of [
    "Authentication capability, API and database readiness gate",
    "Full API, web and KYC automated checks",
    "API production build and Prisma client generation",
    "Web production build", "UX/accessibility audit", "Device security verification",
  ]) results.push({ name, status: "BLOCKED", output: "Skipped because npm ci failed." });
}

const java = spawnSync("java", ["-version"], { encoding: "utf8" });
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (java.status === 0 && sdk) {
  // The Android Gradle project contains generated Capacitor/Cordova files.
  // Re-sync after npm ci and the web build so cordova.variables.gradle exists
  // before Gradle evaluates capacitor.build.gradle.
  const androidSyncOk = run("Generate and sync Capacitor Android project", "npm", ["run", "sync", "-w", "apps/mobile"]);
  if (androidSyncOk) {
    // Retry only the Android Gradle gate so a Maven Central 429 does not repeat the entire suite.
    run("Android lint, unit tests and debug APK verification", "npm", ["run", "verify:android", "-w", "apps/mobile"], { retries: 4 });
  } else {
    results.push({ name: "Android lint, unit tests and debug APK verification", status: "BLOCKED", output: "Skipped because Capacitor Android sync failed." });
  }
} else {
  results.push({
    name: "Android verification",
    status: "BLOCKED",
    output: "Requires Java 21 and Android SDK. CI should install these before running this gate; physical-device install/restart testing remains manual.",
  });
}

const envRequirements = [
  ["Brevo API key", "BREVO_API_KEY", "Set BREVO_API_KEY in Render after creating the Brevo transactional API key."],
  ["Brevo verified sender", "BREVO_SENDER_EMAIL", "Verify the sender/domain in Brevo, then set BREVO_SENDER_EMAIL in Render."],
  ["Brevo sender name", "BREVO_SENDER_NAME", "Set BREVO_SENDER_NAME in Render."],
  ["OPay sandbox secret", "OPAY_TEST_SECRET_KEY", "Configure the provider's sandbox secret in Render; keep live mode disabled."],
  ["Cleva API credential", "CLEVA_API_KEY", "Confirm the Cleva product and environment, then configure its credential in Render."],
];
const external = envRequirements.map(([name, key, instruction]) => ({
  name,
  status: process.env[key]?.trim() ? "PRESENT" : "BLOCKED",
  instruction: process.env[key]?.trim() ? "Configured; value intentionally hidden." : instruction,
}));
for (const item of external) results.push({ name: item.name, status: item.status, output: item.instruction });

const manual = [
  "Verify Brevo sender/domain and test verification, resend and password-reset emails in a real inbox.",
  "Test registration, incorrect password, reset, refresh, logout and session expiry for customer, planner, vendor and admin.",
  "Verify role isolation and suspended-account rejection using separate test accounts.",
  "Verify event booking, planner deposits, vendor part-payment requests and ledger/dashboard updates.",
  "Verify individual/group messaging, notifications and delivery/read states.",
  "Test OPay and Cleva sandbox success, decline, timeout, duplicate webhook, refund and reconciliation; do not enable live payments before provider approval.",
  "Install the debug APK on physical Android devices; test fresh install, restart, session restore, permissions, deep links and update behaviour.",
  "Confirm Render HTTPS, CORS, backups, monitoring, rollback and production-only secrets.",
  "A production Android release requires the owner's original signing keystore or a newly generated key with an intentional package/signing migration plan.",
];

const counts = Object.fromEntries(["PASS", "FAIL", "BLOCKED", "PRESENT"].map(s => [
  s, results.filter(x => x.status === s).length,
]));
const report = {
  repository: "demtaiwo1-eng/Winning-game-",
  startedAt,
  completedAt: new Date().toISOString(),
  results,
  externalPrerequisites: external,
  manualReleaseGates: manual,
  summary: counts,
  releaseDecision: counts.FAIL
    ? "NOT READY: automated failures must be fixed and rerun."
    : "AUTOMATED GATES REPORTED: complete all BLOCKED prerequisites and manual release gates before release.",
};
writeFileSync(resolve(outDir, "completion-report.json"), JSON.stringify(report, null, 2) + "\\n");
const markdown = [
  "# EPHINTA One-Go Completion Report", "",
  `Generated: ${report.completedAt}`, "",
  `**Release decision:** ${report.releaseDecision}`, "",
  `PASS: ${counts.PASS} | FAIL: ${counts.FAIL} | BLOCKED: ${counts.BLOCKED}`, "",
  "## Automated results", "",
  ...results.map(x => `- [${x.status}] **${x.name}** — ${x.output.replace(/\\s+/g, " ").slice(0, 500)}`),
  "", "## Manual release gates", "",
  ...manual.map(x => `- [ ] ${x}`),
  "", "Sensitive environment values are not included in this report.", "",
];
writeFileSync(resolve(outDir, "README.md"), markdown.join("\\n"));
console.log(`\\nReports: ${outDir}/README.md and completion-report.json`);
if (counts.FAIL) process.exitCode = 1;
