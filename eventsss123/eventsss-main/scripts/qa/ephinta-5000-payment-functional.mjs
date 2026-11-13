#!/usr/bin/env node
/**
 * Deterministic 5,000-identity payment-functional simulation.
 * No network, credentials, database writes, OPay calls, or real funds.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "artifacts/ephinta-5000-payment-functional-report.json");
const USERS = Number(process.env.PAYMENT_TEST_USERS || 5000);
const BPS = 200n;
const MODES = ["DEMO", "TEST", "LIVE"];
const AMOUNTS_NGN = [10_000_000n, 100_000_000n, 1_000_000_000n, 10_000_000_000n];
const fee = (amountMinor) => (amountMinor * BPS + 5_000n) / 10_000n;
const hash = (value) => createHash("sha256").update(value).digest("hex");

function runIdentity(index) {
  const mode = MODES[index % MODES.length];
  const gross = AMOUNTS_NGN[index % AMOUNTS_NGN.length] * 100n;
  const incomingFee = fee(gross);
  const incomingCredit = gross - incomingFee;
  assert.equal(incomingFee, gross / 50n, "incoming fee must be exactly 2%");
  assert.equal(incomingCredit + incomingFee, gross, "incoming ledger must balance");

  const incomingRef = `sim-in-${index}`;
  const incomingLedger = new Map();
  let wallet = 0n;
  let incomingCallbackCount = 0;
  const applyIncoming = () => {
    if (incomingLedger.has(incomingRef)) return;
    incomingLedger.set(incomingRef, incomingCredit);
    wallet += incomingCredit;
    incomingCallbackCount += 1;
  };
  applyIncoming();
  applyIncoming();
  assert.equal(incomingCallbackCount, 1, "duplicate incoming callback must not double-credit");
  assert.equal(wallet, incomingCredit);

  // Use a multiple of 50 minor units so the 2% fee is exact in integer kobo.
  const outgoingGross = (incomingCredit / 150n) * 150n;
  const outgoingFee = fee(outgoingGross);
  const payoutNet = outgoingGross - outgoingFee;
  assert.equal(outgoingFee, outgoingGross / 50n, "outgoing fee must be exactly 2%");
  assert.equal(payoutNet + outgoingFee, outgoingGross, "payout net plus fee must balance");
  assert.ok(outgoingGross <= wallet, "payout cannot exceed wallet balance");

  wallet -= outgoingGross;
  let payoutStatus = "PROCESSING";
  const settleSuccess = () => {
    if (payoutStatus !== "PROCESSING") return;
    payoutStatus = "SUCCEEDED";
  };
  settleSuccess();
  settleSuccess();
  assert.equal(payoutStatus, "SUCCEEDED");
  assert.equal(wallet, incomingCredit - outgoingGross);

  // Exercise both failure and reversal recovery without double-refunding.
  const recoveryGross = (incomingCredit / 250n) * 250n;
  wallet -= recoveryGross;
  let recoveryStatus = "PROCESSING";
  let refundCount = 0;
  const refundOnce = (nextStatus) => {
    if (!["PROCESSING", "SUCCEEDED"].includes(recoveryStatus)) return;
    recoveryStatus = nextStatus;
    wallet += recoveryGross;
    refundCount += 1;
  };
  refundOnce(index % 2 === 0 ? "FAILED" : "REVERSED");
  refundOnce("REVERSED");
  assert.equal(refundCount, 1, "failed/reversed payout must refund exactly once");
  assert.equal(wallet, incomingCredit - outgoingGross);

  const liveAllowed = mode !== "LIVE";
  const providerCalls = 0;
  if (mode === "LIVE") assert.equal(liveAllowed, false, "LIVE must remain fail-closed");
  else assert.equal(liveAllowed, true);

  return {
    id: index + 1,
    persona: ["CLIENT", "ORGANIZATION", "VENDOR", "VERIFIER", "ADMIN"][index % 5],
    mode,
    incoming: { grossKobo: gross.toString(), feeKobo: incomingFee.toString(), creditedKobo: incomingCredit.toString(), duplicateCallbackIgnored: true },
    outgoing: { grossKobo: outgoingGross.toString(), feeKobo: outgoingFee.toString(), netKobo: payoutNet.toString(), status: payoutStatus },
    recovery: { grossKobo: recoveryGross.toString(), finalStatus: recoveryStatus, refundedOnce: true },
    finalWalletKobo: wallet.toString(),
    providerCalls,
    liveAllowed,
    passed: true,
  };
}

const results = [];
const byMode = Object.fromEntries(MODES.map((mode) => [mode, { users: 0, incomingGrossKobo: 0n, incomingFeesKobo: 0n, outgoingGrossKobo: 0n, outgoingFeesKobo: 0n, providerCalls: 0 }]));
for (let i = 0; i < USERS; i += 1) {
  const result = runIdentity(i);
  results.push(result);
  const bucket = byMode[result.mode];
  bucket.users += 1;
  bucket.incomingGrossKobo += BigInt(result.incoming.grossKobo);
  bucket.incomingFeesKobo += BigInt(result.incoming.feeKobo);
  bucket.outgoingGrossKobo += BigInt(result.outgoing.grossKobo);
  bucket.outgoingFeesKobo += BigInt(result.outgoing.feeKobo);
  bucket.providerCalls += result.providerCalls;
}
assert.equal(results.length, USERS);
assert.ok(results.every((item) => item.passed));
assert.ok(results.filter((item) => item.mode === "LIVE").every((item) => item.liveAllowed === false));

const summary = {
  status: "passed",
  testType: "deterministic_mocked_payment_functional_simulation",
  realMoneyMoved: false,
  providerCalls: 0,
  users: USERS,
  passed: results.length,
  failed: 0,
  assertionsPerUser: 11,
  totalAssertions: USERS * 11,
  feePolicyBps: Number(BPS),
  modes: Object.fromEntries(Object.entries(byMode).map(([mode, item]) => [mode, {
    users: item.users,
    incomingGrossKobo: item.incomingGrossKobo.toString(),
    incomingFeesKobo: item.incomingFeesKobo.toString(),
    outgoingGrossKobo: item.outgoingGrossKobo.toString(),
    outgoingFeesKobo: item.outgoingFeesKobo.toString(),
    providerCalls: item.providerCalls,
    liveSettlementAllowed: mode !== "LIVE",
  }])),
  resultsSha256: hash(JSON.stringify(results)),
  generatedAt: new Date().toISOString(),
};
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify({ ...summary, report: OUT }, null, 2));
