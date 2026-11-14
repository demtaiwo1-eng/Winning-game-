#!/usr/bin/env node
/**
 * EPHINTA hard-core acceptance runner.
 *
 * Executes real repository checks and writes artifacts/ephinta-hardcore-acceptance.json.
 * It never changes production data, moves money, reads secrets, deploys, merges,
 * or deletes branches. External release prerequisites are reported as BLOCKED,
 * never fabricated as passes.
 *
 * Usage:
 *   node scripts/release/ephinta-hardcore-acceptance.mjs
 *   node scripts/release/ephinta-hardcore-acceptance.mjs --install
 *   node scripts/release/ephinta-hardcore-acceptance.mjs --browser
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = new Set(process.argv.slice(2));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const reportDir = path.join(ROOT, "artifacts");
const reportFile = path.join(reportDir, "ephinta-hardcore-acceptance.json");
const report = {
  app: "EPHINTA",
  startedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || process.env.GIT_COMMIT || null,
  checks: [],
  releaseBlockers: [],
  safety: {
    realMoneyMoved: false,
    liveProviderCalled: false,
    secretsReadOrPrinted: false,
    productionDeploymentTriggered: false,
    branchesChanged: false,
  },
};
let failed = false;

const exists = async (file) => {
  try { return (await stat(file)).isFile(); } catch { return false; }
};

function execute(name, command, commandArgs, extraEnv = {}) {
  return new Promise((resolve) => {
    console.log("\n[EPHINTA ACCEPTANCE] " + name);
    console.log("$ " + command + " " + commandArgs.join(" "));
    const child = spawn(command, commandArgs, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, CI: process.env.CI || "1", ...extraEnv },
    });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ name, ...result });
    };
    child.once("error", (error) => finish({ status: "failed", error: error.message }));
    child.once("exit", (code, signal) => finish({
      status: code === 0 ? "passed" : "failed",
      exitCode: code ?? null,
      signal: signal ?? null,
    }));
  });
}

async function check(name, command, commandArgs, extraEnv) {
  const result = await execute(name, command, commandArgs, extraEnv);
  report.checks.push(result);
  if (result.status !== "passed") failed = true;
  return result.status === "passed";
}

async function main() {
  const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  if (Number(process.versions.node.split(".")[0]) < 20) {
    throw new Error("Node.js 20+ is required.");
  }
  if (!packageJson.workspaces?.includes("apps/*")) {
    throw new Error("Expected npm workspace apps/* was not found.");
  }

  if (args.has("--install")) {
    await check("Clean lockfile dependency installation", npm, ["ci"]);
  } else if (!await exists(path.join(ROOT, "node_modules", ".package-lock.json"))) {
    throw new Error("Dependencies are absent. Run with --install to execute npm ci.");
  }

  const commands = [
    ["API schema, TypeScript, non-database API tests, web tests and KYC research tests", npm, ["run", "check"], { RUN_DB_TESTS: "0" }],
    ["API production build", npm, ["run", "build"]],
    ["Web production build and SPA fallback", npm, ["run", "build:web"]],
    ["Audio permission/platform safety checks", npm, ["run", "audio:verify", "-w", "apps/web"]],
    ["Source/asset IP release gate", npm, ["run", "ip:verify"]],
    ["Dependency licence and third-party notices inventory", npm, ["run", "licence:inventory"]],
    ["Responsive UX audit", npm, ["run", "ux:audit"]],
    ["Strict web design quality audit", npm, ["run", "design:audit:strict", "-w", "apps/web"]],
    ["Device security verification", npm, ["run", "device-security:verify"]],
    ["5,000 deterministic payment personas (mocked; zero provider calls)", process.execPath, ["scripts/qa/ephinta-5000-payment-functional.mjs"]],
  ];

  for (const [name, command, commandArgs, extraEnv] of commands) {
    await check(name, command, commandArgs, extraEnv);
  }

  if (process.env.RUN_DB_TESTS === "1" && process.env.DATABASE_URL) {
    await check("Apply Prisma migrations to isolated CI PostgreSQL", npm, ["run", "db:deploy", "-w", "apps/api"], { DATABASE_URL_LOCAL: process.env.DATABASE_URL });
    await check("API PostgreSQL integration regression suite", npm, ["run", "test:db", "-w", "apps/api"], { DATABASE_URL_LOCAL: process.env.DATABASE_URL, RUN_DB_TESTS: "1" });
  } else {
    report.releaseBlockers.push("Database integration suite not run in this invocation; CI must provide a disposable PostgreSQL service with RUN_DB_TESTS=1.");
  }

  if (process.env.JAVA_HOME || process.platform === "linux") {
    await check("Capacitor Android project sync", npm, ["run", "sync", "-w", "apps/mobile"]);
    await check("Android lint, unit tests and debug APK build", npm, ["run", "verify:android", "-w", "apps/mobile"]);
  } else {
    report.releaseBlockers.push("Android build skipped: configure JDK 21 and Android SDK on this runner.");
  }

  if (args.has("--browser")) {
    await check("Install Playwright Chromium", npm, ["exec", "-w", "apps/web", "--", "playwright", "install", "--with-deps", "chromium"]);
    await check("Playwright browser end-to-end journeys", npm, ["run", "test:e2e", "-w", "apps/web"]);
  } else {
    report.releaseBlockers.push("Browser E2E suite not requested in this invocation; rely on the dedicated browser workflow or rerun with --browser and its required test services.");
  }

  const requiredSecrets = ["ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"];
  const missingSigning = requiredSecrets.filter((name) => !process.env[name]);
  if (missingSigning.length) {
    report.releaseBlockers.push("Production-signed APK blocked: configure the four Android signing secrets in GitHub Actions. Secret values are never read or printed by this runner.");
  }

  report.releaseBlockers.push(
    "OPay live settlement, verified webhook delivery, merchant approval and reconciliation require owner-controlled live credentials and a real provider test; mocked payment tests do not prove settlement.",
    "Paid-only subscription access remains blocked until purchase verification, entitlement grant/expiry/refund and server-side authorization are implemented and tested end to end.",
    "Cleva and Eversend remain blocked pending approved accounts, official API contracts, sandbox credentials and webhook specifications.",
    "A physical Android device install/launch and upgrade test is still required; emulator or APK assembly is not equivalent.",
    "Copyright ownership, contributor assignments, logo/asset provenance and commercial distribution rights require owner/legal evidence; automated similarity and licence scans are not a legal clearance.",
    "KYC provider approval, database backup restore rehearsal, and the planner/vendor/notification end-to-end business journeys require their own environment-backed evidence.",
    "Native app code updates require a signed release; web/PWA deployment does not silently update every installed native APK."
  );

  const webBuild = path.join(ROOT, "apps", "web", "dist", "index.html");
  const debugApk = path.join(ROOT, "apps", "mobile", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  report.artifacts = {
    webBuildPresent: await exists(webBuild),
    debugApkPresent: await exists(debugApk),
    webBuild: await exists(webBuild) ? "apps/web/dist/index.html" : null,
    debugApk: await exists(debugApk) ? "apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk" : null,
  };
}

try {
  await main();
} catch (error) {
  failed = true;
  report.fatalError = String(error?.stack || error);
} finally {
  report.finishedAt = new Date().toISOString();
  report.testSuiteStatus = failed || report.checks.some((item) => item.status !== "passed") ? "failed" : "passed";
  report.productionReleaseStatus = report.testSuiteStatus === "passed" && report.releaseBlockers.length === 0 ? "approved" : "blocked";
  await mkdir(reportDir, { recursive: true });
  await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log("\n[EPHINTA ACCEPTANCE] Test suite: " + report.testSuiteStatus.toUpperCase());
  console.log("[EPHINTA ACCEPTANCE] Production release: " + report.productionReleaseStatus.toUpperCase());
  console.log("[EPHINTA ACCEPTANCE] Report: " + reportFile);
  for (const blocker of report.releaseBlockers) console.log("[BLOCKED] " + blocker);
}
if (report.testSuiteStatus !== "passed") process.exitCode = 1;
