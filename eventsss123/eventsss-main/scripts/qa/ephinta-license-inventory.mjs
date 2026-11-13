#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lockPath = resolve(ROOT, "package-lock.json");
const outputPath = resolve(ROOT, "artifacts/ephinta-dependency-license-inventory.md");
const lock = JSON.parse(await readFile(lockPath, "utf8"));
const packages = Object.entries(lock.packages || {}).filter(([path]) => path && !path.startsWith("node_modules/@ess/") && !["apps/api", "apps/web", "apps/mobile"].includes(path));
const byLicense = new Map();
const unknown = [];
for (const [path, pkg] of packages) {
  const license = typeof pkg.license === "string"
    ? pkg.license
    : Array.isArray(pkg.licenses)
      ? pkg.licenses.map((item) => item.type || "UNKNOWN").join(" OR ")
      : "UNKNOWN";
  const name = path.replace(/^node_modules\//, "");
  if (!byLicense.has(license)) byLicense.set(license, []);
  byLicense.get(license).push({ name, version: pkg.version || "unspecified" });
  if (license === "UNKNOWN" || license === "UNLICENSED") unknown.push({ name, version: pkg.version || "unspecified" });
}
const lines = [
  "# EPHINTA dependency licence inventory",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `Lockfile version: ${lock.lockfileVersion}`,
  `Third-party package entries: ${packages.length}`,
  `Packages with unknown/unlicensed metadata: ${unknown.length}`,
  "",
  "> This is a lockfile metadata inventory, not legal advice. Confirm the actual licence text and obligations for each distributed dependency. Preserve upstream licence and NOTICE files in shipped distributions.",
  "",
  "## Summary",
  "",
  "| SPDX / declared licence | Package entries |",
  "| --- | ---: |",
];
for (const [license, entries] of [...byLicense.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  lines.push(`| ${license.replaceAll("|", "\\|")} | ${entries.length} |`);
}
lines.push("", "## Package list", "");
for (const [license, entries] of [...byLicense.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  lines.push(`### ${license}`, "");
  for (const item of entries.sort((a, b) => a.name.localeCompare(b.name))) lines.push(`- \`${item.name}@${item.version}\``);
  lines.push("");
}
lines.push("## Manual review", "");
if (unknown.length) {
  lines.push("The following packages need manual licence confirmation:", "");
  for (const item of unknown) lines.push(`- \`${item.name}@${item.version}\``);
} else {
  lines.push("No third-party package entries have missing/unknown licence metadata in this lockfile snapshot. This does not replace review of the actual licence texts.");
}
lines.push("", "Internal EPHINTA workspace packages are excluded from the third-party count. Audio, images, fonts, and other non-npm assets are not represented in package-lock.json and require separate rights records.", "");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, lines.join("\n"), "utf8");
console.log(JSON.stringify({ thirdPartyPackages: packages.length, licenseTypes: byLicense.size, unknown: unknown.length, report: outputPath }, null, 2));
if (unknown.length) process.exitCode = 1;
