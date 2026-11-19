#!/usr/bin/env node
/**
 * EPHINTA one-command completion and release-readiness runner.
 *
 * Runs the existing auth gate, complete API/web checks, production builds,
 * design audit, and Android verification when the runner has Java/Android SDK.
 * It reports external prerequisites (Brevo sender verification, Render secrets,
 * payment provider credentials and physical-device acceptance) without
 * inventing credentials or modifying production services/data.
 *
 * Usage: npm run complete:application
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const outDir = resolve(root, "artifacts/application-completion");
mkdirSync(outDir, { recursive: true });
const results = [];
const startedAt = new Date().toISOString();

function run(name, command, args, options = {}) {
  console.log("\n" + "=".repeat(76) + "\n" + name + "\n" + "=".repeat(76));
  const r = spawnSync(command, args, {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: process.env, maxBuffer: 16 * 1024 * 1024, ...options,
  });
  const ok = r.status === 0;
  const output = [r.stdout, r.stderr].filter(Boolean).join("\n");
  results.push({ name, status: ok ? "PASS" : "FAIL", exitCode: r.status, output: output.slice(-20000) });
  console.log(output.slice(-7000));
  console.log(`\n[${ok ? "PASS" : "FAIL"}] ${name} (exit ${r.status})`);
  return ok;
}

const packageJson = JSON.parse(await (await import("node:fs/promises")).readFile(resolve(root, "package.json"), "utf8"));
const requiredScripts = ["check", "build", "build:web", "mobile:verify"];
for (const s of requiredScripts) {
  results.push({ name: `Root npm script: ${s}`, status: packageJson.scripts?.[s] ? "PASS" : "FAIL",
    output: packageJson.scripts?.[s] || "Missing from package.json" });
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
results.push({ name: "Node.js >= 20", status: nodeMajor >= 20 ? "PASS" : "FAIL", output: process.version });

const steps = [
  ["Install locked dependencies", "npm", ["ci"]],
  ["Authentication capability and delivery readiness gate", "node", ["scripts/qa/complete-authentication.mjs"]],
  ["Full API checks, Prisma validation, typecheck and tests", "npm", ["run", "check"]],
  ["API production build", "npm", ["run", "build"]],
  ["Web production build", "npm", ["run", "build:web"]],
  ["Design-system quality audit", "npm", ["run", "design:audit", "-w", "apps/web"]],
];
for (const [name, cmd, args] of steps) {
  if (!run(name, cmd, args)) {
    console.error("\nStopping at first failed mandatory stage. Fix the reported issue and rerun.");
    break;
  }
}

// Android verification is attempted only when a Java runtime is present.
// CI workflow configures Java 21 and Android SDK; local users without these
// prerequisites receive an explicit BLOCKED result instead of a false pass.
const java = spawnSync("java", ["-version"], { encoding: "utf8" });
if (java.status === 0) {
  run("Android sync, lint, unit tests and debug APK verification", "npm", ["run", "mobile:verify"]);
} else {
  results.push({ name: "Android verification", status: "BLOCKED",
    output: "Java/Android SDK is unavailable in this environment. Run in GitHub Actions with Java 21 and Android SDK configured." });
}

const envPresent = (key) => Boolean(process.env[key] && process.env[key].trim());
const external = [
  { name: "Brevo API key", key: "BREVO_API_KEY", instruction: "Add BREVO_API_KEY to Render backend environment; never commit or paste it into chat." },
  { name: "Brevo verified sender", key: "BREVO_SENDER_EMAIL", instruction: "Verify the sender email/domain in Brevo, then set BREVO_SENDER_EMAIL and BREVO_SENDER_NAME in Render." },
  { name: "Brevo sender display name", key: "BREVO_SENDER_NAME", instruction: "Set BREVO_SENDER_NAME in Render." },
  { name: "OPay sandbox/live credentials", key: "OPAY_TEST_SECRET_KEY", instruction: "Confirm sandbox credentials in Render; do not enable live mode until provider approval and reconciliation tests pass." },
  { name: "Cleva credentials", key: "CLEVA_API_KEY", instruction: "Only configure after confirming the correct Cleva product/API credentials and provider environment." },
];
for (const item of external) results.push({
  name: item.name, status: envPresent(item.key) ? "PRESENT" : "BLOCKED",
  output: envPresent(item.key) ? "Configured (value intentionally hidden)." : item.instruction,
});

const manual = [
  "Verify the Brevo sender/domain and send a real verification, resend and password-reset email to a controlled inbox.",
  "Run role-based registration/sign-in/reset/refresh/logout journeys for customer, planner, vendor and admin; confirm unauthorized cross-role access is rejected.",
  "Verify deposits, vendor part-payment requests, wallet/dashboard ledger updates, messaging and notification journeys with test accounts.",
  "Run OPay and Cleva sandbox success, decline, timeout, duplicate webhook, refund and reconciliation tests; keep live payment mode disabled until approved.",
  "Install the generated APK on real Android devices and test fresh install, app restart, session restore, deep links, permissions and update flow.",
  "Confirm Render production secrets, HTTPS, CORS, backups, logging and rollback procedure. Do not use CI-only credentials in production.",
];
const report = {
  repository: "demtaiwo1-eng/Winning-game-",
  startedAt, completedAt: new Date().toISOString(),
  results,
  externalPrerequisites: external.map(x => ({ name: x.name, status: envPresent(x.key) ? "PRESENT" : "BLOCKED", instruction: x.instruction })),
  manualReleaseGates: manual,
  summary: {
    passed: results.filter(x => x.status === "PASS").length,
    failed: results.filter(x => x.status === "FAIL").length,
    blocked: results.filter(x => x.status === "BLOCKED").length,
  },
  releaseDecision: results.some(x => x.status === "FAIL")
    ? "NOT READY: mandatory automated checks failed."
    : "AUTOMATED CHECKS ONLY: do not release until blocked external prerequisites and manual release gates are completed.",
};
writeFileSync(resolve(outDir, "completion-report.json"), JSON.stringify(report, null, 2) + "\n");
const markdown = [
  "# EPHINTA Application Completion Report", "",
  `Generated: ${report.completedAt}`, "",
  `**Release decision:** ${report.releaseDecision}`, "",
  `Passed: ${report.summary.passed} | Failed: ${report.summary.failed} | Blocked: ${report.summary.blocked}`, "",
  "## Automated stages", "",
  ...results.map(x => `- [${x.status}] **${x.name}** — ${x.output || ""}`),
  "", "## Manual release gates", "", ...manual.map(x => `- [ ] ${x}`),
  "", "Detailed command output is stored in completion-report.json. Secret values are never recorded.", "",
];
writeFileSync(resolve(outDir, "README.md"), markdown.join("\n"));
console.log("\nReport: artifacts/application-completion/README.md");
if (results.some(x => x.status === "FAIL")) process.exitCode = 1;
