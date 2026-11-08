import { describe, expect, it } from "vitest";
import { canUseDemoPayments, canUseProductionTestMode } from "./providers";

describe("production payment mode safeguards", () => {
  it("keeps production sandbox mode disabled unless explicitly approved", () => {
    expect(canUseProductionTestMode({
      nodeEnv: "production",
      paymentMode: "test",
      allowProductionTestMode: "false",
    })).toBe(false);
  });

  it("allows provider sandbox mode only after explicit production opt-in", () => {
    expect(canUseProductionTestMode({
      nodeEnv: "production",
      paymentMode: "test",
      allowProductionTestMode: "true",
    })).toBe(true);
  });

  it("does not enable simulated demo checkout in production", () => {
    expect(canUseDemoPayments({ nodeEnv: "production", paymentMode: "test" })).toBe(false);
  });
});
