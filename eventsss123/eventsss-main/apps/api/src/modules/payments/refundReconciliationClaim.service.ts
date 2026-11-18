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


export type RefundReconciliationLeaseOptions = {
  id: string;
  lockToken: string;
  now?: Date;
};

function validateLeaseIdentity(id: string, lockToken: string, now: Date): void {
  if (!id.trim() || !lockToken.trim()) {
    throw new TypeError("Refund reconciliation id and lock token are required.");
  }
  if (Number.isNaN(now.getTime())) {
    throw new TypeError("Refund reconciliation now must be a valid date.");
  }
}

/**
 * Releases a lease after a worker has completed a status query. It deliberately
 * does not change the refund's financial lifecycle status.
 */
export async function completeRefundReconciliationClaim(
  options: RefundReconciliationLeaseOptions & { nextAttemptAt: Date },
): Promise<boolean> {
  const now = options.now ?? new Date();
  validateLeaseIdentity(options.id, options.lockToken, now);
  if (Number.isNaN(options.nextAttemptAt.getTime()) || options.nextAttemptAt.getTime() <= now.getTime()) {
    throw new TypeError("Refund reconciliation nextAttemptAt must be later than now.");
  }

  const updated = await prisma.$executeRaw`
    UPDATE "PaymentRefund"
    SET "reconciliationLockToken" = NULL,
        "reconciliationLockedUntil" = NULL,
        "reconciliationLastError" = NULL,
        "reconciliationNextAttemptAt" = ${options.nextAttemptAt},
        "updatedAt" = ${now}
    WHERE "id" = ${options.id}
      AND "reconciliationLockToken" = ${options.lockToken}
      AND "reconciliationLockedUntil" > ${now}
      AND "status"::text IN ('INITIAL', 'PENDING', 'SUBMISSION_UNKNOWN')
      AND "reconciliationDeadLetteredAt" IS NULL
  `;
  return updated === 1;
}

export type ScheduleRefundReconciliationRetryOptions =
  RefundReconciliationLeaseOptions & {
    retryAt: Date;
    error: string;
  };

/** Releases a valid lease and schedules a bounded retry without changing status. */
export async function scheduleRefundReconciliationRetry(
  options: ScheduleRefundReconciliationRetryOptions,
): Promise<boolean> {
  const now = options.now ?? new Date();
  validateLeaseIdentity(options.id, options.lockToken, now);
  if (Number.isNaN(options.retryAt.getTime()) || options.retryAt.getTime() <= now.getTime()) {
    throw new TypeError("Refund reconciliation retryAt must be later than now.");
  }
  const error = options.error.trim();
  if (!error || error.length > 1_000) {
    throw new RangeError("Refund reconciliation error must contain 1 to 1000 characters.");
  }

  const updated = await prisma.$executeRaw`
    UPDATE "PaymentRefund"
    SET "reconciliationLockToken" = NULL,
        "reconciliationLockedUntil" = NULL,
        "reconciliationLastError" = ${error},
        "reconciliationNextAttemptAt" = ${options.retryAt},
        "updatedAt" = ${now}
    WHERE "id" = ${options.id}
      AND "reconciliationLockToken" = ${options.lockToken}
      AND "reconciliationLockedUntil" > ${now}
      AND "status"::text IN ('INITIAL', 'PENDING', 'SUBMISSION_UNKNOWN')
      AND "reconciliationDeadLetteredAt" IS NULL
  `;
  return updated === 1;
}

/**
 * Stops automatic reconciliation after an operator-defined attempt limit.
 * The refund status/reservation is preserved; only the lease and dead-letter
 * metadata change. An audited operator action is required to resolve it.
 */
export async function deadLetterRefundReconciliationClaim(
  options: RefundReconciliationLeaseOptions & { error: string },
): Promise<boolean> {
  const now = options.now ?? new Date();
  validateLeaseIdentity(options.id, options.lockToken, now);
  const error = options.error.trim();
  if (!error || error.length > 1_000) {
    throw new RangeError("Refund reconciliation error must contain 1 to 1000 characters.");
  }

  const updated = await prisma.$executeRaw`
    UPDATE "PaymentRefund"
    SET "reconciliationLockToken" = NULL,
        "reconciliationLockedUntil" = NULL,
        "reconciliationDeadLetteredAt" = ${now},
        "reconciliationLastError" = ${error},
        "reconciliationNextAttemptAt" = NULL,
        "updatedAt" = ${now}
    WHERE "id" = ${options.id}
      AND "reconciliationLockToken" = ${options.lockToken}
      AND "reconciliationLockedUntil" > ${now}
      AND "status"::text IN ('INITIAL', 'PENDING', 'SUBMISSION_UNKNOWN')
      AND "reconciliationDeadLetteredAt" IS NULL
  `;
  return updated === 1;
}
