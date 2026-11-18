import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, executeRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn(), executeRawMock: vi.fn() }));
vi.mock("../../lib/prisma", () => ({
  prisma: { $queryRaw: queryRawMock, $executeRaw: executeRawMock },
}));

import { claimDueOpayRefundReconciliation, completeRefundReconciliationClaim, deadLetterRefundReconciliationClaim, scheduleRefundReconciliationRetry } from "./refundReconciliationClaim.service";

describe("claimDueOpayRefundReconciliation", () => {
  beforeEach(() => { queryRawMock.mockReset(); executeRawMock.mockReset(); });

  it("atomically returns the claimed rows from the database", async () => {
    const claimed = [{
      id: "refund-1",
      providerRef: "refund-ref-1",
      paymentIntentId: "payment-1",
      status: "PENDING",
      reconciliationAttempts: 1,
      reconciliationLockToken: "lease-token",
      reconciliationLockedUntil: new Date("2026-11-18T10:01:00.000Z"),
    }];
    queryRawMock.mockResolvedValue(claimed);

    await expect(claimDueOpayRefundReconciliation({
      now: new Date("2026-11-18T10:00:00.000Z"),
      batchSize: 5,
      leaseMs: 60_000,
      maxAttempts: 8,
    })).resolves.toEqual(claimed);
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe batch, lease, and retry limits before querying", async () => {
    await expect(claimDueOpayRefundReconciliation({ batchSize: 101 })).rejects.toThrow(RangeError);
    await expect(claimDueOpayRefundReconciliation({ leaseMs: 999 })).rejects.toThrow(RangeError);
    await expect(claimDueOpayRefundReconciliation({ maxAttempts: 0 })).rejects.toThrow(RangeError);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid supplied clock before querying", async () => {
    await expect(claimDueOpayRefundReconciliation({ now: new Date("invalid") })).rejects.toThrow(TypeError);
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});


describe("refund reconciliation lease updates", () => {
  const lease = {
    id: "refund-1",
    lockToken: "lease-token",
    now: new Date("2026-11-18T10:00:00.000Z"),
  };

  beforeEach(() => executeRawMock.mockReset());

  it("completes only the reconciliation lease and reports a successful compare-and-set", async () => {
    executeRawMock.mockResolvedValue(1);
    await expect(completeRefundReconciliationClaim({ ...lease, nextAttemptAt: new Date("2026-11-18T10:05:00.000Z") })).resolves.toBe(true);
    expect(executeRawMock).toHaveBeenCalledTimes(1);
  });

  it("returns false when a stale token no longer owns the lease", async () => {
    executeRawMock.mockResolvedValue(0);
    await expect(completeRefundReconciliationClaim({ ...lease, lockToken: "stale-token", nextAttemptAt: new Date("2026-11-18T10:05:00.000Z") })).resolves.toBe(false);
  });

  it("schedules a retry while preserving the provider lifecycle status", async () => {
    executeRawMock.mockResolvedValue(1);
    await expect(scheduleRefundReconciliationRetry({
      ...lease,
      retryAt: new Date("2026-11-18T10:05:00.000Z"),
      error: "Provider query timed out",
    })).resolves.toBe(true);
  });

  it("dead-letters exhausted work without changing the refund reservation state", async () => {
    executeRawMock.mockResolvedValue(1);
    await expect(deadLetterRefundReconciliationClaim({
      ...lease,
      error: "Maximum reconciliation attempts reached",
    })).resolves.toBe(true);
  });

  it("rejects invalid retry times and oversized error messages before writing", async () => {
    await expect(scheduleRefundReconciliationRetry({
      ...lease,
      retryAt: lease.now,
      error: "retry",
    })).rejects.toThrow(TypeError);
    await expect(deadLetterRefundReconciliationClaim({
      ...lease,
      error: "x".repeat(1_001),
    })).rejects.toThrow(RangeError);
    expect(executeRawMock).not.toHaveBeenCalled();
  });
});
