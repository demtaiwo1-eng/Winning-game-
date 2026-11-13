import { describe, expect, it } from "vitest";
import {
  bookingCommissionBps,
  bookingCommissionMinor,
  walletTopupFeeBps,
  walletTopupFeeMinor,
} from "./feePolicy";

describe("separate payment fee policy", () => {
  it("deducts exactly 2% from incoming wallet top-ups", () => {
    const config = { COMMISSION_BPS: 500, WALLET_TOPUP_FEE_BPS: 200 };
    expect(walletTopupFeeBps(config)).toBe(200);
    expect(walletTopupFeeMinor(100000n, config)).toBe(2000n);
    expect(100000n - walletTopupFeeMinor(100000n, config)).toBe(98000n);
  });

  it("calculates booking commission independently from the wallet top-up fee", () => {
    const config = {
      COMMISSION_BPS: 500,
      WALLET_TOPUP_FEE_BPS: 200,
      BOOKING_COMMISSION_BPS: 200,
    };
    expect(walletTopupFeeMinor(100000n, config)).toBe(2000n);
    expect(bookingCommissionBps(config)).toBe(200);
    expect(bookingCommissionMinor(100000n, config)).toBe(2000n);
    expect(100000n - bookingCommissionMinor(100000n, config)).toBe(98000n);
  });

  it("preserves an explicitly configured zero fee instead of falling back", () => {
    const config = {
      COMMISSION_BPS: 500,
      WALLET_TOPUP_FEE_BPS: 0,
      BOOKING_COMMISSION_BPS: 0,
    };
    expect(walletTopupFeeMinor(100000n, config)).toBe(0n);
    expect(bookingCommissionMinor(100000n, config)).toBe(0n);
  });

  it("uses the legacy commission rate only when an explicit rate is absent", () => {
    const config = { COMMISSION_BPS: 200 };
    expect(walletTopupFeeBps(config)).toBe(200);
    expect(bookingCommissionBps(config)).toBe(200);
    expect(walletTopupFeeMinor(100000n, config)).toBe(2000n);
    expect(bookingCommissionMinor(100000n, config)).toBe(2000n);
  });

  it("uses exact minor-unit half-up rounding for small payments", () => {
    const config = { COMMISSION_BPS: 200, WALLET_TOPUP_FEE_BPS: 200, BOOKING_COMMISSION_BPS: 200 };
    expect(walletTopupFeeMinor(24n, config)).toBe(0n);
    expect(walletTopupFeeMinor(25n, config)).toBe(1n);
    expect(walletTopupFeeMinor(49n, config)).toBe(1n);
    expect(bookingCommissionMinor(150n, config)).toBe(3n);
  });
});
