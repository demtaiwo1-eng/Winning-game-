import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  claimDueOpayRefundReconciliation,
  completeRefundReconciliationClaim,
  deadLetterRefundReconciliationClaim,
  scheduleRefundReconciliationRetry,
} from "../src/modules/payments/refundReconciliationClaim.service";

const run = process.env.RUN_DB_TESTS === "1";
const createdUsers: string[] = [];
const createdIntentIds: string[] = [];
const createdRefundIds: string[] = [];

async function makeRefund(tag: string, options: {
  status?: "REQUESTED" | "INITIAL" | "PENDING" | "SUBMISSION_UNKNOWN";
  submittedAt?: Date | null;
  nextAttemptAt?: Date | null;
  lockedUntil?: Date | null;
  deadLetteredAt?: Date | null;
} = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const user = await prisma.user.create({
    data: {
      email: `refund-claim-${tag}-${suffix}@test.dev`,
      name: `Refund claim ${tag}`,
      passwordHash: "not-used-in-this-db-test",
      role: "CLIENT",
    },
  });
  createdUsers.push(user.id);

  const intent = await prisma.paymentIntent.create({
    data: {
      userId: user.id,
      provider: "opay",
      providerRef: `refund-claim-payment-${suffix}`,
      amountMinor: 50_000n,
      currency: "NGN",
      purpose: "WALLET_DEPOSIT",
      status: "SUCCEEDED",
    },
  });
  createdIntentIds.push(intent.id);

  const refund = await prisma.paymentRefund.create({
    data: {
      paymentIntentId: intent.id,
      userId: user.id,
      provider: "opay",
      providerRef: `refund-claim-provider-${suffix}`,
      idempotencyKey: `refund-claim-idempotency-${suffix}`,
      amountMinor: 50_000n,
      currency: "NGN",
      status: options.status ?? "PENDING",
      submittedAt: options.submittedAt === undefined ? new Date(Date.now() - 60_000) : options.submittedAt,
      reconciliationNextAttemptAt: options.nextAttemptAt ?? null,
      reconciliationLockedUntil: options.lockedUntil ?? null,
      reconciliationDeadLetteredAt: options.deadLetteredAt ?? null,
    },
  });
  createdRefundIds.push(refund.id);
  return refund;
}

async function cleanup() {
  await prisma.paymentRefund.deleteMany({ where: { id: { in: createdRefundIds } } });
  await prisma.paymentIntent.deleteMany({ where: { id: { in: createdIntentIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
}

afterAll(async () => {
  if (run) await cleanup();
});

describe.skipIf(!run)("OPay refund reconciliation claims (DB)", () => {
  it("claims due submitted rows and excludes requests, future work, active leases, and dead letters", async () => {
    const now = new Date();
    const due = await makeRefund("due");
    const request = await makeRefund("request", { status: "REQUESTED" });
    const notSubmitted = await makeRefund("not-submitted", { submittedAt: null });
    const future = await makeRefund("future", { nextAttemptAt: new Date(now.getTime() + 60_000) });
    const leased = await makeRefund("leased", { lockedUntil: new Date(now.getTime() + 60_000) });
    const dead = await makeRefund("dead", { deadLetteredAt: new Date(now.getTime() - 1_000) });

    const claimed = await claimDueOpayRefundReconciliation({ now, batchSize: 20 });
    const ids = claimed.map((row) => row.id);
    expect(ids).toContain(due.id);
    expect(ids).not.toContain(request.id);
    expect(ids).not.toContain(notSubmitted.id);
    expect(ids).not.toContain(future.id);
    expect(ids).not.toContain(leased.id);
    expect(ids).not.toContain(dead.id);
    expect(claimed.find((row) => row.id === due.id)?.reconciliationLockToken).toBeTruthy();
  });

  it("allows only one concurrent claimant to acquire a refund lease", async () => {
    const refund = await makeRefund("concurrent");
    const now = new Date();
    const [first, second] = await Promise.all([
      claimDueOpayRefundReconciliation({ now, batchSize: 1 }),
      claimDueOpayRefundReconciliation({ now, batchSize: 1 }),
    ]);
    const occurrences = [...first, ...second].filter((row) => row.id === refund.id);
    expect(occurrences).toHaveLength(1);
  });

  it("rejects stale tokens and schedules a completed query for a later poll", async () => {
    const refund = await makeRefund("lease-complete");
    const now = new Date();
    const [claim] = await claimDueOpayRefundReconciliation({ now, batchSize: 10 });
    expect(claim?.id).toBe(refund.id);

    await expect(completeRefundReconciliationClaim({
      id: refund.id,
      lockToken: "stale-token",
      now,
      nextAttemptAt: new Date(now.getTime() + 30_000),
    })).resolves.toBe(false);

    await expect(completeRefundReconciliationClaim({
      id: refund.id,
      lockToken: claim.reconciliationLockToken,
      now,
      nextAttemptAt: new Date(now.getTime() + 30_000),
    })).resolves.toBe(true);

    const tooEarly = await claimDueOpayRefundReconciliation({ now: new Date(now.getTime() + 10_000) });
    expect(tooEarly.some((row) => row.id === refund.id)).toBe(false);
    const dueAgain = await claimDueOpayRefundReconciliation({ now: new Date(now.getTime() + 31_000) });
    expect(dueAgain.some((row) => row.id === refund.id)).toBe(true);
  });

  it("schedules transient errors and dead-letters without releasing refund reservation status", async () => {
    const retryRefund = await makeRefund("retry");
    const deadRefund = await makeRefund("dead-letter");
    const now = new Date();
    const claimed = await claimDueOpayRefundReconciliation({ now, batchSize: 10 });
    const retryClaim = claimed.find((row) => row.id === retryRefund.id);
    const deadClaim = claimed.find((row) => row.id === deadRefund.id);
    expect(retryClaim).toBeTruthy();
    expect(deadClaim).toBeTruthy();

    expect(await scheduleRefundReconciliationRetry({
      id: retryRefund.id,
      lockToken: retryClaim!.reconciliationLockToken,
      now,
      retryAt: new Date(now.getTime() + 45_000),
      error: "Provider query timed out",
    })).toBe(true);

    expect(await deadLetterRefundReconciliationClaim({
      id: deadRefund.id,
      lockToken: deadClaim!.reconciliationLockToken,
      now,
      error: "Maximum query attempts reached",
    })).toBe(true);

    const [retryStored, deadStored] = await Promise.all([
      prisma.paymentRefund.findUniqueOrThrow({ where: { id: retryRefund.id } }),
      prisma.paymentRefund.findUniqueOrThrow({ where: { id: deadRefund.id } }),
    ]);
    expect(retryStored.status).toBe("PENDING");
    expect(retryStored.reconciliationNextAttemptAt?.getTime()).toBe(now.getTime() + 45_000);
    expect(retryStored.reconciliationLockToken).toBeNull();
    expect(deadStored.status).toBe("PENDING");
    expect(deadStored.reconciliationDeadLetteredAt).not.toBeNull();
    expect(deadStored.reconciliationLockToken).toBeNull();
  });
});
