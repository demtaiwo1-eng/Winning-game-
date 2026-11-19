#!/usr/bin/env node
/**
 * EPHINTA global theme contract regression gate.
 * Complements browser visual testing; it does not replace screenshot review.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(APP_ROOT, "src");
const failures = [];
const passes = [];
const check = (condition, message) => (condition ? passes : failures).push(message);
const read = (relative) => {
  const target = path.join(APP_ROOT, relative);
  if (!fs.existsSync(target)) {
    failures.push("Missing required file: " + relative);
    return "";
  }
  return fs.readFileSync(target, "utf8");
};

const entry = read("src/main.tsx");
const globalCss = read("src/styles/ephinta-global.css");
const themeCss = read("src/styles/ephinta-global-theme-contract.css");
const introCss = read("src/components/branding/ephinta-intro.css");
const audioCss = read("src/styles/ephinta-audio.css");

check(entry.includes("import './styles/ephinta-global.css';"),
  "Application entry imports the centralized global stylesheet.");
check((entry.match(/^import\s+["'][^"']+\.css["'];?\s*$/gm) ?? []).length === 1,
  "Application entry imports exactly one global CSS entry.");
check(!/style\s*=\s*\{\{/i.test(entry),
  "Startup and error UI contain no inline style objects.");
check(!/#(?:[0-9a-f]{3,8})\b/i.test(entry),
  "Application entry contains no hard-coded hexadecimal UI colours.");

const imports = [...globalCss.matchAll(/^\s*@import\s+["']([^"']+)["'];/gm)].map((match) => match[1]);
check(imports.at(-1) === "./ephinta-global-theme-contract.css",
  "Global theme contract is the final imported stylesheet.");
const missingImports = imports.filter((specifier) =>
  !fs.existsSync(path.resolve(SRC, "styles", specifier))
);
check(missingImports.length === 0,
  missingImports.length ? "Global stylesheet has unresolved imports: " + missingImports.join(", ") : "Every global stylesheet import resolves.");

for (const mode of ["light", "dark", "colorful"]) {
  const declared = themeCss.includes('data-ephinta-theme="' + mode + '"') ||
    themeCss.includes('data-theme="' + mode + '"') || themeCss.includes(".theme-" + mode);
  check(declared, "Theme contract declares the " + mode + " mode.");
  const selectorCount = (themeCss.match(new RegExp('html\\\\[data-ephinta-theme="' + mode + '"\\\\]', "g")) ?? []).length;
  check(selectorCount === 1, "Theme contract defines the " + mode + " palette exactly once.");
}
for (const token of ["--epg-page", "--epg-surface", "--epg-ink", "--epg-muted", "--epg-border", "--epg-link", "--epg-focus", "--epg-accent", "--epg-accent-ink"]) {
  check(themeCss.includes(token), "Global theme token exists: " + token);
}
check(/background:\s*var\(--epg-page/.test(introCss) && /color:\s*var\(--epg-ink/.test(introCss),
  "Intro splash background and foreground consume global theme tokens.");
check(audioCss.includes("var(--epg-page") && audioCss.includes("var(--epg-surface") && audioCss.includes("var(--epg-ink") && audioCss.includes("var(--epg-accent") && audioCss.includes("var(--epg-focus"),
  "Audio consent, player, restore button and focus states consume global theme tokens.");
check(globalCss.includes(".ephinta-startup-screen") && globalCss.includes("var(--epg-accent)"),
  "Startup and fatal-error surfaces consume global theme tokens.");
check(/@media\s*\(max-width:\s*390px\)/.test(globalCss),
  "Startup surface has a compact-phone responsive rule.");
check(/prefers-reduced-motion/.test(introCss) && /prefers-reduced-motion/.test(themeCss),
  "Theme and intro styles respect reduced-motion preferences.");

console.log("\nEPHINTA GLOBAL THEME CONTRACT");
console.log("Passed: " + passes.length + " | Failed: " + failures.length);
for (const item of passes) console.log("PASS " + item);
for (const item of failures) console.error("FAIL " + item);
const report = { generatedAt: new Date().toISOString(), passed: passes, failures };
fs.writeFileSync(path.join(APP_ROOT, "theme-contract-report.json"), JSON.stringify(report, null, 2) + "\n");
if (failures.length) process.exitCode = 1;
