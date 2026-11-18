-- Durable worker lease and bounded-retry state for refund reconciliation.
-- Nullable lease fields keep existing/manual-review rows safely unclaimed.
ALTER TABLE "PaymentRefund"
  ADD COLUMN "reconciliationDeadLetteredAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationLockToken" TEXT,
  ADD COLUMN "reconciliationLockedUntil" TIMESTAMP(3);

CREATE INDEX "PaymentRefund_status_reconciliationLockedUntil_idx"
  ON "PaymentRefund"("status", "reconciliationLockedUntil");

CREATE INDEX "PaymentRefund_reconciliationDeadLetteredAt_idx"
  ON "PaymentRefund"("reconciliationDeadLetteredAt");
