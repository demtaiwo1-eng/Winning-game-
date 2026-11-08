#!/usr/bin/env node
/**
 * Deployment smoke checks for EPHINTA web/API connectivity.
 *
 * Usage:
 *   EPHINTA_WEB_URL=https://your-web-host.example \
 *   EPHINTA_API_URL=https://ephinta-wss.onrender.com \
 *   node scripts/ephinta-connection-check.mjs
 */
const webUrl = (process.env.EPHINTA_WEB_URL || "").replace(/\/+$/, "");
const apiUrl = (process.env.EPHINTA_API_URL || "https://ephinta-wss.onrender.com").replace(/\/+$/, "");
const timeoutMs = Number(process.env.EPHINTA_CHECK_TIMEOUT_MS || 60000);
const results = [];

if (!webUrl) {
  console.error("Set EPHINTA_WEB_URL to the deployed web application's origin.");
  process.exit(2);
}
for (const [name, url, method] of [
  ["web homepage", webUrl + "/", "GET"],
  ["API health", apiUrl + "/health", "GET"],
  ["API database readiness", apiUrl + "/ready", "GET"],
  ["EPHINTA logo asset", webUrl + "/brand/ephinta_logo2.png", "HEAD"],
  ["wedding audio asset", webUrl + "/audio/Here%20we%20are-1%20-Wale%20Waves_ESS_Wedding.mp3", "HEAD"],
]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, redirect: "follow", signal: controller.signal });
    const ok = response.ok;
    results.push({ name, ok, status: response.status, url });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error), url });
  } finally {
    clearTimeout(timer);
  }
}
const origin = new URL(webUrl).origin;
try {
  const response = await fetch(apiUrl + "/api/v1/auth/login", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const allowOrigin = response.headers.get("access-control-allow-origin");
  const ok = response.ok && (allowOrigin === origin || allowOrigin === "*");
  results.push({
    name: "API CORS preflight",
    ok,
    status: response.status,
    allowOrigin,
    expectedOrigin: origin,
    url: apiUrl + "/api/v1/auth/login",
  });
} catch (error) {
  results.push({
    name: "API CORS preflight",
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    expectedOrigin: origin,
  });
}
console.log("\nEPHINTA deployment connectivity report");
for (const result of results) {
  console.log((result.ok ? "PASS " : "FAIL ") + result.name + (result.status ? " — HTTP " + result.status : "") + (result.allowOrigin ? " — CORS " + result.allowOrigin : "") + (result.error ? " — " + result.error : ""));
  if (!result.ok && result.expectedOrigin) console.log("     Expected CORS origin: " + result.expectedOrigin);
  if (!result.ok && result.url) console.log("     URL: " + result.url);
}
const failures = results.filter((result) => !result.ok);
console.log("\n" + (results.length - failures.length) + "/" + results.length + " checks passed.");
if (failures.length) process.exitCode = 1;
