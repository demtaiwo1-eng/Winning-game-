#!/usr/bin/env node
/**
 * One-command EPHINTA design-system completion gate.
 *
 * Produces a CSS dependency/conflict inventory, then runs the authoritative
 * API, web, build and strict theme/design checks. It deliberately does not
 * delete duplicate CSS selectors: cascade order and screen-specific intent
 * require visual review before a rule can safely be removed.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(APP_ROOT, "../..");
const SRC = path.join(APP_ROOT, "src");
const REPORT_PATH = path.join(APP_ROOT, "design-system-completion-report.json");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const IGNORE = new Set(["node_modules", "dist", "build", "coverage", ".vite"]);
const report = {
  generatedAt: new Date().toISOString(),
  scope: "global stylesheet dependency graph and static design-system checks",
  automaticCssDeletion: false,
  stylesheetCount: 0,
  importedStylesheets: [],
  missingImports: [],
  duplicateSelectors: [],
  hardCodedColorUsage: [],
  largeMinimumWidths: [],
  checks: [],
  commands: [],
  result: "running"
};

function collectCss(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return IGNORE.has(entry.name) ? [] : collectCss(full);
    return entry.isFile() && entry.name.endsWith(".css") ? [full] : [];
  });
}

function resolveImports(file, visited = new Set(), missing = []) {
  const absolute = path.resolve(file);
  if (visited.has(absolute) || !fs.existsSync(absolute)) return { visited, missing };
  visited.add(absolute);
  const source = fs.readFileSync(absolute, "utf8");
  for (const match of source.matchAll(/^\s*@import\s+(?:url\()?["']([^"']+)["']\)?[^;]*;/gm)) {
    const specifier = match[1];
    if (/^(?:https?:|data:|\/\/)/i.test(specifier)) continue;
    const target = path.resolve(path.dirname(absolute), specifier.split("?")[0]);
    if (!fs.existsSync(target)) {
      missing.push({ from: path.relative(APP_ROOT, absolute), import: specifier });
      continue;
    }
    resolveImports(target, visited, missing);
  }
  return { visited, missing };
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function inventory() {
  const globalCss = path.join(SRC, "styles", "ephinta-global.css");
  if (!fs.existsSync(globalCss)) {
    report.checks.push({ name: "central global stylesheet", passed: false });
    return;
  }
  const { visited, missing } = resolveImports(globalCss);
  const cssFiles = [...visited].filter((file) => file.endsWith(".css"));
  report.stylesheetCount = cssFiles.length;
  report.importedStylesheets = cssFiles.map((file) => path.relative(APP_ROOT, file)).sort();
  report.missingImports = missing;
  report.checks.push({ name: "all recursive stylesheet imports resolve", passed: missing.length === 0 });

  const selectorOwners = new Map();
  for (const file of cssFiles) {
    const source = stripComments(fs.readFileSync(file, "utf8"));
    const relative = path.relative(APP_ROOT, file);
    const hex = (source.match(/#[\da-f]{3,8}\b/gi) ?? []).length;
    const rgb = (source.match(/\b(?:rgba?|hsla?)\s*\(/gi) ?? []).length;
    if (hex + rgb) report.hardCodedColorUsage.push({ file: relative, hexOrShortHex: hex, rgbOrHsl: rgb, total: hex + rgb });

    const minWidths = [...source.matchAll(/min-width\s*:\s*(\d{3,})px/gi)]
      .map((match) => Number(match[1])).filter((value) => value >= 400);
    if (minWidths.length) report.largeMinimumWidths.push({ file: relative, valuesPx: [...new Set(minWidths)].sort((a,b) => a-b) });

    // This is a review inventory, not a CSS parser. Preserve selector text and
    // source ownership; duplicate selectors may be intentional cascade layers.
    for (const match of source.matchAll(/([^{}]+)\{/g)) {
      const header = match[1].trim().replace(/\s+/g, " ");
      if (!header || header.startsWith("@") || header.includes("@")) continue;
      for (const selector of header.split(",").map((item) => item.trim()).filter(Boolean)) {
        if (selector.length > 240) continue;
        const owners = selectorOwners.get(selector) ?? new Set();
        owners.add(relative);
        selectorOwners.set(selector, owners);
      }
    }
  }

  report.duplicateSelectors = [...selectorOwners.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([selector, owners]) => ({ selector, files: [...owners].sort() }))
    .sort((a,b) => b.files.length - a.files.length || a.selector.localeCompare(b.selector));

  report.checks.push({
    name: "duplicate selector inventory generated",
    passed: true,
    findingCount: report.duplicateSelectors.length
  });
  report.checks.push({
    name: "hard-coded colour inventory generated",
    passed: true,
    findingCount: report.hardCodedColorUsage.reduce((sum, item) => sum + item.total, 0)
  });
  report.checks.push({
    name: "large fixed minimum-width inventory generated",
    passed: true,
    findingCount: report.largeMinimumWidths.length
  });
}

function run(label, args) {
  console.log("\n=== " + label + " ===");
  const result = spawnSync(npm, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
  const passed = result.status === 0;
  report.commands.push({ label, command: "npm " + args.join(" "), status: result.status, passed });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
  return passed;
}

function main() {
  console.log("EPHINTA ONE-GO DESIGN-SYSTEM COMPLETION");
  inventory();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
  console.log("CSS files in global import graph: " + report.stylesheetCount);
  console.log("Duplicate selector groups for review: " + report.duplicateSelectors.length);
  console.log("Hard-coded colour occurrences for review: " + report.hardCodedColorUsage.reduce((sum, item) => sum + item.total, 0));
  console.log("Unresolved CSS imports: " + report.missingImports.length);

  if (report.missingImports.length) {
    report.result = "failed";
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
    console.error("STOP: resolve missing CSS imports before running the build gates.");
    process.exitCode = 1;
    return;
  }

  const commands = [
    ["API type, Prisma and web unit-test checks", ["run", "check"]],
    ["Production API build", ["run", "build"]],
    ["Production web build", ["run", "build:web"]],
    ["Strict design and global theme contract", ["run", "design:audit:strict", "-w", "apps/web"]]
  ];

  for (const [label, args] of commands) {
    if (!run(label, args)) {
      report.result = "failed";
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
      console.error("\nSTOP: " + label + " failed. Fix the reported issue, then rerun this command.");
      process.exitCode = 1;
      return;
    }
  }

  report.result = "passed";
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
  console.log("\nEPHINTA DESIGN-SYSTEM COMPLETION GATE PASSED.");
  console.log("Report: " + path.relative(REPO_ROOT, REPORT_PATH));
  console.log("Note: responsive screenshots and authenticated workspace journeys remain separate browser-evidence gates.");
}

main();
