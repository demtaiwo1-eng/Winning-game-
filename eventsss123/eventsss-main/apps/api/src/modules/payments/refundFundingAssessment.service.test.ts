import { describe, expect, it } from "vitest";
import { assessOpayRefundFunding } from "./refundFundingAssessment.service";

const baseIntent = {
  id: "pi_1",
  userId: "user_1",
  provider: "opay",
  currency: "NGN",
  status: "SUCCEEDED",
  purpose: "WALLET_DEPOSIT",
  amountMinor: 10000n,
};
const source = {
  id: "ledger_1",
  walletId: "wallet_1",
  amountMinor: 9800n,
  createdAt: new Date("2026-11-18T00:00:00.000Z"),
};
function txMock(overrides: Record<string, unknown> = {}) {
  const tx: any = {
    paymentIntent: { findUnique: async () => baseIntent },
    ledgerEntry: {
      findMany: async () => [source],
      count: async () => 0,
    },
    wallet: { findUnique: async () => ({ id: "wallet_1", userId: "user_1", currency: "NGN" }) },
    platformRevenueEntry: {
      findUnique: async () => ({
        idempotencyKey: "platform_wallet_topup_fee:pi_1",
        refType: "PAYMENT_INTENT",
        refId: "pi_1",
        amountMinor: 200n,
      }),
    },
    paymentRefund: { count: async () => 0 },
    ...overrides,
  };
  return tx;
}
const input = {
  paymentIntentId: "pi_1",
  userId: "user_1",
  requestedAmountMinor: 10000n,
  expectedPlatformFeeMinor: 200n,
};

describe("OPay refund funding assessment", () => {
  it("accepts an untouched full deposit only when both accounting legs reconcile", async () => {
    const result = await assessOpayRefundFunding(txMock() as any, input);
    expect(result).toMatchObject({
      eligible: true,
      walletId: "wallet_1",
      grossAmountMinor: 10000n,
      walletCreditMinor: 9800n,
      platformFeeMinor: 200n,
    });
  });

  it("fails closed when the source wallet has subsequent or ambiguous same-time activity", async () => {
    const tx = txMock({
      ledgerEntry: { findMany: async () => [source], count: async () => 1 },
    });
    await expect(assessOpayRefundFunding(tx as any, input)).resolves.toMatchObject({
      eligible: false,
      reason: "WALLET_ACTIVITY_AFTER_DEPOSIT",
    });
  });

  it("fails closed when the fee journal is missing or mismatched", async () => {
    const tx = txMock({ platformRevenueEntry: { findUnique: async () => null } });
    await expect(assessOpayRefundFunding(tx as any, input)).resolves.toMatchObject({
      eligible: false,
      reason: "PLATFORM_FEE_MISMATCH",
    });
  });

  it("fails closed when the source deposit is missing or duplicated", async () => {
    const tx = txMock({ ledgerEntry: { findMany: async () => [] } });
    await expect(assessOpayRefundFunding(tx as any, input)).resolves.toMatchObject({
      eligible: false,
      reason: "SOURCE_DEPOSIT_MISSING_OR_AMBIGUOUS",
    });
  });

  it("rejects partial refunds until fee allocation is implemented", async () => {
    await expect(assessOpayRefundFunding(txMock() as any, {
      ...input, requestedAmountMinor: 5000n,
    })).resolves.toMatchObject({
      eligible: false,
      reason: "PARTIAL_REFUND_NOT_YET_SUPPORTED",
    });
  });

  it("rejects a second active or completed refund", async () => {
    const tx = txMock({ paymentRefund: { count: async () => 1 } });
    await expect(assessOpayRefundFunding(tx as any, input)).resolves.toMatchObject({
      eligible: false,
      reason: "OTHER_REFUND_EXISTS",
    });
  });

  it("rejects a wallet belonging to a different customer", async () => {
    const tx = txMock({
      wallet: { findUnique: async () => ({ id: "wallet_1", userId: "someone_else", currency: "NGN" }) },
    });
    await expect(assessOpayRefundFunding(tx as any, input)).resolves.toMatchObject({
      eligible: false,
      reason: "WALLET_MISMATCH",
    });
  });
});
