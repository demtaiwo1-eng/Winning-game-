import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const gate = read("apps/web/src/components/DeviceSecurityGate.tsx");
const app = read("apps/web/src/App.tsx");
const webPackage = JSON.parse(read("apps/web/package.json"));

const checks = [
  ["device security gate is imported by the application", /import DeviceSecurityGate from ['"]\.\/components\/DeviceSecurityGate['"]/.test(app)],
  ["every authenticated app tree is wrapped by the gate", /<DeviceSecurityGate userId=\{auth\.user\.id\} onSignOut=\{handleLogout\}>[\s\S]*?<\/DeviceSecurityGate>/.test(app)],
  ["the gate covers the authenticated audio experience", /<DeviceSecurityGate[\s\S]*?<AudioExperience showPrompt=\{false\} autoPlay \/>[\s\S]*?<\/DeviceSecurityGate>/.test(app)],
  ["idle lock is exactly five minutes", /IDLE_LIMIT_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/.test(gate)],
  ["PIN is six numeric digits and must be confirmed", /\\d\{6\}/.test(gate) && /pin !== confirmPin/.test(gate)],
  ["PIN hash uses PBKDF2 SHA-256 with a strong iteration count", /PBKDF2_ITERATIONS\s*=\s*310_000/.test(gate) && /hash:\s*"SHA-256"/.test(gate)],
  ["PIN salt is generated with the Web Crypto random generator", /crypto\.getRandomValues\(new Uint8Array\(16\)\)/.test(gate)],
  ["failed PIN attempts persist across app restarts", /ephinta:device-pin-attempts:v1/.test(gate) && /localStorage\.setItem\(attemptsKey, String\(attempts\.current\)\)/.test(gate)],
  ["five failed PIN attempts force sign-out", /attempts\.current\s*>=\s*5/.test(gate) && /localStorage\.removeItem\(storageKey\)/.test(gate) && /onSignOut\(\)/.test(gate)],
  ["native biometric support is checked only on native platforms", /Capacitor\.isNativePlatform\(\)/.test(gate) && /BiometricAuth\.checkBiometry\(\)/.test(gate)],
  ["biometric unlock supports the OS device credential fallback", /BiometricAuth\.authenticate\([\s\S]*?allowDeviceCredential:\s*true/.test(gate)],
  ["background and inactivity are checked when the app becomes visible", /visibilitychange/.test(gate) && /Date\.now\(\)\s*-\s*lastActivity\.current\s*>=\s*IDLE_LIMIT_MS/.test(gate)],
  ["user activity resets the idle timer", /pointerdown/.test(gate) && /keydown/.test(gate) && /touchstart/.test(gate) && /setTimeout\(\(\)\s*=>/.test(gate)],
  ["authenticated children are hidden while the device is locked", /display:\s*locked\s*\?\s*"none"\s*:\s*"contents"/.test(gate)],
  ["native biometric dependency is declared", Boolean(webPackage.dependencies?.["@aparajita/capacitor-biometric-auth"])],
  ["raw PIN is not written directly to local storage", !/localStorage\.setItem\(storageKey,\s*pin\)/.test(gate)],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  if (!passed) failed += 1;
}
assert.equal(failed, 0, `Device security verification failed: ${failed} check(s).`);

if (process.argv.includes("--full")) {
  for (const args of [["run", "test", "-w", "apps/web"], ["run", "build", "-w", "apps/web"]]) {
    console.log(`\n> npm ${args.join(" ")}`);
    const result = spawnSync("npm", args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
console.log(`\nEPHINTA device security verification passed (${checks.length} checks).`);
