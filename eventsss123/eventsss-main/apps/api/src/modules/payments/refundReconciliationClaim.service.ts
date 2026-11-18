import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";

export type ClaimedRefundReconciliation = {
  id: string;
  providerRef: string;
  paymentIntentId: string;
  status: string;
  reconciliationAttempts: number;
  reconciliationLockToken: string;
  reconciliationLockedUntil: Date;
};

export type ClaimRefundReconciliationOptions = {
  batchSize?: number;
  leaseMs?: number;
  maxAttempts?: number;
  now?: Date;
};

/**
 * Atomically claims only already-submitted OPay refunds that need status
 * reconciliation. This function never creates/submits a refund and never
 * changes wallet or platform-revenue balances.
 *
 * SUBMISSION_UNKNOWN is query-only: callers must query the existing provider
 * reference and must never repeat the create request.
 */
export async function claimDueOpayRefundReconciliation(
  options: ClaimRefundReconciliationOptions = {},
): Promise<ClaimedRefundReconciliation[]> {
  const batchSize = options.batchSize ?? 20;
  const leaseMs = options.leaseMs ?? 60_000;
  const maxAttempts = options.maxAttempts ?? 12;
  const now = options.now ?? new Date();

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new RangeError("Refund reconciliation batchSize must be between 1 and 100.");
  }
  if (!Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 600_000) {
    throw new RangeError("Refund reconciliation leaseMs must be between 1000 and 600000.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 50) {
    throw new RangeError("Refund reconciliation maxAttempts must be between 1 and 50.");
  }
  if (Number.isNaN(now.getTime())) {
    throw new TypeError("Refund reconciliation now must be a valid date.");
  }

  const lockToken = randomUUID();
  const lockedUntil = new Date(now.getTime() + leaseMs);

  return prisma.$queryRaw<ClaimedRefundReconciliation[]>`
    WITH due AS (
      SELECT "id"
      FROM "PaymentRefund"
      WHERE "provider" = 'opay'
        AND "status"::text IN ('INITIAL', 'PENDING', 'SUBMISSION_UNKNOWN')
        AND "reconciliationDeadLetteredAt" IS NULL
        AND "reconciliationAttempts" < ${maxAttempts}
        AND ("reconciliationNextAttemptAt" IS NULL OR "reconciliationNextAttemptAt" <= ${now})
        AND ("reconciliationLockedUntil" IS NULL OR "reconciliationLockedUntil" <= ${now})
        AND ("submittedAt" IS NOT NULL OR "status"::text = 'SUBMISSION_UNKNOWN')
      ORDER BY COALESCE("reconciliationNextAttemptAt", "createdAt"), "createdAt", "id"
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "PaymentRefund" AS refund
    SET "reconciliationLockToken" = ${lockToken},
        "reconciliationLockedUntil" = ${lockedUntil},
        "reconciliationAttempts" = refund."reconciliationAttempts" + 1,
        "updatedAt" = ${now}
    FROM due
    WHERE refund."id" = due."id"
    RETURNING
      refund."id",
      refund."providerRef",
      refund."paymentIntentId",
      refund."status"::text AS "status",
      refund."reconciliationAttempts",
      refund."reconciliationLockToken",
      refund."reconciliationLockedUntil"
  `;
}
