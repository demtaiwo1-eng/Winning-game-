#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
const artifactDir = path.join(ROOT, "artifacts");
const inventoryPath = path.join(artifactDir, "ephinta-dependency-license-inventory.md");
const noticesPath = path.join(artifactDir, "ephinta-third-party-notices.md");
const spdxDir = process.env.SPDX_LICENSE_TEXT_DIR || path.join(artifactDir, "spdx-license-texts");
const knownSpdxIds = [
  "MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "MPL-2.0",
  "BlueOak-1.0.0", "Unlicense", "CC-BY-4.0", "MIT-0", "0BSD", "CC0-1.0",
];

function licenseOf(entry, packageJson) {
  if (typeof entry.license === "string") return entry.license;
  if (Array.isArray(entry.licenses)) return entry.licenses.map((item) => item.type || "UNKNOWN").join(" OR ");
  if (typeof packageJson?.license === "string") return packageJson.license;
  if (Array.isArray(packageJson?.licenses)) return packageJson.licenses.map((item) => item.type || "UNKNOWN").join(" OR ");
  return "UNKNOWN";
}
function packageName(lockPath) {
  const marker = lockPath.lastIndexOf("node_modules/");
  return marker >= 0 ? lockPath.slice(marker + "node_modules/".length) : lockPath;
}
function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
function licenseIds(expression) {
  return [...new Set(String(expression).match(/[A-Za-z0-9.-]+/g) || [])]
    .filter((token) => !["OR", "AND", "WITH", "SEE", "LICENSE", "IN", "UNKNOWN", "UNLICENSED"].includes(token.toUpperCase()));
}

const spdxTexts = new Map();
for (const id of knownSpdxIds) {
  const file = path.join(spdxDir, id + ".txt");
  if (fs.existsSync(file)) spdxTexts.set(id, fs.readFileSync(file, "utf8").trim());
}

const entries = Object.entries(lock.packages || {}).filter(([lockPath]) =>
  lockPath.includes("node_modules/") && !lockPath.includes("node_modules/@ess/")
);
const packages = [];
const byLicense = new Map();
const uniqueTexts = new Map();
const unknown = [];
const missingText = [];
const spdxFallbackPackages = [];

function addText(text, packageRef, source) {
  if (!text) return;
  const digest = createHash("sha256").update(text).digest("hex");
  if (!uniqueTexts.has(digest)) uniqueTexts.set(digest, { digest, text, packages: [], source });
  uniqueTexts.get(digest).packages.push(packageRef);
}

for (const [lockPath, entry] of entries) {
  const name = packageName(lockPath);
  const packageDir = path.resolve(ROOT, lockPath);
  let packageJson = null;
  try {
    packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
  } catch {
    // The package metadata below will be marked for manual review.
  }
  const license = licenseOf(entry, packageJson);
  const version = entry.version || packageJson?.version || "unspecified";
  const repository = typeof packageJson?.repository === "string"
    ? packageJson.repository
    : packageJson?.repository?.url || "";
  const packageRef = name + "@" + version;
  const licenseFiles = [];
  try {
    for (const fileName of fs.readdirSync(packageDir).filter((file) =>
      /^(LICENSE|LICENCE|COPYING|NOTICE)([-_.].*)?$/i.test(file)
    )) {
      try {
        const text = fs.readFileSync(path.join(packageDir, fileName), "utf8").trim();
        if (!text) continue;
        licenseFiles.push(fileName);
        addText(text, packageRef + " (" + fileName + ")", "package");
      } catch {
        // Binary or unreadable notices require manual review.
      }
    }
  } catch {
    // Report missing package evidence below.
  }

  const ids = licenseIds(license);
  const missingIds = ids.filter((id) => !spdxTexts.has(id));
  const unknownMetadata = license === "UNKNOWN" || license === "UNLICENSED" || license.includes("SEE LICENSE IN");
  const fallbackIds = ids.filter((id) => spdxTexts.has(id));
  const hasLicenseText = licenseFiles.some((fileName) => /^(LICENSE|LICENCE|COPYING)/i.test(fileName));
  if (!hasLicenseText && fallbackIds.length) {
    spdxFallbackPackages.push({ name, version, license, ids: fallbackIds });
  }
  for (const id of fallbackIds) addText(spdxTexts.get(id), packageRef + " (SPDX " + id + " standard text)", "SPDX " + id);
  if (unknownMetadata) unknown.push({ name, version, license, repository });
  if (!hasLicenseText && !fallbackIds.length || missingIds.length) {
    missingText.push({ name, version, license, repository, missingIds });
  }

  const item = {
    name, version, license, repository,
    files: licenseFiles,
    spdxFallback: !hasLicenseText && fallbackIds.length > 0,
  };
  packages.push(item);
  if (!byLicense.has(license)) byLicense.set(license, []);
  byLicense.get(license).push(item);
}

