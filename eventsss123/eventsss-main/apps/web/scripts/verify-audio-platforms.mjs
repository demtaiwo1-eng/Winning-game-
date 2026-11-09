import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const repoRoot = path.resolve(appRoot, "../..");
const requiredTracks = [
  "Here we are-1 -Wale Waves_ESS_Wedding.mp3",
  "Here we are-2 -Wale Waves_ESS_Wedding.mp3",
  "Welcome, Little One-1-Wale Waves_ESS_Naming.mp3",
  "Welcome, Little One-2-Wale Waves_ESS_Naming.mp3",
  "You Will Live in Our Hearts-1-Wale Waves_ESS_Burials.mp3",
  "You Will Live in Our Hearts-2-Wale Waves_ESS_Burials.mp3",
];

function fail(message) {
  console.error("✗ " + message);
  process.exitCode = 1;
}
function pass(message) {
  console.log("✓ " + message);
}

console.log("\nEPHINTA cross-platform audio readiness check\n");
const audioDir = path.join(appRoot, "public", "audio");
for (const track of requiredTracks) {
  const file = path.join(audioDir, track);
  if (!fs.existsSync(file)) fail("Missing audio asset: public/audio/" + track);
  else if (fs.statSync(file).size < 10_000) fail("Audio asset is unexpectedly small: " + track);
  else pass("Audio asset present: " + track);
}

const component = fs.readFileSync(path.join(appRoot, "src/components/AudioExperience.tsx"), "utf8");
for (const feature of ["Play music", "Pause music", "Previous track", "Next track", "Music volume", "Seek music", "Music category"]) {
  if (!component.includes(feature)) fail("Audio UI is missing feature: " + feature);
  else pass("Audio control present: " + feature);
}

// Capacitor lives in the mobile workspace, not in a repository-root /mobile folder.
const configPath = path.join(repoRoot, "apps", "mobile", "capacitor.config.ts");
if (!fs.existsSync(configPath)) {
  fail("Capacitor configuration not found at apps/mobile/capacitor.config.ts.");
} else {
  const config = fs.readFileSync(configPath, "utf8");
  if (!config.includes('appName: "EPHINTA"')) fail("Capacitor app identity is not EPHINTA.");
  else pass("Capacitor Android/iOS shell is configured for EPHINTA.");
}

if (process.exitCode) {
  console.error("\nAudio readiness checks failed. Fix the listed issues before building.");
  process.exit(1);
}

function run(command, args, cwd, label) {
  console.log("\n▶ " + label);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    fail(label + " failed (exit " + result.status + ").");
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "build"], appRoot, "Production web build");

if (process.env.EPHINTA_AUDIO_SKIP_BROWSER_TESTS === "true") {
  console.log("\n↷ Audio browser journey tests are covered by the Linux browser-regression workflow; skipping the duplicate server-backed run on this platform.");
} else {
  run("npm", ["run", "test:e2e", "--", "e2e/audio-experience.spec.ts"], appRoot, "Audio browser journey tests");
}

console.log("\n✓ Web/PWA audio readiness checks passed.");
console.log("NOTE: A real Android/iOS device playback check is still required. Browser automation mocks audio output and cannot prove that a physical speaker produces sound.");
