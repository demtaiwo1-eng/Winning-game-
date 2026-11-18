import { LedgerType, PaymentRefundStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { assessOpayRefundFunding } from "./refundFundingAssessment.service";

export class RefundSettlementError extends Error {
  constructor(
    public readonly code:
      | "REFUND_NOT_FOUND"
      | "REFUND_NOT_PROVIDER_CONFIRMED"
      | "FUNDING_ASSESSMENT_FAILED"
      | "WALLET_FUNDS_UNAVAILABLE"
      | "PLATFORM_REVENUE_UNAVAILABLE"
      | "FEE_JOURNAL_MISSING",
    message: string,
  ) {
    super(message);
    this.name = "RefundSettlementError";
  }
}

/**
 * Atomically reverses the net customer wallet credit and the matching
 * platform-fee revenue. Call only after an authenticated OPay success result
 * has moved the refund to PROVIDER_SUCCEEDED_PENDING_SETTLEMENT.
 *
 * This function never contacts OPay. Provider callback/status reconciliation
 * must be implemented separately and must not mark a refund SUCCEEDED itself.
 */
export async function settleProviderConfirmedOpayRefund(
  refundId: string,
): Promise<{ settled: boolean; alreadySettled: boolean }> {
  return prisma.$transaction(async (tx) => {
    const initial = await tx.paymentRefund.findUnique({ where: { id: refundId } });
    if (!initial) throw new RefundSettlementError("REFUND_NOT_FOUND", "Refund request was not found.");

    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "PaymentIntent" WHERE "id" = ${initial.paymentIntentId} FOR UPDATE`;

    const refund = await tx.paymentRefund.findUnique({ where: { id: refundId } });
    if (!refund) throw new RefundSettlementError("REFUND_NOT_FOUND", "Refund request was not found.");
    if (refund.status === PaymentRefundStatus.SUCCEEDED) {
      return { settled: false, alreadySettled: true };
    }
    if (
      refund.provider !== "opay" ||
      refund.status !== PaymentRefundStatus.PROVIDER_SUCCEEDED_PENDING_SETTLEMENT
    ) {
      throw new RefundSettlementError(
        "REFUND_NOT_PROVIDER_CONFIRMED",
        "Only an OPay refund with separately confirmed provider success can be settled.",
      );
    }

    const assessment = await assessOpayRefundFunding(tx, {
      paymentIntentId: refund.paymentIntentId,
      userId: refund.userId,
      requestedAmountMinor: refund.amountMinor,
      // The funding review has already established this fee amount. Reconcile
      // against the immutable fee journal below rather than recomputing policy.
      expectedPlatformFeeMinor: await (async () => {
        const sourceFee = await tx.platformRevenueEntry.findUnique({
          where: { idempotencyKey: `platform_wallet_topup_fee:${refund.paymentIntentId}` },
        });
        return sourceFee?.amountMinor ?? 0n;
      })(),
      excludingRefundId: refund.id,
    });
    if (!assessment.eligible) {
      throw new RefundSettlementError(
        "FUNDING_ASSESSMENT_FAILED",
        `Refund funding no longer passes the safety assessment: ${assessment.reason}.`,
      );
    }

    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Wallet" WHERE "id" = ${assessment.walletId} FOR UPDATE`;

    const walletUpdate = await tx.wallet.updateMany({
      where: { id: assessment.walletId, availableMinor: { gte: assessment.walletCreditMinor } },
      data: { availableMinor: { decrement: assessment.walletCreditMinor } },
    });
    if (walletUpdate.count !== 1) {
      throw new RefundSettlementError(
        "WALLET_FUNDS_UNAVAILABLE",
        "The original wallet credit is no longer available for a safe refund reversal.",
      );
    }
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: assessment.walletId } });
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        type: LedgerType.ADJUSTMENT,
        amountMinor: -assessment.walletCreditMinor,
        balanceAfterMinor: wallet.availableMinor,
        refType: "PAYMENT_REFUND",
        refId: refund.id,
        idempotencyKey: `payment_refund_wallet_reversal:${refund.id}`,
      },
    });

    if (assessment.platformFeeMinor > 0n) {
      const feeEntry = await tx.platformRevenueEntry.findUnique({
        where: { idempotencyKey: `platform_wallet_topup_fee:${refund.paymentIntentId}` },
      });
      if (!feeEntry) {
        throw new RefundSettlementError("FEE_JOURNAL_MISSING", "The original platform fee journal is missing.");
      }
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "PlatformRevenueAccount" WHERE "id" = ${feeEntry.accountId} FOR UPDATE`;
      const accountUpdate = await tx.platformRevenueAccount.updateMany({
        where: {
          id: feeEntry.accountId,
          currency: refund.currency,
          balanceMinor: { gte: assessment.platformFeeMinor },
        },
        data: { balanceMinor: { decrement: assessment.platformFeeMinor } },
      });
      if (accountUpdate.count !== 1) {
        throw new RefundSettlementError(
          "PLATFORM_REVENUE_UNAVAILABLE",
          "The original platform fee is no longer available for a safe reversal.",
        );
      }
      const account = await tx.platformRevenueAccount.findUniqueOrThrow({
        where: { id: feeEntry.accountId },
      });
      await tx.platformRevenueEntry.create({
        data: {
          accountId: account.id,
          amountMinor: -assessment.platformFeeMinor,
          balanceAfterMinor: account.balanceMinor,
          refType: "PAYMENT_REFUND",
          refId: refund.id,
          idempotencyKey: `payment_refund_platform_fee_reversal:${refund.id}`,
        },
      });
    }

    const completed = await tx.paymentRefund.updateMany({
      where: {
        id: refund.id,
        status: PaymentRefundStatus.PROVIDER_SUCCEEDED_PENDING_SETTLEMENT,
      },
      data: {
        status: PaymentRefundStatus.SUCCEEDED,
        walletId: wallet.id,
        completedAt: new Date(),
        reconciliationLastError: null,
      },
    });
    if (completed.count !== 1) {
      throw new Error("Refund settlement state changed during the transaction.");
    }
    return { settled: true, alreadySettled: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
