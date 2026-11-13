import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { HttpError } from "../src/lib/errors";
import {
  assertVerifiedPayment,
  constantTimeStringEqual,
  majorAmountToMinor,
  verifyPaystackSignature,
  verifyPaystackWebhookSignature,
} from "../src/modules/payments/webhookVerification";

describe("payment webhook verification", () => {
  const expectedIntent = { amountMinor: 125050n, currency: "NGN" };
  const verifiedPayment = {
    success: true,
    amountMinor: 125050n,
    currency: "ngn",
    reference: "pay_ref_123",
  };

  it("validates Paystack's HMAC over the exact raw body", () => {
    const raw = Buffer.from('{"event":"charge.success","data":{"reference":"pay_ref_123"}}');
    const signature = createHmac("sha512", "test-webhook-secret").update(raw).digest("hex");
    expect(verifyPaystackSignature(raw, signature, "test-webhook-secret")).toBe(true);
    expect(verifyPaystackSignature(raw, `${signature}x`, "test-webhook-secret")).toBe(false);
    expect(verifyPaystackSignature(Buffer.from("{}"), signature, "test-webhook-secret")).toBe(false);
  });

  it("validates Paystack's timestamped webhook-signing-secret header", () => {
    const raw = Buffer.from('{"event":"transfer.success","data":{"reference":"payout_123"}}');
    const secret = "whsec_test_signing_secret";
    const timestamp = 1_800_000_000;
    const signature = createHmac("sha512", secret).update(`${timestamp}.`).update(raw).digest("hex");
    const header = `t=${timestamp},v1=whk_abc123:${signature}`;
    expect(verifyPaystackWebhookSignature(raw, header, secret, timestamp)).toBe(true);
    expect(verifyPaystackWebhookSignature(raw, header, secret, timestamp + 301)).toBe(false);
    expect(verifyPaystackWebhookSignature(raw, header, secret, timestamp - 301)).toBe(false);
    expect(verifyPaystackWebhookSignature(Buffer.from("{}"), header, secret, timestamp)).toBe(false);
    expect(verifyPaystackWebhookSignature(raw, header, "whsec_wrong", timestamp)).toBe(false);
    expect(verifyPaystackWebhookSignature(raw, `t=${timestamp},v1=whk_abc123:bad`, secret, timestamp)).toBe(false);
  });

  it("accepts any valid v1 signature during Paystack signing-secret rotation", () => {
    const raw = Buffer.from('{"event":"ping"}');
    const secret = "whsec_current_secret";
    const timestamp = 1_800_000_000;
    const signature = createHmac("sha512", secret).update(`${timestamp}.`).update(raw).digest("hex");
    const header = `t=${timestamp},v1=whk_oldkey:${"0".repeat(128)},v1=whk_newkey:${signature}`;
    expect(verifyPaystackWebhookSignature(raw, header, secret, timestamp)).toBe(true);
  });

  it("compares Flutterwave secret hashes without timing-unsafe equality", () => {
    expect(constantTimeStringEqual("expected-hash", "expected-hash")).toBe(true);
    expect(constantTimeStringEqual("different-hash", "expected-hash")).toBe(false);
    expect(constantTimeStringEqual("", "")).toBe(false);
  });

  it("requires provider verification success, matching reference, amount, and currency", () => {
    expect(() => assertVerifiedPayment(verifiedPayment, expectedIntent, "pay_ref_123")).not.toThrow();
    expect(() => assertVerifiedPayment({ ...verifiedPayment, success: false }, expectedIntent, "pay_ref_123"))
      .toThrowError(HttpError);
    expect(() => assertVerifiedPayment({ ...verifiedPayment, reference: "other" }, expectedIntent, "pay_ref_123"))
      .toThrowError(/reference/i);
    expect(() => assertVerifiedPayment({ ...verifiedPayment, amountMinor: 1n }, expectedIntent, "pay_ref_123"))
      .toThrowError(/amount/i);
    expect(() => assertVerifiedPayment({ ...verifiedPayment, currency: "USD" }, expectedIntent, "pay_ref_123"))
      .toThrowError(/currency/i);
  });

  it("converts provider major-unit decimal strings to minor-unit BigInt exactly", () => {
    expect(majorAmountToMinor("1250.50")).toBe(125050n);
    expect(majorAmountToMinor(12)).toBe(1200n);
    expect(() => majorAmountToMinor("12.345")).toThrowError(/amount/i);
    expect(() => majorAmountToMinor("1e3")).toThrowError(/amount/i);
  });
});
