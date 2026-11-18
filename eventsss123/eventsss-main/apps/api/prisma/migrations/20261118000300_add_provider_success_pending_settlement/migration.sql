-- Provider confirmation is not the same as internal wallet/revenue settlement.
-- This state is intentionally non-terminal and must remain reserved against
-- duplicate refund requests until the two-ledger reversal commits atomically.
ALTER TYPE "PaymentRefundStatus" ADD VALUE IF NOT EXISTS 'PROVIDER_SUCCEEDED_PENDING_SETTLEMENT';
