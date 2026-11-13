import { describe, expect, it } from "vitest";
import { payoutFeeMinor } from "../src/modules/payments/feePolicy";

describe("external bank payout fee policy", () => {
  it("charges 2% on the gross outgoing wallet amount", () => {
    const config = { COMMISSION_BPS: 200 };
    expect(payoutFeeMinor(100000n, config)).toBe(2000n);
    expect(100000n - payoutFeeMinor(100000n, config)).toBe(98000n);
  });

  it("enforces the agreed 2% payout fee regardless of legacy overrides", () => {
    expect(payoutFeeMinor(100000n, { COMMISSION_BPS: 200, PAYOUT_FEE_BPS: 0 })).toBe(2000n);
    expect(payoutFeeMinor(100000n, { COMMISSION_BPS: 200, PAYOUT_FEE_BPS: 350 })).toBe(2000n);
  });

  it("uses exact minor-unit half-up rounding", () => {
    const config = { COMMISSION_BPS: 200 };
    expect(payoutFeeMinor(24n, config)).toBe(0n);
    expect(payoutFeeMinor(25n, config)).toBe(1n);
    expect(payoutFeeMinor(150n, config)).toBe(3n);
  });
});
