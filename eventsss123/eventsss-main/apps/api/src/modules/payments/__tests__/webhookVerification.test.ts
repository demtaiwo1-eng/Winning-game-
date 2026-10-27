import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyFlutterwaveSignature,
  verifyPaystackSignature,
  verifyStripeSignature,
} from "../webhookVerification";

describe("payment webhook signature verification", () => {
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
