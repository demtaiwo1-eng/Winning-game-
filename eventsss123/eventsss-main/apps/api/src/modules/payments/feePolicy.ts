import { commissionMinor } from "../../lib/money";

export const TRANSACTION_FEE_BPS = 200;

export interface PaymentFeeConfig {
  COMMISSION_BPS: number;
  // Retained as compatibility fields for older config objects; these cannot
  // override the agreed incoming/outgoing transaction fee.
  WALLET_TOPUP_FEE_BPS?: number;
  PAYOUT_FEE_BPS?: number;
  BOOKING_COMMISSION_BPS?: number;
}

/** Incoming wallet funding always carries the agreed 2% transaction fee. */
export function walletTopupFeeBps(_config: PaymentFeeConfig): number {
  return TRANSACTION_FEE_BPS;
}

/** Booking commission remains a separate, independently configured fee. */
export function bookingCommissionBps(config: PaymentFeeConfig): number {
  return config.BOOKING_COMMISSION_BPS ?? config.COMMISSION_BPS;
}

export function walletTopupFeeMinor(amountMinor: bigint, config: PaymentFeeConfig): bigint {
  return commissionMinor(amountMinor, walletTopupFeeBps(config));
}

export function bookingCommissionMinor(amountMinor: bigint, config: PaymentFeeConfig): bigint {
  return commissionMinor(amountMinor, bookingCommissionBps(config));
}

/** OPay bank withdrawals always carry the agreed 2% outgoing transaction fee. */
export function payoutFeeBps(): number {
  return TRANSACTION_FEE_BPS;
}

export function payoutFeeMinor(amountMinor: bigint, _config: PaymentFeeConfig): bigint {
  return commissionMinor(amountMinor, TRANSACTION_FEE_BPS);
}
