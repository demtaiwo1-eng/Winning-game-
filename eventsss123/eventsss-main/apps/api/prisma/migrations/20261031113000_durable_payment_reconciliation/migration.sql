ALTER TABLE "PaymentIntent"
  ADD COLUMN "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconciliationNextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationLastError" TEXT,
  ADD COLUMN "reconciliationDeadLetteredAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationLockToken" TEXT,
  ADD COLUMN "reconciliationLockedUntil" TIMESTAMP(3);

CREATE INDEX "PaymentIntent_status_reconciliationNextAttemptAt_idx"
  ON "PaymentIntent"("status", "reconciliationNextAttemptAt");

CREATE INDEX "PaymentIntent_reconciliationDeadLetteredAt_idx"
  ON "PaymentIntent"("reconciliationDeadLetteredAt");
