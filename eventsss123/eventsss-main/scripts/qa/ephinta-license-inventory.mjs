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

const entries = Object.entries(lock.packages || {}).filter(([lockPath]) =>
  lockPath.includes("node_modules/") && !lockPath.includes("node_modules/@ess/")
);
const packages = [];
const byLicense = new Map();
const uniqueTexts = new Map();
const unknown = [];
const missingText = [];

for (const [lockPath, entry] of entries) {
  const name = packageName(lockPath);
  const packageDir = path.resolve(ROOT, lockPath);
  let packageJson = null;
  try {
    packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
  } catch {
    // Missing install contents are reported as missing evidence below.
  }
  const license = licenseOf(entry, packageJson);
  const version = entry.version || packageJson?.version || "unspecified";
  const repo = typeof packageJson?.repository === "string"
    ? packageJson.repository
    : packageJson?.repository?.url || "";
  const fileNames = [];
  let licenseFiles = [];
  try {
    licenseFiles = fs.readdirSync(packageDir).filter((file) =>
      /^(LICENSE|LICENCE|COPYING|NOTICE)([-_.].*)?$/i.test(file)
    );
  } catch {
    // Report package with missing installed licence files.
  }
  for (const fileName of licenseFiles) {
    try {
      const text = fs.readFileSync(path.join(packageDir, fileName), "utf8").trim();
      if (!text) continue;
      fileNames.push(fileName);
      const digest = createHash("sha256").update(text).digest("hex");
      if (!uniqueTexts.has(digest)) uniqueTexts.set(digest, { digest, text, packages: [] });
      uniqueTexts.get(digest).packages.push(name + "@" + version + " (" + fileName + ")");
    } catch {
      // Binary or unreadable notice files require manual review.
    }
  }
  const item = { name, version, license, repo, files: fileNames };
  packages.push(item);
  if (!byLicense.has(license)) byLicense.set(license, []);
  byLicense.get(license).push(item);
  if (license === "UNKNOWN" || license === "UNLICENSED") unknown.push(item);
  if (!fileNames.length) missingText.push(item);
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
  "Packages without a bundled licence/NOTICE file: " + missingText.length,
  "",
  "> Metadata and bundled files are evidence for review, not a legal opinion. Check dual/custom licence expressions and obligations before each release.",
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
    inventory.push("- `" + item.name + "@" + item.version + "` — bundled files: " + (item.files.join(", ") || "NONE") + (item.repo ? " — " + item.repo : ""));
  }
  inventory.push("");
}
if (unknown.length) {
  inventory.push("## Unknown/unlicensed packages requiring blocking review", "");
  for (const item of unknown) inventory.push("- `" + item.name + "@" + item.version + "`");
}
if (missingText.length) {
  inventory.push("", "## Packages without a bundled licence/NOTICE file", "");
  for (const item of missingText) inventory.push("- `" + item.name + "@" + item.version + "` — declared: " + item.license + (item.repo ? " — " + item.repo : ""));
}
inventory.push("", "Internal EPHINTA workspace packages are excluded. Non-npm assets and service agreements are tracked separately in docs/ASSET_RIGHTS_REGISTER.md and docs/THIRD_PARTY_AUDIT.md.", "");

const notices = [
  "# EPHINTA generated third-party licence and NOTICE texts",
  "",
  "Generated from the installed dependency tree and the exact application package-lock.json.",
  "Generated: " + new Date().toISOString(),
  "",
  "This file reproduces licence/NOTICE files as found in installed packages. Do not edit upstream licence text. The associated package/version inventory is in ephinta-dependency-license-inventory.md.",
  "",
  "Third-party package entries: " + packages.length,
  "Distinct verbatim licence/NOTICE files: " + uniqueTexts.size,
  "Packages with missing licence/NOTICE files: " + missingText.length,
  "",
  "## Verbatim package licence and NOTICE files",
  "",
];
let noticeIndex = 0;
for (const record of uniqueTexts.values()) {
  noticeIndex += 1;
  notices.push("### Notice " + noticeIndex, "");
  notices.push("Packages: " + record.packages.join("; "), "");
  notices.push("```text");
  notices.push(record.text);
  notices.push("```", "");
}
if (missingText.length) {
  notices.push("## Manual follow-up required", "");
  notices.push("The following packages did not include a readable LICENSE/COPYING/NOTICE file in the installed package directory. Obtain the exact upstream licence text or a documented legal disposition before redistribution:", "");
  for (const item of missingText) notices.push("- `" + item.name + "@" + item.version + "` — declared: " + item.license + (item.repo ? " — " + item.repo : ""));
  notices.push("");
}
notices.push("## Additional non-npm notices", "");
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
  uniqueNoticeTexts: uniqueTexts.size,
  inventory: inventoryPath,
  notices: noticesPath,
}, null, 2));
if (unknown.length || missingText.length) process.exitCode = 1;
