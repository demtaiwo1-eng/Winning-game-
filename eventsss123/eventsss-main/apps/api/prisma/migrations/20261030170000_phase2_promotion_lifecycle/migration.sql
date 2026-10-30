ALTER TABLE "Promotion"
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "pausedAt" TIMESTAMP(3),
  ADD COLUMN "impressions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clicks" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Promotion_vendorId_createdAt_idx"
  ON "Promotion"("vendorId", "createdAt");