const inventory = [
  "# EPHINTA dependency licence inventory",
  "",
  "Generated: " + new Date().toISOString(),
  "",
  "Lockfile version: " + lock.lockfileVersion,
  "Third-party package entries: " + packages.length,
  "Declared licence expressions: " + byLicense.size,
  "Unknown/unlicensed metadata: " + unknown.length,
  "Packages using official SPDX text fallback: " + spdxFallbackPackages.length,
  "Packages still missing a usable licence text: " + missingText.length,
  "",
  "> This is an automated release inventory, not legal advice. Review custom/dual expressions and any missing copyright/NOTICE details.",
  "",
  "## Summary",
  "",
  "| Declared licence | Package entries |",
  "| --- | ---: |",
];
for (const [license, group] of [...byLicense.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  inventory.push("| " + escapeCell(license) + " | " + group.length + " |");
}
inventory.push("", "## Package inventory", "");
for (const [license, group] of [...byLicense.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  inventory.push("### " + license, "");
  for (const item of group.sort((a, b) => a.name.localeCompare(b.name))) {
    const source = item.files.length ? "package files: " + item.files.join(", ") : item.spdxFallback ? "SPDX standard text fallback; confirm package-specific copyright line" : "NO LICENCE TEXT";
    inventory.push("- `" + item.name + "@" + item.version + "` — " + source + (item.repository ? " — " + item.repository : ""));
  }
  inventory.push("");
}
if (unknown.length) {
  inventory.push("## Unknown/unlicensed packages requiring blocking review", "");
  for (const item of unknown) inventory.push("- `" + item.name + "@" + item.version + "` — " + item.license);
}
if (missingText.length) {
  inventory.push("", "## Packages still missing a usable licence text", "");
  for (const item of missingText) inventory.push("- `" + item.name + "@" + item.version + "` — " + item.license + (item.repository ? " — " + item.repository : ""));
}
inventory.push("", "Internal EPHINTA workspace packages are excluded. Non-npm assets and service agreements are tracked separately in docs/ASSET_RIGHTS_REGISTER.md and docs/THIRD_PARTY_AUDIT.md.", "");

const notices = [
  "# EPHINTA generated third-party licence and NOTICE texts",
  "",
  "Generated from the installed dependency tree and the exact application package-lock.json.",
  "Generated: " + new Date().toISOString(),
  "",
  "Package-specific LICENSE/COPYING/NOTICE files are reproduced verbatim. Where an installed package omitted a text file but declared a known SPDX identifier, the official SPDX standard licence text is included as a fallback; this does not replace package-specific copyright notices.",
  "",
  "Third-party package entries: " + packages.length,
  "Distinct verbatim/fallback texts: " + uniqueTexts.size,
  "Packages using SPDX fallback: " + spdxFallbackPackages.length,
  "Packages requiring manual follow-up: " + missingText.length,
  "",
  "## Verbatim package licence and NOTICE texts",
  "",
];
let noticeIndex = 0;
for (const record of uniqueTexts.values()) {
  noticeIndex += 1;
  notices.push("### Notice " + noticeIndex, "");
  notices.push("Source: " + record.source, "");
  notices.push("Packages: " + record.packages.join("; "), "");
  notices.push("```text");
  notices.push(record.text);
  notices.push("```", "");
}
if (spdxFallbackPackages.length) {
  notices.push("## Packages using SPDX standard text fallback", "");
  for (const item of spdxFallbackPackages) notices.push("- `" + item.name + "@" + item.version + "` — " + item.license + "; confirm package-specific copyright and any extra NOTICE files.");
  notices.push("");
}
if (missingText.length || unknown.length) {
  notices.push("## Manual follow-up required before distribution", "");
  for (const item of [...unknown, ...missingText]) notices.push("- `" + item.name + "@" + item.version + "` — " + item.license + (item.repository ? " — " + item.repository : ""));
  notices.push("");
}
notices.push("## SPDX source");
notices.push("Standard licence texts were retrieved from the official SPDX License List data repository, pinned to commit 31846481de7ea17d92f2f46fad76abe58b2e9bb0. The SPDX License List data is released under CC0-1.0: https://github.com/spdx/license-list-data.");
notices.push("");
notices.push("## Additional non-npm notices");
notices.push("- Gradle wrapper scripts in apps/mobile/android retain the upstream Apache-2.0 notice headers. Preserve those headers and the corresponding Apache-2.0 licence text in native release materials.");
notices.push("- Provider and platform service terms (OPay, Bytid, Capgo, SMTP transport, and object storage) are not software package licences. Review the applicable account contracts and data-processing terms separately.");
notices.push("");

fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(inventoryPath, inventory.join("\n"), "utf8");
fs.writeFileSync(noticesPath, notices.join("\n"), "utf8");
console.log(JSON.stringify({
  thirdPartyPackages: packages.length,
  licenseTypes: byLicense.size,
  unknown: unknown.length,
  missingLicenseText: missingText.length,
  spdxFallbackPackages: spdxFallbackPackages.length,
  uniqueNoticeTexts: uniqueTexts.size,
  inventory: inventoryPath,
  notices: noticesPath,
}, null, 2));
if (unknown.length || missingText.length) process.exitCode = 1;
