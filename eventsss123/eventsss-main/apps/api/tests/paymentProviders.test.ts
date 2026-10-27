import { describe, expect, it } from "vitest";
import { canCompleteDemoCheckout, canUseDemoPayments } from "../src/modules/payments/providers";

describe("payment provider mode guards", () => {
  it("only allows simulated checkout for pending demo intents in non-production test mode", () => {
    expect(
      canCompleteDemoCheckout("demo", "PENDING", {
        nodeEnv: "development",
        paymentMode: "test",
      }),
    ).toBe(true);
    expect(
      canCompleteDemoCheckout("paystack", "PENDING", {
        nodeEnv: "development",
        paymentMode: "test",
      }),
    ).toBe(false);
    expect(
      canCompleteDemoCheckout("demo", "PENDING", {
        nodeEnv: "production",
        paymentMode: "test",
      }),
    ).toBe(false);
    expect(
      canCompleteDemoCheckout("demo", "FAILED", {
        nodeEnv: "development",
        paymentMode: "test",
      }),
    ).toBe(false);
  });

  it("does not enable simulated checkout in live payment mode", () => {
    expect(canUseDemoPayments({ nodeEnv: "development", paymentMode: "live" })).toBe(false);
  });
});
