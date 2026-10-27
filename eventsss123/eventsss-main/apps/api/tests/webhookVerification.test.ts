import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { HttpError } from "../src/lib/errors";
import {
  assertVerifiedPayment,
  constantTimeStringEqual,
  majorAmountToMinor,
  verifyPaystackSignature,
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
