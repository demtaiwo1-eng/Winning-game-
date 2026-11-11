#!/usr/bin/env node
/**
 * Safely switch EPHINTA's Render API between staging demo/sandbox and live.
 *
 * Required:
 *   RENDER_API_KEY
 *   EPHINTA_RENDER_API_SERVICE_ID
 *   EPHINTA_RENDER_TARGET=staging|production
 *
 * Live mode additionally requires explicit cutover attestations and a
 * supported live provider. Secret values are read only for prefix checks and
 * are never printed or written to the repository.
 */
const mode = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.EPHINTA_RENDER_API_SERVICE_ID;
const target = process.env.EPHINTA_RENDER_TARGET;

function fail(message) {
  console.error(`[payment-mode] ${message}`);
  process.exit(2);
}
function requireAttestation(name) {
  if (process.env[name] !== "YES") fail(`Missing explicit approval: ${name}=YES`);
}
if (!["demo", "live"].includes(mode)) {
  fail("Usage: npm run payments:mode -- <demo|live> [--dry-run]");
}
if (!["staging", "production"].includes(target)) {
  fail("Set EPHINTA_RENDER_TARGET=staging or production.");
}
if (mode === "demo" && target !== "staging") {
  fail("Demo mode can only be applied to the staging API. Production is protected.");
}
if (mode === "live" && target !== "production") {
  fail("Live mode can only be applied to the production API.");
}
if (!serviceId) fail("Set EPHINTA_RENDER_API_SERVICE_ID to the intended Render API service.");
if (!apiKey && !dryRun) fail("Set RENDER_API_KEY in your shell/CI secret store; never commit it.");

const updates = mode === "demo"
  ? { PAYMENT_MODE: "test", ALLOW_PRODUCTION_TEST_MODE: "true", COMMISSION_BPS: "100" }
  : { PAYMENT_MODE: "live", ALLOW_PRODUCTION_TEST_MODE: "false", COMMISSION_BPS: "100" };

const supportedLiveProviders = new Set(["paystack", "flutterwave"]);
if (mode === "live") {
  requireAttestation("EPHINTA_LIVE_CUTOVER_APPROVED");
  requireAttestation("EPHINTA_LIVE_PROVIDER_APPROVED");
  requireAttestation("EPHINTA_LIVE_CREDENTIALS_VERIFIED");
  requireAttestation("EPHINTA_LIVE_WEBHOOKS_VERIFIED");
  requireAttestation("EPHINTA_LIVE_RECONCILIATION_VERIFIED");
  requireAttestation("EPHINTA_LIVE_IDEMPOTENCY_VERIFIED");
  const provider = (process.env.EPHINTA_LIVE_PROVIDER || "").toLowerCase();
  if (!supportedLiveProviders.has(provider)) {
    fail("Live provider must be paystack or flutterwave. OPay is sandbox-only; Cleva/Eversend adapters are not implemented; Stripe checkout is disabled.");
  }
  if (dryRun) {
    console.log(`[payment-mode] dry run: would verify ${provider} live credentials and set ${JSON.stringify(updates)} on ${target} service ${serviceId}`);
    process.exit(0);
  }
}

if (dryRun) {
  console.log(`[payment-mode] dry run: would set ${JSON.stringify(updates)} on ${target} service ${serviceId} and trigger a deploy.`);
  process.exit(0);
}

const baseUrl = "https://api.render.com/v1";
const headers = {
  Authorization: `Bearer ${apiKey}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};
async function renderRequest(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await response.text();
  if (!response.ok) fail(`Render API returned HTTP ${response.status} for ${path}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : null;
}

if (mode === "live") {
  const provider = process.env.EPHINTA_LIVE_PROVIDER.toLowerCase();
  const result = await renderRequest(`/services/${serviceId}/env-vars?limit=100`);
  const rows = Array.isArray(result) ? result : [];
  const values = new Map(rows.map((row) => [row.envVar?.key, row.envVar?.value]));
  const secret = values.get(provider === "paystack" ? "PAYSTACK_SECRET_KEY" : "FLUTTERWAVE_SECRET_KEY");
  const isLiveKey = provider === "paystack"
    ? typeof secret === "string" && secret.startsWith("sk_live_")
    : typeof secret === "string" && secret.startsWith("FLWSECK-") && !secret.startsWith("FLWSECK_TEST");
  if (!isLiveKey) fail(`The Render service does not expose a verified live ${provider} key. Configure it in Render secrets first; the value will not be printed.`);
}

for (const [key, value] of Object.entries(updates)) {
  await renderRequest(`/services/${serviceId}/env-vars/${key}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}
const deploy = await renderRequest(`/services/${serviceId}/deploys`, {
  method: "POST",
  body: JSON.stringify({}),
});
console.log(`[payment-mode] ${mode.toUpperCase()} configuration accepted for ${target}. Deploy: ${deploy?.id || "accepted"} (status: ${deploy?.status || "pending"}).`);
