import { describe, expect, it } from "vitest";
import {
  bookingCommissionBps,
  bookingCommissionMinor,
  walletTopupFeeBps,
  walletTopupFeeMinor,
  payoutFeeMinor,
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

  it("deducts exactly 2% from outgoing OPay bank withdrawals", () => {
    const config = { COMMISSION_BPS: 500, PAYOUT_FEE_BPS: 200 };
    expect(payoutFeeMinor(100000n, config)).toBe(2000n);
    expect(100000n - payoutFeeMinor(100000n, config)).toBe(98000n);
  });

  it("keeps the agreed 2% outgoing fee even when legacy overrides are zero", () => {
    expect(payoutFeeMinor(100000n, { COMMISSION_BPS: 500, PAYOUT_FEE_BPS: 0 })).toBe(2000n);
  });

  it("keeps the agreed 2% incoming fee even when a legacy override is zero", () => {
    const config = {
      COMMISSION_BPS: 500,
      WALLET_TOPUP_FEE_BPS: 0,
      BOOKING_COMMISSION_BPS: 0,
    };
    expect(walletTopupFeeMinor(100000n, config)).toBe(2000n);
    expect(bookingCommissionMinor(100000n, config)).toBe(0n);
  });

  it("keeps incoming and outgoing transaction fees at 2% even when legacy commission differs", () => {
    const config = { COMMISSION_BPS: 500 };
    expect(walletTopupFeeBps(config)).toBe(200);
    expect(bookingCommissionBps(config)).toBe(500);
    expect(walletTopupFeeMinor(100000n, config)).toBe(2000n);
    expect(payoutFeeMinor(100000n, config)).toBe(2000n);
    expect(bookingCommissionMinor(100000n, config)).toBe(5000n);
  });

  it("uses exact minor-unit half-up rounding for small payments", () => {
    const config = { COMMISSION_BPS: 200, WALLET_TOPUP_FEE_BPS: 200, BOOKING_COMMISSION_BPS: 200 };
    expect(walletTopupFeeMinor(24n, config)).toBe(0n);
    expect(walletTopupFeeMinor(25n, config)).toBe(1n);
    expect(walletTopupFeeMinor(49n, config)).toBe(1n);
    expect(bookingCommissionMinor(150n, config)).toBe(3n);
  });
});
