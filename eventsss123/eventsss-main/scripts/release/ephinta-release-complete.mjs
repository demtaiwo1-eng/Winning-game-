#!/usr/bin/env node
/**
 * EPHINTA release completion runner.
 *
 * Runs the repository's real validation/build commands in order and writes a
 * machine-readable report. It never deploys, changes provider credentials,
 * moves real money, merges branches, or deletes branches.
 *
 * Optional flags:
 *   --install          run npm ci first
 *   --browser          run Playwright browser E2E after installing browsers
 *   --scale            run isolated local synthetic portal QA (requires its own
 *                      explicit QA_SCALE_CONFIRM=YES and localhost DB config)
 *   --release-apk      require Android signing env and assemble a release APK
 *   --allow-debug      allow a debug APK when signing credentials are absent
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const flags = new Set(process.argv.slice(2));
const reportDir = path.join(ROOT, "artifacts");
const reportPath = path.join(reportDir, "ephinta-release-completion-report.json");
const report = {
  app: "EPHINTA",
  startedAt: new Date().toISOString(),
  mode: "validation_and_build_only",
  safety: {
    realMoneyMoved: false,
    providerCredentialsReadOrChanged: false,
    deploymentTriggered: false,
    branchesMergedOrDeleted: false,
    note: "Payment QA is deterministic/mocked. Live provider settlement, store publishing, OTA rollout, and branch operations require separate verified authorization and credentials.",
  },
  steps: [],
  blockers: [],
  status: "running",
};

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const node = process.execPath;
let failed = false;

function step(name, command, args, options = {}) {
  return new Promise((resolve) => {
    console.log("\n[EPHINTA RELEASE] " + name);
    console.log("> " + command + " " + args.join(" "));
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, CI: process.env.CI || "1", ...options.env },
    });
    child.once("error", (error) => resolve({ name, status: "failed", error: error.message }));
    child.once("exit", (code, signal) => resolve({
      name,
      status: code === 0 ? "passed" : "failed",
      exitCode: code ?? null,
      signal: signal ?? null,
    }));
  });
}

async function run(name, command, args, options = {}) {
  const result = await step(name, command, args, options);
  report.steps.push(result);
  if (result.status !== "passed") {
    failed = true;
    report.blockers.push(name + " failed; inspect the preceding command output.");
  }
  return result.status === "passed";
}

async function fileExists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

async function persist() {
  report.finishedAt = new Date().toISOString();
  report.status = failed || report.blockers.length ? "failed" : "passed";
  await mkdir(reportDir, { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log("\n[EPHINTA RELEASE] " + report.status.toUpperCase());
  console.log("[EPHINTA RELEASE] Report: " + reportPath);
  if (report.blockers.length) {
    console.error("[EPHINTA RELEASE] Blockers:");
    for (const blocker of report.blockers) console.error(" - " + blocker);
  }
}

try {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  if (Number(process.versions.node.split(".")[0]) < 20) {
    report.blockers.push("Node.js 20 or newer is required.");
    failed = true;
  }
  if (!pkg.workspaces?.includes("apps/*")) {
    report.blockers.push("Expected npm workspace apps/* is missing.");
    failed = true;
  }

  if (!failed && flags.has("--install")) {
    if (!await run("Install exact lockfile dependencies", npm, ["ci"])) throw new Error("dependency install failed");
  }

  if (!failed && !await fileExists(path.join(ROOT, "node_modules", ".package-lock.json"))) {
    report.blockers.push("Dependencies are not installed. Run npm ci or rerun with --install.");
    failed = true;
  }

  if (!failed) {
    const core = [
      ["API schema, typecheck, API tests, web tests and KYC research tests", npm, ["run", "check"]],
      ["API production compilation", npm, ["run", "build"]],
      ["Web production compilation and SPA fallback", npm, ["run", "build:web"]],
      ["Bundled audio platform/configuration verification", npm, ["run", "audio:verify", "-w", "apps/web"]],
      ["Intellectual-property and bundled-asset release gate", npm, ["run", "ip:verify"]],
      ["Dependency licence and third-party notice inventory", npm, ["run", "licence:inventory"]],
      ["Deterministic 5,000-identity payment simulation (no provider calls)", node, ["scripts/qa/ephinta-5000-payment-functional.mjs"]],
      ["Device security verification", npm, ["run", "device-security:verify"]],
      ["Android lint, unit tests and debug APK assembly", npm, ["run", "mobile:verify"]],
    ];
    for (const [name, command, args] of core) {
      if (!await run(name, command, args)) break;
    }
  }

  if (!failed && flags.has("--browser")) {
    if (!await run("Install Playwright Chromium browser", npm, ["exec", "-w", "apps/web", "--", "playwright", "install", "--with-deps", "chromium"])) {
      report.blockers.push("Browser dependencies could not be installed.");
    } else {
      await run("Full Playwright browser end-to-end suite", npm, ["run", "test:e2e", "-w", "apps/web"]);
    }
  } else if (!flags.has("--browser")) {
    report.blockers.push("Browser E2E not run: rerun with --browser on a machine/runner with browser dependencies.");
  }

  if (!failed && flags.has("--scale")) {
    if (process.env.QA_SCALE_CONFIRM !== "YES") {
      report.blockers.push("Scale QA skipped: set QA_SCALE_CONFIRM=YES only after verifying QA_DATABASE_URL points to a disposable localhost database.");
    } else {
      await run("7,000-identity isolated portal scale QA", node, ["scripts/qa/ephinta-scale-qa.mjs"]);
    }
  } else if (!flags.has("--scale")) {
    report.blockers.push("7,000-identity portal fixture campaign not run: use --scale with an isolated localhost QA database.");
  }

  if (!failed) {
    const androidDir = path.join(ROOT, "apps", "mobile", "android");
    const debugApk = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
    const releaseApk = path.join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
    if (flags.has("--release-apk")) {
      const required = ["ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"];
      const missing = required.filter((key) => !process.env[key]);
      if (missing.length) {
        report.blockers.push("Signed release APK not built; missing signing environment variable names: " + missing.join(", ") + ". Values are never printed.");
      } else {
        await run("Assemble signed Android release APK", npm, ["run", "apk:release", "-w", "apps/mobile"]);
        if (await fileExists(releaseApk)) report.artifacts.push(releaseApk);
        else report.blockers.push("Gradle returned success but the expected release APK was not found.");
      }
    } else if (flags.has("--allow-debug")) {
      if (await fileExists(debugApk)) report.artifacts = [...(report.artifacts || []), debugApk];
      else report.blockers.push("Debug APK not found after mobile verification.");
    } else {
      report.blockers.push("APK distribution mode not selected. Use --release-apk with signing credentials, or --allow-debug for testing only.");
    }
  }

  if (!failed) {
    const webIndex = path.join(ROOT, "apps", "web", "dist", "index.html");
    if (await fileExists(webIndex)) report.artifacts = [...(report.artifacts || []), webIndex];
    else report.blockers.push("Web build output apps/web/dist/index.html is missing.");
  }

  report.releaseNotes = [
    "Passing this local runner does not certify real OPay/Cleva/Eversend settlement or webhook delivery.",
    "Silent web-content updates and native APK updates are separate release channels; OTA must be configured and tested with an authorized update provider/channel and rollback before enabling autoUpdate.",
    "The runner deliberately does not turn on CapacitorUpdater.autoUpdate, because no verified production channel/token/rollback configuration is present in source.",
    "It does not merge PRs, delete branches, change Render services/secrets, or deploy to production.",
  ];
} catch (error) {
  failed = true;
  report.blockers.push(String(error?.stack || error));
} finally {
  await persist();
}
if (report.status !== "passed") process.exitCode = 1;
