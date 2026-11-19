#!/usr/bin/env node
/**
 * EPHINTA authentication completion gate.
 *
 * Runs the repository's real API/web validation and reports security-critical
 * capabilities that must exist before authentication can be signed off.
 * It never changes production data, creates credentials, or prints secrets.
 *
 * Usage: node scripts/qa/complete-authentication.mjs
 * CI supplies DATABASE_URL and JWT_SECRET; SMTP values are checked by name only.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const appRoot = resolve(root, "apps/api");
const reportDir = resolve(root, "artifacts/authentication");
const checks = [];
const commands = [];
const add = (name, ok, detail) => checks.push({ name, status: ok ? "PASS" : "FAIL", detail });
const read = (p) => {
  const full = resolve(root, p);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
};
const authService = read("apps/api/src/modules/auth/auth.service.ts");
const authRoutes = read("apps/api/src/modules/auth/auth.routes.ts");
const authSchemas = read("apps/api/src/modules/auth/auth.schemas.ts");
const prismaSchema = read("apps/api/prisma/schema.prisma");
const mailer = read("apps/api/src/lib/mail.ts");
const webApp = read("apps/web/src/EnterpriseApp.tsx");
const webShell = read("apps/web/src/App.tsx");
const packageJson = JSON.parse(read("package.json") || "{}");

add("Registration endpoint and server implementation",
  /post\(["']\/register/.test(authRoutes) && /export async function register/.test(authService),
  "Registration route and service must both exist.");
add("Credential verification and generic invalid-credentials response",
  /bcrypt\.compare/.test(authService) && /INVALID_CREDENTIALS/.test(authService),
  "Passwords must be verified against stored hashes without revealing whether an email exists.");
add("Duplicate account handling",
  /P2002/.test(authService) && /ALREADY_EXISTS/.test(authService),
  "Unique database conflicts must be translated to a safe client error.");
add("Account status enforced at login and refresh",
  /found\.status/.test(authService) && /userWithStatus\.status/.test(authService) && /status !== "ACTIVE"/.test(authService),
  "Suspended/pending accounts must not receive refreshed sessions.");
add("Hashed, expiring, single-use password reset tokens",
  /passwordResetToken/.test(authService) && /usedAt/.test(authService) && /expiresAt/.test(authService),
  "Reset tokens must be hashed, expire, and be single-use.");
add("Password reset revokes existing refresh tokens",
  /refreshToken\.updateMany/.test(authService) && /PASSWORD_RESET/.test(authService),
  "A password change must invalidate active sessions.");
add("Refresh rotation, reuse detection and logout",
  /REFRESH_TOKEN_REUSE/.test(authService) && /SESSION_REFRESHED/.test(authService) && /export async function logout/.test(authService),
  "Refresh-token rotation and revocation must be implemented.");
add("Email verification persistence and token model",
  /emailVerifiedAt\s+DateTime\?/.test(prismaSchema) && /EmailVerificationToken/.test(prismaSchema),
  "User emailVerifiedAt exists; a dedicated expiring verification-token model is also required.");
add("Email verification API",
  /verify-email/.test(authRoutes) && /resend-verification/.test(authRoutes),
  "Verification and resend endpoints must be available.");
add("Email verification service and delivery",
  /sendVerificationEmail/.test(mailer) && /verifyEmail/.test(authService) && /resendVerification/.test(authService),
  "Verification email delivery, token hashing, expiry and one-time consumption must be implemented.");
add("Rate limiting on authentication endpoints",
  /rateLimit/.test(authRoutes),
  "Authentication routes must be protected against automated guessing.");
add("Web session restoration uses refresh endpoint",
  /auth\/refresh/.test(webShell) && /ess_refresh_token/.test(webShell),
  "Browser session restoration must rotate refresh tokens and clear invalid sessions.");
add("Frontend incorrect-password feedback",
  /INVALID_CREDENTIALS/.test(webApp) && /do not match/.test(webApp),
  "Incorrect-password errors must be actionable and must not expose account existence.");
add("Password reset screen handles network errors",
  /function ResetPasswordPage/.test(webApp) && /Unable to reset password/.test(webApp),
  "Reset form must handle API failures without crashing.");
add("Required API and web test scripts",
  Boolean(packageJson.scripts?.check) && Boolean(packageJson.scripts?.build),
  "Root package must expose check/build commands.");

const required = ["DATABASE_URL", "JWT_SECRET", "APP_BASE_URL"];
for (const key of required) {
  const value = process.env[key];
  add(`CI environment: ${key}`, Boolean(value && (key !== "JWT_SECRET" || value.length >= 32)),
    value ? "Present (value hidden)." : "Missing; configure as a protected GitHub Actions/Render secret.");
}
const brevoReady = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
const smtpReady = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"].every((k) => Boolean(process.env[k]));
const emailReady = brevoReady || smtpReady;
add("Transactional email deployment configuration", emailReady || process.env.NODE_ENV !== "production",
  emailReady ? "Brevo API or SMTP variables are present (values hidden)." : "Set BREVO_API_KEY and BREVO_SENDER_EMAIL in Render, or configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD and SMTP_FROM.");

function run(label, command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env,
    maxBuffer: 12 * 1024 * 1024,
  });
  const ok = result.status === 0;
  commands.push({
    name: label, status: ok ? "PASS" : "FAIL",
    exitCode: result.status,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").slice(-12000),
  });
  console.log(`\n[${ok ? "PASS" : "FAIL"}] ${label}`);
  if (!ok) console.log((result.stderr || result.stdout || "Command failed without output").slice(-5000));
  return ok;
}

const installOk = run("Install locked dependencies", "npm", ["ci"]);
if (installOk) {
  run("Prisma schema validation", "npx", ["prisma", "validate", "--schema", "apps/api/prisma/schema.prisma"]);
  run("Prisma client generation", "npm", ["run", "prisma:generate", "-w", "apps/api"]);
  run("API typecheck", "npm", ["run", "typecheck", "-w", "apps/api"]);
  run("API automated tests", "npm", ["run", "test", "-w", "apps/api"]);
  run("Apply database migrations", "npm", ["run", "db:deploy", "-w", "apps/api"]);
  run("Database-backed API tests", "npm", ["run", "test:db", "-w", "apps/api"]);
  run("Web component tests", "npm", ["run", "test", "-w", "apps/web"]);
  run("Web production build", "npm", ["run", "build", "-w", "apps/web"]);
} else {
  for (const name of ["Prisma schema validation", "Prisma client generation", "API typecheck", "API automated tests", "Apply database migrations", "Database-backed API tests", "Web component tests", "Web production build"]) {
    commands.push({ name, status: "SKIP", output: "Dependency installation failed." });
  }
}

const failedChecks = checks.filter((c) => c.status === "FAIL");
const failedCommands = commands.filter((c) => c.status === "FAIL");
const report = {
  generatedAt: new Date().toISOString(),
  repository: "demtaiwo1-eng/Winning-game-",
  purpose: "Authentication completion gate; not a substitute for live email, Android-device or production acceptance tests.",
  summary: { checksPassed: checks.length - failedChecks.length, checksFailed: failedChecks.length,
    commandsPassed: commands.filter((c) => c.status === "PASS").length,
    commandsFailed: failedCommands.length },
  checks, commands,
  productionSignoff: failedChecks.length === 0 && failedCommands.length === 0 && emailReady
    ? "AUTOMATED GATE PASSED; live email delivery, Android device journeys, and deployment secrets still require independent evidence."
    : "NOT READY: resolve failed capability/configuration checks and command failures; do not treat skipped live acceptance as passed.",
};
mkdirSync(reportDir, { recursive: true });
writeFileSync(resolve(reportDir, "authentication-readiness.json"), JSON.stringify(report, null, 2) + "\n");
const md = [
  "# EPHINTA Authentication Readiness",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  `**Result:** ${report.productionSignoff}`,
  "",
  "## Capability and configuration checks",
  "",
  ...checks.map((c) => `- [${c.status}] **${c.name}** — ${c.detail}`),
  "",
  "## Executed commands",
  "",
  ...commands.map((c) => `- [${c.status}] **${c.name}**${c.exitCode === undefined ? "" : ` (exit ${c.exitCode})`}`),
  "",
  "Detailed, redacted command output is in authentication-readiness.json.",
  "",
  "## Manual release gates",
  "",
  "- Verify email delivery and verification/resend/expiry using a real inbox.",
  "- Exercise registration, wrong password, reset, logout and session refresh against a disposable PostgreSQL database.",
  "- Verify every role and cross-account access restrictions.",
  "- Test web reload and Android restart, expiry, revocation and offline behaviour on physical devices.",
  "- Confirm production Render secrets, HTTPS, CORS and monitoring without exposing secret values.",
  "",
];
writeFileSync(resolve(reportDir, "README.md"), md.join("\n"));
console.log(`\nReport written to ${resolve(reportDir, "README.md")}`);
console.log(`Checks: ${report.summary.checksPassed} passed, ${report.summary.checksFailed} failed; commands: ${report.summary.commandsPassed} passed, ${report.summary.commandsFailed} failed.`);
if (failedChecks.length || failedCommands.length) process.exitCode = 1;
