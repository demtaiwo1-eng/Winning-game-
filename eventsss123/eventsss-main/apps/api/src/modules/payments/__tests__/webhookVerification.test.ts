import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyFlutterwaveSignature,
  verifyOpayCallbackSignature,
  verifyPaystackSignature,
  verifyStripeSignature,
} from "../webhookVerification";

describe("payment webhook signature verification", () => {
  it("accepts OPay SHA3-512 callback signatures and rejects tampered or incomplete payloads", () => {
    const payload = {
      amount: "12500",
      currency: "NGN",
      reference: "ephinta_test_reference",
      refunded: false,
      status: "SUCCESS",
      timestamp: "1730000000",
      token: "opay-token",
      transactionId: "opay-transaction-123",
    };
    const canonical = `{Amount:"${payload.amount}",Currency:"${payload.currency}",Reference:"${payload.reference}",Refunded:f,Status:"${payload.status}",Timestamp:"${payload.timestamp}",Token:"${payload.token}",TransactionID:"${payload.transactionId}"}`;
    const secret = "opay-test-secret";
    const signature = createHmac("sha3-512", secret).update(canonical).digest("hex");

    expect(verifyOpayCallbackSignature(payload, signature, secret)).toBe(true);
    expect(verifyOpayCallbackSignature({ ...payload, amount: "12501" }, signature, secret)).toBe(false);
    expect(verifyOpayCallbackSignature({ ...payload, transactionId: undefined }, signature, secret)).toBe(false);
    expect(verifyOpayCallbackSignature(payload, signature, "wrong-secret")).toBe(false);
  });

  it("accepts a valid Paystack raw-body HMAC", () => {
    const body = Buffer.from('{"event":"charge.success"}');
    const secret = "paystack-test-secret";
    const signature = createHmac("sha512", secret).update(body).digest("hex");
    expect(verifyPaystackSignature(body, signature, secret)).toBe(true);
    expect(verifyPaystackSignature(body, `${signature}00`, secret)).toBe(false);
  });

  it("uses constant-time equality for Flutterwave's configured hash", () => {
    expect(verifyFlutterwaveSignature("configured-hash", "configured-hash")).toBe(true);
    expect(verifyFlutterwaveSignature("wrong-hash", "configured-hash")).toBe(false);
  });

  it("accepts a fresh Stripe signed payload and rejects stale or altered payloads", () => {
    const body = Buffer.from('{"id":"evt_test"}');
    const secret = "whsec_test";
    const timestamp = 1_700_000_000;
    const signedPayload = `${timestamp}.${body.toString("utf8")}`;
    const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
    const header = `t=${timestamp},v1=${signature}`;

    expect(verifyStripeSignature(body, header, secret, timestamp + 30)).toBe(true);
    expect(verifyStripeSignature(Buffer.from('{"id":"tampered"}'), header, secret, timestamp + 30)).toBe(false);
    expect(verifyStripeSignature(body, header, secret, timestamp + 301)).toBe(false);
  });
});
