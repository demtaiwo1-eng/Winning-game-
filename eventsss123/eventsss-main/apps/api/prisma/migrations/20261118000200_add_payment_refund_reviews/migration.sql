-- Immutable administrator decisions for customer refund requests.
CREATE TYPE "PaymentRefundReviewAction" AS ENUM ('APPROVE_FOR_PROVIDER_REVIEW', 'REJECT');

CREATE TABLE "PaymentRefundReview" (
  "id" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "action" "PaymentRefundReviewAction" NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentRefundReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentRefundReview_refundId_createdAt_idx"
  ON "PaymentRefundReview"("refundId", "createdAt");
CREATE INDEX "PaymentRefundReview_reviewerId_createdAt_idx"
  ON "PaymentRefundReview"("reviewerId", "createdAt");

ALTER TABLE "PaymentRefundReview"
  ADD CONSTRAINT "PaymentRefundReview_refundId_fkey"
  FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefundReview"
  ADD CONSTRAINT "PaymentRefundReview_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
