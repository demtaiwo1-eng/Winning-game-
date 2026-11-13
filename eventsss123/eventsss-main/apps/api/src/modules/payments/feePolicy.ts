import { commissionMinor } from "../../lib/money";

export interface PaymentFeeConfig {
  COMMISSION_BPS: number;
  WALLET_TOPUP_FEE_BPS?: number;
  BOOKING_COMMISSION_BPS?: number;
}

/** Incoming NGN wallet deposits default to the agreed 2% transaction fee. */
export function walletTopupFeeBps(_config: PaymentFeeConfig): number {
  return 200;
}

/** Explicit booking commission wins; otherwise retain the legacy setting. */
export function bookingCommissionBps(config: PaymentFeeConfig): number {
  return config.BOOKING_COMMISSION_BPS ?? config.COMMISSION_BPS;
}

export function walletTopupFeeMinor(amountMinor: bigint, config: PaymentFeeConfig): bigint {
  return commissionMinor(amountMinor, walletTopupFeeBps(config));
}

export function bookingCommissionMinor(amountMinor: bigint, config: PaymentFeeConfig): bigint {
  return commissionMinor(amountMinor, bookingCommissionBps(config));
}

/** Outgoing OPay bank withdrawals default to the agreed 2% transaction fee. */
export function payoutFeeMinor(amountMinor: bigint, _config: PaymentFeeConfig & { PAYOUT_FEE_BPS?: number }): bigint {
  return commissionMinor(amountMinor, 200);
}
