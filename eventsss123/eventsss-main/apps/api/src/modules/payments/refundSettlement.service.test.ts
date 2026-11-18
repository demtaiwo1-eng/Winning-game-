import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, assessmentMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
  assessmentMock: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("./refundFundingAssessment.service", () => ({
  assessOpayRefundFunding: assessmentMock,
}));

import { PaymentRefundStatus, Prisma } from "@prisma/client";
import {
  RefundSettlementError,
  settleProviderConfirmedOpayRefund,
} from "./refundSettlement.service";

const refund = {
  id: "refund-1",
  paymentIntentId: "payment-1",
  userId: "user-1",
  provider: "opay",
  currency: "NGN",
  amountMinor: 10000n,
  status: PaymentRefundStatus.PROVIDER_SUCCEEDED_PENDING_SETTLEMENT,
};

function makeTransaction(overrides: Record<string, any> = {}) {
  const tx: any = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "locked" }]),
    paymentRefund: {
      findUnique: vi.fn().mockResolvedValue(refund),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    platformRevenueEntry: {
      findUnique: vi.fn().mockResolvedValue({
        id: "fee-1",
        accountId: "revenue-ngn",
        amountMinor: 200n,
        idempotencyKey: "platform_wallet_topup_fee:payment-1",
      }),
      create: vi.fn().mockResolvedValue({}),
    },
    wallet: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "wallet-1", availableMinor: 0n }),
    },
    ledgerEntry: { create: vi.fn().mockResolvedValue({}) },
    platformRevenueAccount: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "revenue-ngn", balanceMinor: 800n }),
    },
    ...overrides,
  };
  return tx;
}

describe("settleProviderConfirmedOpayRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => unknown) =>
      callback(makeTransaction()),
    );
    assessmentMock.mockResolvedValue({
      eligible: true,
      paymentIntentId: "payment-1",
      walletId: "wallet-1",
      grossAmountMinor: 10000n,
      walletCreditMinor: 9800n,
      platformFeeMinor: 200n,
      currency: "NGN",
      reason: "UNTOUCHED_FULL_DEPOSIT",
    });
  });

  it("posts both reversal legs and completes only after provider confirmation", async () => {
    const tx = makeTransaction();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback(tx));

    await expect(settleProviderConfirmedOpayRefund("refund-1")).resolves.toEqual({
      settled: true,
      alreadySettled: false,
    });

    expect(tx.wallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "wallet-1", availableMinor: { gte: 9800n } },
      data: { availableMinor: { decrement: 9800n } },
    }));
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amountMinor: -9800n,
        idempotencyKey: "payment_refund_wallet_reversal:refund-1",
      }),
    }));
    expect(tx.platformRevenueAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ balanceMinor: { gte: 200n } }),
      data: { balanceMinor: { decrement: 200n } },
    }));
    expect(tx.platformRevenueEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        amountMinor: -200n,
        idempotencyKey: "payment_refund_platform_fee_reversal:refund-1",
      }),
    }));
    expect(tx.paymentRefund.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "refund-1", status: PaymentRefundStatus.PROVIDER_SUCCEEDED_PENDING_SETTLEMENT },
      data: expect.objectContaining({ status: PaymentRefundStatus.SUCCEEDED }),
    }));
  });

  it("retries a serializable transaction conflict and then settles", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError(
      "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
      { code: "P2034", clientVersion: "5.22.0" },
    );
    const tx = makeTransaction();
    prismaMock.$transaction
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async (callback: (tx: any) => unknown) => callback(tx));

    await expect(settleProviderConfirmedOpayRefund("refund-1")).resolves.toEqual({
      settled: true,
      alreadySettled: false,
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("refuses to settle a refund that has not reached provider-confirmed state", async () => {
    const tx = makeTransaction({
      paymentRefund: {
        findUnique: vi.fn().mockResolvedValue({ ...refund, status: PaymentRefundStatus.REQUESTED }),
        updateMany: vi.fn(),
      },
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback(tx));

    await expect(settleProviderConfirmedOpayRefund("refund-1")).rejects.toMatchObject({
      code: "REFUND_NOT_PROVIDER_CONFIRMED",
    });
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.platformRevenueAccount.updateMany).not.toHaveBeenCalled();
  });

  it("does not write a ledger or complete the refund when the wallet cannot cover the reversal", async () => {
    const tx = makeTransaction({ wallet: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: vi.fn(),
    } });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback(tx));

    await expect(settleProviderConfirmedOpayRefund("refund-1")).rejects.toMatchObject({
      code: "WALLET_FUNDS_UNAVAILABLE",
    });
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    expect(tx.platformRevenueAccount.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentRefund.updateMany).not.toHaveBeenCalled();
  });

  it("does not complete the refund when platform fee revenue cannot be reversed", async () => {
    const tx = makeTransaction({
      platformRevenueAccount: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
      },
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback(tx));

    await expect(settleProviderConfirmedOpayRefund("refund-1")).rejects.toMatchObject({
      code: "PLATFORM_REVENUE_UNAVAILABLE",
    });
    expect(tx.ledgerEntry.create).toHaveBeenCalledOnce();
    expect(tx.platformRevenueEntry.create).not.toHaveBeenCalled();
    expect(tx.paymentRefund.updateMany).not.toHaveBeenCalled();
  });

  it("returns idempotently for a refund already settled", async () => {
    const tx = makeTransaction({
      paymentRefund: {
        findUnique: vi.fn().mockResolvedValue({ ...refund, status: PaymentRefundStatus.SUCCEEDED }),
        updateMany: vi.fn(),
      },
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback(tx));

    await expect(settleProviderConfirmedOpayRefund("refund-1")).resolves.toEqual({
      settled: false,
      alreadySettled: true,
    });
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentRefund.updateMany).not.toHaveBeenCalled();
  });

  it("stops after three serializable transaction conflicts", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError(
      "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
      { code: "P2034", clientVersion: "5.22.0" },
    );
    prismaMock.$transaction
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict)
      .mockRejectedValueOnce(conflict);

    await expect(settleProviderConfirmedOpayRefund("refund-1")).rejects.toBe(conflict);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-serialization failures", async () => {
    const failure = new Error("database unavailable");
    prismaMock.$transaction.mockRejectedValue(failure);

    await expect(settleProviderConfirmedOpayRefund("refund-1")).rejects.toBe(failure);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("reports missing refunds without attempting accounting", async () => {
    const tx = makeTransaction({
      paymentRefund: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn() },
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => unknown) => callback(tx));

    await expect(settleProviderConfirmedOpayRefund("missing")).rejects.toBeInstanceOf(RefundSettlementError);
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });
});
