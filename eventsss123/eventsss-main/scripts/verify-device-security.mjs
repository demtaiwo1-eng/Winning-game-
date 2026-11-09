import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const gate = read("apps/web/src/components/DeviceSecurityGate.tsx");
const app = read("apps/web/src/EnterpriseApp.tsx");
const webPackage = JSON.parse(read("apps/web/package.json"));
const globalCss = read("apps/web/src/styles/ephinta-global.css");
const lockStyles = read("apps/web/src/styles/ephinta-portal-marketplace-polish.css");
const mainEntry = read("apps/web/src/main.tsx");

const checks = [
  ["the real EnterpriseApp entrypoint imports the device security gate", /import DeviceSecurityGate from ['"]\.\/components\/DeviceSecurityGate['"]/.test(app)],
  ["the authenticated portal root is wrapped by the gate", /<DeviceSecurityGate userId=\{session\.id\} onSignOut=\{signOut\}>\{content\}<\/DeviceSecurityGate>/.test(app)],
  ["first-time onboarding is protected by the same gate", /if \(session && showOnboard\)[\s\S]*?<DeviceSecurityGate userId=\{session\.id\} onSignOut=\{signOut\}>[\s\S]*?<\/DeviceSecurityGate>/.test(app)],
  ["every login path preserves the stable user ID", (app.match(/id: user\.id/g) || []).length >= 2],
  ["restored sessions without a user ID are not accepted", /if \(user\?\.id && user\?\.name && user\?\.email/.test(app)],
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
  ["device lock visual styling is defined in the shared global stylesheet", globalCss.includes('ephinta-portal-marketplace-polish.css') && lockStyles.includes(".ess-device-lock-card") && lockStyles.includes(".ess-device-lock-input")],
  ["device lock text has a high-contrast foreground on its dark card", /background:\s*#171d32/.test(lockStyles) && /color:\s*#f8fafc/.test(lockStyles) && /color:\s*#cbd5e1/.test(lockStyles)],
  ["the active app entry imports one global CSS hub", (mainEntry.match(/import ['"][^'"]+\.css['"]/g) || []).length === 1 && mainEntry.includes("./styles/ephinta-global.css")],
  ["authenticated portal components do not import their own CSS", !/^import ['"].+\.css['"]/m.test(app)],
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
