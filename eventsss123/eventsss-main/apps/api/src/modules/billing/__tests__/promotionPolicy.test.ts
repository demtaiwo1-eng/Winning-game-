import { describe, expect, it } from "vitest";
import {
  isPromotionPaymentValid,
  isPromotionTrackingAction,
  isPromotionWithinSchedule,
} from "../promotionPolicy";

describe("promotion monetization policy", () => {
  it("accepts only a matching immutable promotion ledger payment", () => {
    expect(
      isPromotionPaymentValid(
        { refType: "PROMOTION_PAYMENT", refId: "promo-1", amountMinor: 250_000n },
        "promo-1",
        250_000n,
      ),
    ).toBe(true);
  });

  it("rejects a missing, foreign, or underpaid ledger record", () => {
    expect(isPromotionPaymentValid(null, "promo-1", 250_000n)).toBe(false);
    expect(
      isPromotionPaymentValid(
        { refType: "PROMOTION_PAYMENT", refId: "promo-2", amountMinor: 250_000n },
        "promo-1",
        250_000n,
      ),
    ).toBe(false);
    expect(
      isPromotionPaymentValid(
        { refType: "PROMOTION_PAYMENT", refId: "promo-1", amountMinor: 249_999n },
        "promo-1",
        250_000n,
      ),
    ).toBe(false);
  });

  it("requires a campaign to be within its start/end window for public tracking", () => {
    const now = new Date("2026-10-30T12:00:00.000Z");
    expect(
      isPromotionWithinSchedule(
        new Date("2026-10-30T11:00:00.000Z"),
        new Date("2026-10-30T13:00:00.000Z"),
        now,
      ),
    ).toBe(true);
    expect(
      isPromotionWithinSchedule(
        new Date("2026-10-30T13:00:00.000Z"),
        new Date("2026-10-30T14:00:00.000Z"),
        now,
      ),
    ).toBe(false);
    expect(
      isPromotionWithinSchedule(
        new Date("2026-10-30T10:00:00.000Z"),
        new Date("2026-10-30T12:00:00.000Z"),
        now,
      ),
    ).toBe(false);
  });

  it("allows only impression and click tracking actions", () => {
    expect(isPromotionTrackingAction("impression")).toBe(true);
    expect(isPromotionTrackingAction("click")).toBe(true);
    expect(isPromotionTrackingAction("purchase")).toBe(false);
    expect(isPromotionTrackingAction(undefined)).toBe(false);
  });
});
