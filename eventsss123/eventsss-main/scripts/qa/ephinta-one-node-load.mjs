#!/usr/bin/env node
/**
 * Controlled single-node EPHINTA campaign.
 * 5,000 synthetic identities, bounded to 20 concurrent lightweight health probes.
 * Payment values/modes are synthetic ledger calculations only: no payment API,
 * provider checkout, webhook, payout, wallet credit, or live-money operation.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.EPHINTA_LOAD_BASE_URL || "https://ephinta-opay-staging.onrender.com").replace(/\/$/, "");
const totalUsers = Number(process.env.LOAD_USERS || 5000);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 20);
const timeoutMs = Number(process.env.LOAD_TIMEOUT_MS || 15000);
const roles = ["CLIENT", "ORGANIZATION", "VENDOR", "VERIFIER", "ADMIN"];
const modes = ["DEMO", "TEST", "LIVE"];
const highValuesNaira = [10_000_000n, 100_000_000n, 1_000_000_000n, 10_000_000_000n];
const startedAt = new Date().toISOString();
const results = new Array(totalUsers);
let cursor = 0;
let completed = 0;

if (!Number.isInteger(totalUsers) || totalUsers < 1 || totalUsers > 5000) throw new Error("LOAD_USERS must be 1..5000");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 25) throw new Error("LOAD_CONCURRENCY must be 1..25 for the single free instance");
const target = new URL("/health", baseUrl);
if (target.protocol !== "https:") throw new Error("Load target must use HTTPS");

function fee2Percent(amountMinor) { return (amountMinor * 200n + 5000n) / 10000n; }
function formatNairaFromKobo(kobo) { return "₦" + (kobo / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + (kobo % 100n).toString().padStart(2, "0"); }

const finance = Object.fromEntries(modes.map((mode) => [mode, {
  incomingCount: 0, outgoingCount: 0, incomingGrossKobo: 0n, outgoingGrossKobo: 0n,
  incomingFeeKobo: 0n, outgoingFeeKobo: 0n, providerCalls: 0,
  settlementAllowed: mode !== "LIVE",
}]));

async function runOne(index) {
  const role = roles[index % roles.length];
  const mode = modes[index % modes.length];
  const amountNaira = highValuesNaira[index % highValuesNaira.length];
  const amountKobo = amountNaira * 100n;
  const incoming = index % 2 === 0;
  const fee = fee2Percent(amountKobo);
  const bucket = finance[mode];
  if (incoming) {
    bucket.incomingCount++;
    bucket.incomingGrossKobo += amountKobo;
    bucket.incomingFeeKobo += fee;
  } else {
    bucket.outgoingCount++;
    bucket.outgoingGrossKobo += amountKobo;
    bucket.outgoingFeeKobo += fee;
  }
  // LIVE is policy-checked only. It must never call a live provider in this campaign.
  if (mode === "LIVE") bucket.providerCalls++;
  const started = Date.now();
  try {
    const response = await fetch(target, { method: "GET", headers: { "user-agent": "EPHINTA-OneNode-QA/1.0", "x-qa-persona": String(index + 1) }, signal: AbortSignal.timeout(timeoutMs) });
    const body = await response.text();
    results[index] = { user: index + 1, role, mode, status: response.status, ok: response.ok, latencyMs: Date.now() - started, error: response.ok ? null : body.slice(0, 240) };
  } catch (error) {
    results[index] = { user: index + 1, role, mode, status: 0, ok: false, latencyMs: Date.now() - started, error: String(error?.message || error).slice(0, 240) };
  }
  completed++;
  if (completed % 250 === 0 || completed === totalUsers) process.stdout.write(`Completed ${completed}/${totalUsers} synthetic user probes\n`);
}

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= totalUsers) return;
    await runOne(index);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const latencies = results.filter(Boolean).map((x) => x.latencyMs).sort((a, b) => a - b);
const errors = results.filter((x) => !x?.ok);
const countStatus = (code) => results.filter((x) => x?.status === code).length;
const pct = (p) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)] : null;
const roleSummary = Object.fromEntries(roles.map((role) => [role, {
  users: results.filter((x) => x?.role === role).length,
  passed: results.filter((x) => x?.role === role && x.ok).length,
  failed: results.filter((x) => x?.role === role && !x.ok).length,
}]));
const financeSummary = Object.fromEntries(Object.entries(finance).map(([mode, v]) => [mode, {
  ...v,
  incomingGross: formatNairaFromKobo(v.incomingGrossKobo),
  outgoingGross: formatNairaFromKobo(v.outgoingGrossKobo),
  incomingFee: formatNairaFromKobo(v.incomingFeeKobo),
  outgoingFee: formatNairaFromKobo(v.outgoingFeeKobo),
  grossTotal: formatNairaFromKobo(v.incomingGrossKobo + v.outgoingGrossKobo),
  feeTotal: formatNairaFromKobo(v.incomingFeeKobo + v.outgoingFeeKobo),
  incomingGrossKobo: v.incomingGrossKobo.toString(),
  outgoingGrossKobo: v.outgoingGrossKobo.toString(),
  incomingFeeKobo: v.incomingFeeKobo.toString(),
  outgoingFeeKobo: v.outgoingFeeKobo.toString(),
  settlementAllowed: mode !== "LIVE",
  providerCalls: 0,
}]));
const report = {
  title: "EPHINTA single-node 5,000 synthetic-user campaign",
  startedAt, finishedAt: new Date().toISOString(), target: target.origin,
  topology: { nodes: 1, maxConcurrentRequests: concurrency, totalSyntheticUsers: totalUsers, requestPath: "/health", requestPerUser: 1 },
  disclaimer: "5,000 synthetic personas each made one lightweight health request. This is not 5,000 concurrent authenticated end-to-end users. Financial values are synthetic calculations, not real or provider-settled transactions. DEMO/TEST/LIVE are modeled as policy buckets; LIVE provider calls are deliberately zero.",
  totals: { users: totalUsers, passed: totalUsers - errors.length, failed: errors.length, http2xx: results.filter((x) => x.status >= 200 && x.status < 300).length, http4xx: results.filter((x) => x.status >= 400 && x.status < 500).length, http5xx: results.filter((x) => x.status >= 500).length, networkErrors: results.filter((x) => x.status === 0).length, p50Ms: pct(0.50), p95Ms: pct(0.95), p99Ms: pct(0.99), maxMs: latencies.at(-1) ?? null },
  roleSummary, financeSummary,
  errors: errors.slice(0, 250),
};
const outDir = path.resolve("artifacts");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "ephinta-one-node-5000-report.json"), JSON.stringify(report, null, 2) + "\n");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EPHINTA One-node Load Report</title><style>
:root{font-family:Inter,ui-sans-serif,system-ui;color:#172033;background:#f4f6fb}body{margin:0;padding:28px}.wrap{max-width:1180px;margin:auto}.top,.card,.panel{background:#fff;border:1px solid #e3e8f1;border-radius:18px;padding:22px;margin-bottom:16px}.top{background:#101b34;color:white}.muted{color:#7b8498}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.metric{font-size:28px;font-weight:750;margin-top:8px}.pill{display:inline-block;padding:5px 10px;border-radius:99px;background:#fff0d5;color:#8b5100;font-size:12px;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #edf0f5;font-size:14px}th{color:#6c7486}.good{color:#087b53}.bad{color:#c03939}@media(max-width:640px){body{padding:12px}.top,.card,.panel{padding:16px}table{display:block;overflow:auto}}</style></head><body><main class="wrap"><header class="top"><span class="pill">SINGLE NODE · SYNTHETIC QA</span><h1>EPHINTA Control Centre</h1><p>5,000-user load and financial-mode simulation report</p><p class="muted">Generated ${report.finishedAt} · ${report.target}</p></header><section class="grid">
<div class="card"><div class="muted">Synthetic users</div><div class="metric">${report.totals.users.toLocaleString()}</div></div>
<div class="card"><div class="muted">Health checks passed</div><div class="metric good">${report.totals.passed.toLocaleString()}</div></div>
<div class="card"><div class="muted">Errors</div><div class="metric ${errors.length ? "bad" : "good"}">${report.totals.failed.toLocaleString()}</div></div>
<div class="card"><div class="muted">Latency p95</div><div class="metric">${report.totals.p95Ms ?? "—"} ms</div></div></section>
<section class="panel"><h2>Environment and transaction simulation</h2><p class="muted">Illustrative NGN totals calculated at 2% incoming and 2% outgoing. No real transaction was submitted.</p><table><thead><tr><th>Mode</th><th>Incoming gross</th><th>Incoming fee</th><th>Outgoing gross</th><th>Outgoing fee</th><th>Provider calls</th></tr></thead><tbody>${Object.entries(financeSummary).map(([mode,v])=>`<tr><td><b>${mode}</b>${mode==="LIVE"?" · locked":""}</td><td>${v.incomingGross}</td><td>${v.incomingFee}</td><td>${v.outgoingGross}</td><td>${v.outgoingFee}</td><td>${v.providerCalls}</td></tr>`).join("")}</tbody></table></section>
<section class="panel"><h2>Role coverage</h2><table><thead><tr><th>Role</th><th>Users</th><th>Passed</th><th>Failed</th></tr></thead><tbody>${Object.entries(roleSummary).map(([role,v])=>`<tr><td>${role}</td><td>${v.users}</td><td class="good">${v.passed}</td><td class="bad">${v.failed}</td></tr>`).join("")}</tbody></table></section>
<section class="panel"><h2>Latency and HTTP errors</h2><p>p50: ${report.totals.p50Ms} ms · p95: ${report.totals.p95Ms} ms · p99: ${report.totals.p99Ms} ms · max: ${report.totals.maxMs} ms</p><p>HTTP 4xx: ${report.totals.http4xx} · HTTP 5xx: ${report.totals.http5xx} · Network/timeouts: ${report.totals.networkErrors}</p><h3>Errors (first 250)</h3><pre>${JSON.stringify(report.errors,null,2).replaceAll("&","&amp;").replaceAll("<","&lt;")}</pre></section>
<section class="panel"><b>Interpretation</b><p>This test validates one-node health endpoint responsiveness under a bounded 20-request concurrency cap. It does not establish 5,000 simultaneous authenticated user sessions, payment settlement, or one-million-user capacity. LIVE mode remains a zero-provider-call policy simulation.</p></section></main></body></html>`;
await writeFile(path.join(outDir, "ephinta-one-node-5000-dashboard.html"), html);
console.log(JSON.stringify({status: errors.length ? "failed" : "passed", report: "artifacts/ephinta-one-node-5000-report.json", dashboard: "artifacts/ephinta-one-node-5000-dashboard.html", totals: report.totals, financeSummary}, null, 2));
if (errors.length) process.exitCode = 1;
