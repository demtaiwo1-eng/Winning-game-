CREATE TYPE "SourceAccessOrderStatus" AS ENUM ('PENDING', 'PAID_PENDING_RELEASE', 'CANCELLED');

CREATE TABLE "SourceAccessOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "providerRef" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL DEFAULT 6000,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "SourceAccessOrderStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceAccessOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceAccessOrder_providerRef_key" ON "SourceAccessOrder"("providerRef");
CREATE INDEX "SourceAccessOrder_userId_createdAt_idx" ON "SourceAccessOrder"("userId", "createdAt");
CREATE INDEX "SourceAccessOrder_status_createdAt_idx" ON "SourceAccessOrder"("status", "createdAt");

ALTER TABLE "SourceAccessOrder"
  ADD CONSTRAINT "SourceAccessOrder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
