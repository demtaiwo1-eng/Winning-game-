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
  // Ignore commented-out examples when auditing executable UI.
  const executableSource = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  report.inspectedFiles += 1;

  if (/\.(tsx|jsx|html)$/.test(file)) {
    if (/<img\b/i.test(executableSource) && /<img\b[^>]*(?<![\w-])alt\s*=/.test(executableSource)) pass(relative + ": image alt attributes found");
    else if (/<img\b/i.test(executableSource)) warn(relative + ": review image alternative text");

    const clickableTags = [...executableSource.matchAll(/<(?:div|span)\b[^>]*\bonClick\s*=[^>]*>/gis)].map((match) => match[0]);
    const inaccessibleClickTargets = clickableTags.filter((tag) =>
      !/\brole\s*=\s*["'](?:presentation|dialog|button)["']/.test(tag) &&
      !/\btabIndex\s*=/.test(tag) &&
      !/\bonKey(?:Down|Up|Press)\s*=/.test(tag)
    );
    if (inaccessibleClickTargets.length) {
      warn(relative + ": review clickable div/span semantics and keyboard support");
    }
    if (/href\s*=\s*["']#["']/.test(executableSource)) warn(relative + ": placeholder hash link detected");
    if (/(?:\/\/|\/\*|\*|<!--)\s*(?:TODO|FIXME|IMPLEMENT LATER)\b/i.test(source)) {
      warn(relative + ": unfinished-work marker detected");
    }
  }

  if (/\.(css|scss)$/.test(file)) {
    if (/focus-visible|:focus\b/.test(source)) pass(relative + ": focus styling present");
    if (/width\s*:\s*100vw\s*;/i.test(source)) warn(relative + ": review 100vw for mobile overflow");
    const hasScrollableTable = /(?:\.table-responsive|\.data-table-wrap)[^{]*\{[^}]*overflow-x\s*:\s*auto/i.test(source);
    if (/min-width\s*:\s*(?:[4-9]\d{2}|\d{4,})px/i.test(source) && !hasScrollableTable) {
      warn(relative + ": review large fixed minimum width");
    }
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
  else {
    const entrySource = fs.readFileSync(entry, "utf8");


    const globalStyleImport = "import './styles/ephinta-global.css';";
    const cssImports = [...entrySource.matchAll(/^import\s+["'][^"']+\.css["'];?\s*$/gm)].map((match) => match[0]);
    if (!entrySource.includes(globalStyleImport)) fail("The single EPHINTA global stylesheet is not imported by the active application entry point.");
    else if (cssImports.length !== 1) fail("The application entry point must import exactly one global stylesheet.");
    else pass("The application entry point uses one centralized global stylesheet.");

    const globalStylePath = path.join(SOURCE, "styles", "ephinta-global.css");
    if (!fs.existsSync(globalStylePath)) fail("The centralized EPHINTA global stylesheet is missing.");
    else {
      const globalStyles = fs.readFileSync(globalStylePath, "utf8");
      if (!globalStyles.includes("ephinta-product-excellence.css")) fail("Product excellence stylesheet is not imported by the global stylesheet.");
      else pass("Product excellence stylesheet is imported globally.");
      if (!globalStyles.includes("ephinta-parent-design-system.css")) fail("The centralized stylesheet does not load the parent design system.");
      else if (!globalStyles.includes("ephinta-workspace-advertising.css")) fail("The centralized stylesheet does not load shared workspace styling.");
      else pass("Global design-system and workspace styles are centralized.");
    }

    const strayStyleImports = files.filter((file) => /\.(tsx|jsx|ts|js)$/.test(file) && file !== entry)
      .filter((file) => /import\s+["'][^"']+\.css["']/.test(fs.readFileSync(file, "utf8")));
    if (strayStyleImports.length) fail("Move component stylesheet imports into the global stylesheet: " + strayStyleImports.map((file) => path.relative(APP_ROOT, file)).join(", "));
    else pass("No component or portal imports a separate stylesheet.");

    const parentThemePath = path.join(SOURCE, "styles", "ephinta-parent-design-system.css");
    if (!fs.existsSync(parentThemePath)) fail("Parent design-system stylesheet is missing.");
    else {
      const parentTheme = fs.readFileSync(parentThemePath, "utf8");
      for (const token of ["--eph-parent-bg", "--eph-parent-surface", "--eph-parent-ink", "--eph-parent-primary", "--eph-parent-accent", "--eph-parent-radius", "--eph-parent-shadow", "--eph-parent-font"]) {
        if (!parentTheme.includes(token)) fail("Parent design-system token is missing: " + token);
      }
      for (const selector of [".ess-builder-card", ".ess-auth-modal", ".eph-modal", '[role="dialog"]', ".eph-audio__prompt[role=\"dialog\"]", ".eph-audio__accept", "@media (max-width: 680px)"]) {
        if (!parentTheme.includes(selector)) fail("Parent design-system coverage is missing: " + selector);
      }
      if (parentTheme.includes("--eph-parent-primary") && parentTheme.includes(".ess-builder-card") && parentTheme.includes(".ess-auth-modal")) {
        pass("Parent design tokens cover guided forms and shared authentication/dialog surfaces.");
      }
    }
  }

  const reportPath = path.join(APP_ROOT, "design-quality-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

  console.log("\nEPHINTA DESIGN QUALITY AUDIT");
  console.log(`Inspected files: ${report.inspectedFiles}`);
  console.log(`Passed: ${report.passed.length} | Warnings: ${report.warnings.length} | Failures: ${report.failures.length}`);
  for (const item of report.failures) console.error(`FAIL  ${item}`);
  for (const item of report.warnings) console.warn(`WARN  ${item}`);
  console.log(`Report: ${reportPath}`);

  // Strict mode fails on confirmed quality-gate violations; advisory heuristics remain visible as warnings.
  if (report.failures.length) process.exitCode = 1;
}

main();
