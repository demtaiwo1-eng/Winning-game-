import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const repoRoot = path.resolve(appRoot, "../..");
const audioDir = path.join(appRoot, "public", "audio");
const rootAudioNames = fs.readdirSync(repoRoot).filter((name) => /\.(mp3|m4a|wav|ogg)$/i.test(name));
const appAudioFiles = fs.existsSync(audioDir)
  ? fs.readdirSync(audioDir).filter((name) => /\.(mp3|m4a|wav|ogg)$/i.test(name))
  : [];

function fail(message) {
  console.error("✗ " + message);
  process.exitCode = 1;
}
function pass(message) {
  console.log("✓ " + message);
}

console.log("\nEPHINTA licensed-audio distribution gate\n");
if (rootAudioNames.length) fail("Unregistered audio files exist at the application root: " + rootAudioNames.join(", "));
else pass("No unregistered audio files are shipped from the application root.");
if (appAudioFiles.length) fail("Audio assets in public/audio require a rights record before distribution: " + appAudioFiles.join(", "));
else pass("No unlicensed bundled audio is exposed in the public web build.");

const config = fs.readFileSync(path.join(appRoot, "src/lib/music/ephinta-config.ts"), "utf8");
const component = fs.readFileSync(path.join(appRoot, "src/components/AudioExperience.tsx"), "utf8");
if (!config.includes("VITE_EPHINTA_LICENSED_AUDIO_URL") || !config.includes("safeLicensedAudioUrl")) {
  fail("Audio configuration must require an explicit, safe, owner-configured licensed URL.");
} else pass("Audio source requires explicit owner configuration and HTTPS validation.");
if (!component.includes("if (!source) return null") || !component.includes("rights-cleared")) {
  fail("Audio UI must stay hidden when no rights-cleared source is configured.");
} else pass("Audio UI remains disabled until a rights-cleared source is configured.");

const skillsDir = path.join(repoRoot, ".agents", "skills");
if (fs.existsSync(skillsDir)) {
  const names = fs.readdirSync(skillsDir).filter((name) => /remotion/i.test(name));
  if (names.length) fail("Unused third-party Remotion skill content remains in the product repository: " + names.join(", "));
  else pass("No unused Remotion skill bundle remains in the product repository.");
} else pass("No third-party Remotion skill bundle remains in the product repository.");

const configPath = path.join(repoRoot, "apps", "mobile", "capacitor.config.ts");
if (!fs.existsSync(configPath)) {
  fail("Capacitor configuration not found at apps/mobile/capacitor.config.ts.");
} else {
  const capacitorConfig = fs.readFileSync(configPath, "utf8");
  if (!capacitorConfig.includes('appName: "EPHINTA"')) fail("Capacitor app identity is not EPHINTA.");
  else pass("Capacitor Android/iOS shell is configured for EPHINTA.");
}

if (process.exitCode) {
  console.error("\nLicensed-audio distribution checks failed.");
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
  console.log("\n↷ Browser journey tests are covered by the browser-regression workflow.");
} else {
  run("npm", ["run", "test:e2e", "--", "e2e/audio-experience.spec.ts"], appRoot, "Audio rights-gate browser tests");
}
console.log("\n✓ Licensed-audio distribution checks passed.");
console.log("NOTE: Playback remains off until the owner records rights evidence and configures a licensed source URL.");
