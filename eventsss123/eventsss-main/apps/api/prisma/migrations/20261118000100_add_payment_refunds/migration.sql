-- Durable OPay/customer refund requests.
-- This migration creates audit records only; it does not alter wallet balances
-- or submit refunds to a provider.
CREATE TYPE "PaymentRefundStatus" AS ENUM (
  'REQUESTED',
  'MANUAL_REVIEW',
  'SUBMITTING',
  'SUBMISSION_UNKNOWN',
  'INITIAL',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "RefundWay" AS ENUM ('Original', 'BankAccount');

CREATE TABLE "PaymentRefund" (
  "id" TEXT NOT NULL,
  "paymentIntentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "walletId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'opay',
  "providerRef" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "refundWay" "RefundWay" NOT NULL DEFAULT 'Original',
  "status" "PaymentRefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "refundReason" TEXT,
  "providerOrderNo" TEXT,
  "providerStatus" TEXT,
  "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
  "reconciliationNextAttemptAt" TIMESTAMP(3),
  "reconciliationLastError" TEXT,
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentRefund_amountMinor_positive" CHECK ("amountMinor" > 0),
  CONSTRAINT "PaymentRefund_currency_length" CHECK (char_length("currency") = 3)
);

CREATE UNIQUE INDEX "PaymentRefund_providerRef_key" ON "PaymentRefund"("providerRef");
CREATE UNIQUE INDEX "PaymentRefund_idempotencyKey_key" ON "PaymentRefund"("idempotencyKey");
CREATE INDEX "PaymentRefund_paymentIntentId_status_idx" ON "PaymentRefund"("paymentIntentId", "status");
CREATE INDEX "PaymentRefund_userId_createdAt_idx" ON "PaymentRefund"("userId", "createdAt");
CREATE INDEX "PaymentRefund_status_reconciliationNextAttemptAt_idx" ON "PaymentRefund"("status", "reconciliationNextAttemptAt");

ALTER TABLE "PaymentRefund"
  ADD CONSTRAINT "PaymentRefund_paymentIntentId_fkey"
  FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentRefund"
  ADD CONSTRAINT "PaymentRefund_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentRefund"
  ADD CONSTRAINT "PaymentRefund_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
