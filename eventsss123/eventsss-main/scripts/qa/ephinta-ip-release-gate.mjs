#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_ROOT = path.resolve(APP_ROOT, "../..");
const manifestPath = path.join(APP_ROOT, "docs", "assets", "asset-rights.json");
const audioExtensions = new Set([".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac"]);
const failures = [];
const checks = [];

function check(ok, passMessage, failMessage) {
  if (ok) checks.push(passMessage);
  else failures.push(failMessage);
}
function findAudioFiles(directory, relative = "") {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "build", "artifacts", ".secrets"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) found.push(...findAudioFiles(absolute, rel));
    else if (audioExtensions.has(path.extname(entry.name).toLowerCase())) found.push(rel);
  }
  return found;
}

let manifest = null;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
  failures.push("Asset rights manifest is missing or invalid: " + String(error));
}
check(Boolean(manifest && manifest.schemaVersion === 1 && Array.isArray(manifest.assets)),
  "Asset rights manifest is valid.",
  "Asset rights manifest must contain schemaVersion=1 and an assets array.");

const audioFiles = [
  ...findAudioFiles(REPO_ROOT, ""),
].filter((name) => !name.startsWith("node_modules/"));
const rightsRecords = new Map((manifest?.assets || []).map((item) => [item.path, item]));
for (const assetPath of audioFiles) {
  const record = rightsRecords.get(assetPath);
  const approved = record
    && typeof record.creatorOrRightsHolder === "string" && record.creatorOrRightsHolder.trim()
    && typeof record.licence === "string" && record.licence.trim()
    && record.commercialDistribution === true
    && typeof record.evidenceRef === "string" && record.evidenceRef.trim();
  check(Boolean(approved), "", "Audio asset lacks an approved commercial rights record: " + assetPath);
}
check(audioFiles.length === 0 || audioFiles.every((assetPath) => {
  const record = rightsRecords.get(assetPath);
  return record?.commercialDistribution === true && Boolean(record?.creatorOrRightsHolder && record?.licence && record?.evidenceRef);
}), "Every bundled audio asset has an approved rights record.", "One or more bundled audio files are not cleared for commercial distribution.");
check(fs.existsSync(path.join(APP_ROOT, "THIRD_PARTY_NOTICES.md")),
  "Third-party notices index exists.",
  "THIRD_PARTY_NOTICES.md is missing.");

const trackedFiles = spawnSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8" });
const committedDependencyPaths = trackedFiles.status === 0
  ? trackedFiles.stdout.split(/\r?\n/).filter((file) => file.split("/").includes("node_modules"))
  : ["git ls-files failed: " + (trackedFiles.stderr || "unknown error")];
check(trackedFiles.status === 0 && committedDependencyPaths.length === 0,
  "No node_modules directories are committed in the repository.",
  "Tracked dependency install files must not be committed: " + committedDependencyPaths.slice(0, 20).join(", "));

const trackedPaths = trackedFiles.status === 0 ? trackedFiles.stdout.split(/\r?\n/) : [];
const remotionPaths = trackedPaths.filter((file) => /(^|\/)remotion([-/]|\/|$)/i.test(file) || file.includes(".agents/skills/"));
check(trackedFiles.status === 0 && remotionPaths.length === 0,
  "Unused third-party Remotion agent bundle is absent.",
  "Third-party Remotion/agent-skill files have been reintroduced: " + remotionPaths.slice(0, 20).join(", "));

check(!fs.existsSync(path.join(APP_ROOT, "contracts", "EventEscrowVault.sol")),
  "Unused MIT-labelled escrow prototype is absent from the product tree.",
  "The retired MIT-labelled escrow prototype has reappeared; review its licence and runtime use before release.");

const musicConfig = fs.readFileSync(path.join(APP_ROOT, "apps", "web", "src", "lib", "music", "ephinta-config.ts"), "utf8");
check(musicConfig.includes("VITE_EPHINTA_LICENSED_AUDIO_URL") && musicConfig.includes("safeLicensedAudioUrl"),
  "Music requires an explicit HTTPS-configured source.",
  "Music source configuration no longer enforces an explicit safe licensed URL.");
check(!/Wale Waves|\.mp3|\.m4a|\.wav/i.test(musicConfig),
  "No artist-specific or hard-coded audio asset is selected by default.",
  "A hard-coded third-party artist or audio asset is present in the default music configuration.");

for (const message of checks) console.log("✓ " + message);
for (const message of failures) console.error("✗ " + message);
console.log(JSON.stringify({ status: failures.length ? "failed" : "passed", checks: checks.length, failures: failures.length, audioFiles: audioFiles.length }, null, 2));
if (failures.length) process.exitCode = 1;
