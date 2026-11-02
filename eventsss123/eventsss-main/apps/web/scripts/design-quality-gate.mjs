#!/usr/bin/env node
/**
 * EPHINTA frontend design-quality audit.
 * Static checks are advisory; browser, accessibility and journey tests remain required.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(APP_ROOT, "src");
const STRICT = process.argv.includes("--strict");
const IGNORE = new Set(["node_modules", "dist", "build", "coverage", ".vite"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".html"]);

const report = { generatedAt: new Date().toISOString(), inspectedFiles: 0, passed: [], warnings: [], failures: [] };
const pass = (message) => report.passed.push(message);
const warn = (message) => report.warnings.push(message);
const fail = (message) => report.failures.push(message);

function collect(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return IGNORE.has(entry.name) ? [] : collect(path.join(directory, entry.name));
    return EXTENSIONS.has(path.extname(entry.name)) ? [path.join(directory, entry.name)] : [];
  });
}

function inspect(file) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(APP_ROOT, file);
  report.inspectedFiles += 1;

  if (/\.(tsx|jsx|html)$/.test(file)) {
    if (/<img\b/i.test(source) && /<img\b[^>]*(?<![\w-])alt\s*=/.test(source)) pass(`${relative}: image alt attributes found`);
    else if (/<img\b/i.test(source)) warn(`${relative}: review image alternative text`);

    if (/<(?:div|span)\b[^>]*\bonClick\s*=/.test(source)) {
      warn(`${relative}: review clickable div/span semantics and keyboard support`);
    }
    if (/href\s*=\s*["']#["']/.test(source)) warn(`${relative}: placeholder hash link detected`);
    if (/TODO|FIXME|IMPLEMENT LATER/i.test(source)) warn(`${relative}: unfinished-work marker detected`);
  }

  if (/\.(css|scss)$/.test(file)) {
    if (/focus-visible|:focus\b/.test(source)) pass(`${relative}: focus styling present`);
    if (/width\s*:\s*100vw\s*;/i.test(source)) warn(`${relative}: review 100vw for mobile overflow`);
    if (/min-width\s*:\s*(?:[4-9]\d{2}|\d{4,})px/i.test(source)) warn(`${relative}: review large fixed minimum width`);
  }
}

function main() {
  if (!fs.existsSync(SOURCE)) fail("Missing frontend src directory.");
  const files = collect(SOURCE);
  if (!files.length) fail("No frontend source files found.");

  for (const file of files) inspect(file);

  const packagePath = path.join(APP_ROOT, "package.json");
  if (!fs.existsSync(packagePath)) fail("Missing apps/web/package.json.");
  else {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    if (pkg.scripts?.build) pass("Production build script configured.");
    else fail("Missing production build script.");
    if (pkg.scripts?.test) pass("Frontend test script configured.");
    else warn("No frontend test script configured.");
  }

  const entry = path.join(SOURCE, "main.tsx");
  if (!fs.existsSync(entry)) fail("Missing src/main.tsx.");
  else if (fs.readFileSync(entry, "utf8").includes("ephinta-product-excellence.css")) pass("Product excellence stylesheet is imported.");
  else fail("Product excellence stylesheet is not imported.");

  const reportPath = path.join(APP_ROOT, "design-quality-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

  console.log("\nEPHINTA DESIGN QUALITY AUDIT");
  console.log(`Inspected files: ${report.inspectedFiles}`);
  console.log(`Passed: ${report.passed.length} | Warnings: ${report.warnings.length} | Failures: ${report.failures.length}`);
  for (const item of report.failures) console.error(`FAIL  ${item}`);
  for (const item of report.warnings) console.warn(`WARN  ${item}`);
  console.log(`Report: ${reportPath}`);

  if (report.failures.length || (STRICT && report.warnings.length)) process.exitCode = 1;
}

main();
