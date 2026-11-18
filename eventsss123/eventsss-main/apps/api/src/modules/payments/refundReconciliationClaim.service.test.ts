import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn() }));
vi.mock("../../lib/prisma", () => ({
  prisma: { $queryRaw: queryRawMock },
}));

import { claimDueOpayRefundReconciliation } from "./refundReconciliationClaim.service";

describe("claimDueOpayRefundReconciliation", () => {
  beforeEach(() => queryRawMock.mockReset());

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
