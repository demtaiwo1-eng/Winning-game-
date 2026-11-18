import { PaymentRefundStatus, PaymentStatus, type Prisma } from "@prisma/client";

export type RefundFundingAssessment =
  | {
      eligible: true;
      paymentIntentId: string;
      walletId: string;
      grossAmountMinor: bigint;
      walletCreditMinor: bigint;
      platformFeeMinor: bigint;
      currency: string;
      reason: "UNTOUCHED_FULL_DEPOSIT";
    }
  | {
      eligible: false;
      reason:
        | "PAYMENT_NOT_FOUND"
        | "PAYMENT_NOT_REFUNDABLE"
        | "UNSAFE_PROVIDER_AMOUNT"
        | "SOURCE_DEPOSIT_MISSING_OR_AMBIGUOUS"
        | "WALLET_MISMATCH"
        | "PLATFORM_FEE_MISMATCH"
        | "WALLET_ACTIVITY_AFTER_DEPOSIT"
        | "PARTIAL_REFUND_NOT_YET_SUPPORTED"
        | "OTHER_REFUND_EXISTS";
    };

const reservingStatuses: PaymentRefundStatus[] = [
  PaymentRefundStatus.REQUESTED,
  PaymentRefundStatus.MANUAL_REVIEW,
  PaymentRefundStatus.SUBMITTING,
  PaymentRefundStatus.SUBMISSION_UNKNOWN,
  PaymentRefundStatus.INITIAL,
  PaymentRefundStatus.PENDING,
  PaymentRefundStatus.PROVIDER_SUCCEEDED_PENDING_SETTLEMENT,
  PaymentRefundStatus.SUCCEEDED,
];

/**
 * Conservative interim gate. Caller must run this inside a transaction after
 * locking the PaymentIntent row. It deliberately supports only a full refund
 * of a wallet that has had no later ledger activity. It never moves money.
 */
export async function assessOpayRefundFunding(
  tx: Prisma.TransactionClient,
  input: {
    paymentIntentId: string;
    userId: string;
    requestedAmountMinor: bigint;
    expectedPlatformFeeMinor: bigint;
    excludingRefundId?: string;
  },
): Promise<RefundFundingAssessment> {
  const intent = await tx.paymentIntent.findUnique({
    where: { id: input.paymentIntentId },
  });
  if (!intent || intent.userId !== input.userId) {
    return { eligible: false, reason: "PAYMENT_NOT_FOUND" };
  }
  if (
    intent.provider !== "opay" ||
    intent.currency !== "NGN" ||
    intent.status !== PaymentStatus.SUCCEEDED ||
    intent.purpose !== "WALLET_DEPOSIT" ||
    intent.amountMinor <= 0n
  ) {
    return { eligible: false, reason: "PAYMENT_NOT_REFUNDABLE" };
  }
  if (intent.amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { eligible: false, reason: "UNSAFE_PROVIDER_AMOUNT" };
  }
  if (input.requestedAmountMinor !== intent.amountMinor) {
    return { eligible: false, reason: "PARTIAL_REFUND_NOT_YET_SUPPORTED" };
  }

  const sourceEntries = await tx.ledgerEntry.findMany({
    where: {
      type: "DEPOSIT",
      refType: "PAYMENT_INTENT",
      refId: intent.id,
      idempotencyKey: `pay_deposit:${intent.id}`,
    },
    take: 2,
  });
  if (sourceEntries.length !== 1 || sourceEntries[0].amountMinor <= 0n) {
    return { eligible: false, reason: "SOURCE_DEPOSIT_MISSING_OR_AMBIGUOUS" };
  }
  const source = sourceEntries[0];
  const wallet = await tx.wallet.findUnique({ where: { id: source.walletId } });
  if (!wallet || wallet.userId !== intent.userId || wallet.currency !== intent.currency) {
    return { eligible: false, reason: "WALLET_MISMATCH" };
  }

  const expectedNetCredit = intent.amountMinor - input.expectedPlatformFeeMinor;
  if (
    input.expectedPlatformFeeMinor < 0n ||
    expectedNetCredit <= 0n ||
    source.amountMinor !== expectedNetCredit
  ) {
    return { eligible: false, reason: "SOURCE_DEPOSIT_MISSING_OR_AMBIGUOUS" };
  }

  if (input.expectedPlatformFeeMinor > 0n) {
    const feeEntry = await tx.platformRevenueEntry.findUnique({
      where: { idempotencyKey: `platform_wallet_topup_fee:${intent.id}` },
    });
    if (
      !feeEntry ||
      feeEntry.refType !== "PAYMENT_INTENT" ||
      feeEntry.refId !== intent.id ||
      feeEntry.amountMinor !== input.expectedPlatformFeeMinor
    ) {
      return { eligible: false, reason: "PLATFORM_FEE_MISMATCH" };
    }
  }

  // A same-timestamp entry is treated as ambiguous and blocks automation too.
  const laterActivity = await tx.ledgerEntry.count({
    where: {
      walletId: wallet.id,
      createdAt: { gte: source.createdAt },
      NOT: { id: source.id },
    },
  });
  if (laterActivity > 0) {
    return { eligible: false, reason: "WALLET_ACTIVITY_AFTER_DEPOSIT" };
  }

  const otherRefunds = await tx.paymentRefund.count({
    where: {
      paymentIntentId: intent.id,
      status: { in: reservingStatuses },
      ...(input.excludingRefundId ? { id: { not: input.excludingRefundId } } : {}),
    },
  });
  if (otherRefunds > 0) {
    return { eligible: false, reason: "OTHER_REFUND_EXISTS" };
  }

  return {
    eligible: true,
    paymentIntentId: intent.id,
    walletId: wallet.id,
    grossAmountMinor: intent.amountMinor,
    walletCreditMinor: expectedNetCredit,
    platformFeeMinor: input.expectedPlatformFeeMinor,
    currency: intent.currency,
    reason: "UNTOUCHED_FULL_DEPOSIT",
  };
}
