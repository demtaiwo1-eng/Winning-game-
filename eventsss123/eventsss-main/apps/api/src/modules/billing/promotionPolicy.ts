export type PromotionPaymentRecord = {
  refType: string | null;
  refId: string | null;
  amountMinor: bigint;
} | null;

/** A campaign is paid only when the immutable wallet ledger matches its exact amount and ID. */
export function isPromotionPaymentValid(
  payment: PromotionPaymentRecord,
  promotionId: string,
  budgetMinor: bigint,
): boolean {
  return Boolean(
    payment &&
      payment.refType === "PROMOTION_PAYMENT" &&
      payment.refId === promotionId &&
      payment.amountMinor === budgetMinor,
  );
}

export function isPromotionWithinSchedule(
  startsAt: Date,
  endsAt: Date,
  now = new Date(),
): boolean {
  return Number.isFinite(startsAt.getTime()) &&
    Number.isFinite(endsAt.getTime()) &&
    startsAt <= now &&
    endsAt > now;
}

export function isPromotionTrackingAction(value: unknown): value is "impression" | "click" {
  return value === "impression" || value === "click";
}
