import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "../../lib/errors";

export type VerifiedProviderPayment = {
  success: boolean;
  amountMinor: bigint;
  currency: string;
  reference?: string;
};

export function constantTimeStringEqual(received: string, expected: string): boolean {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export function verifyPaystackSignature(rawBody: Buffer, received: string, secret: string): boolean {
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  return constantTimeStringEqual(received, expected);
}

export function verifyFlutterwaveSignature(received: string, secret: string): boolean {
  return constantTimeStringEqual(received, secret);
}

export function verifyStripeSignature(
  rawBody: Buffer,
  received: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  const parts = received.split(",");
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestampPart || signatures.length === 0) return false;
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]);
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return signatures.some((signature) => constantTimeStringEqual(signature, expected));
}

export function assertVerifiedPayment(
  payment: VerifiedProviderPayment,
  intent: { amountMinor: bigint; currency: string },
  expectedReference: string,
) {
  if (!payment.success) {
    throw new HttpError(400, "PAYMENT_NOT_VERIFIED", "The payment provider has not confirmed a successful payment");
  }
  if (!payment.reference || payment.reference !== expectedReference) {
    throw new HttpError(400, "PAYMENT_REFERENCE_MISMATCH", "The verified payment reference does not match");
  }
  if (payment.amountMinor !== intent.amountMinor) {
    throw new HttpError(400, "PAYMENT_AMOUNT_MISMATCH", "The verified payment amount does not match");
  }
  if (payment.currency.toUpperCase() !== intent.currency.toUpperCase()) {
    throw new HttpError(400, "PAYMENT_CURRENCY_MISMATCH", "The verified payment currency does not match");
  }
}

export function majorAmountToMinor(amount: string | number): bigint {
  const value = String(amount);
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) {
    throw new HttpError(400, "INVALID_PROVIDER_AMOUNT", "The provider returned an invalid payment amount");
  }
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
}
