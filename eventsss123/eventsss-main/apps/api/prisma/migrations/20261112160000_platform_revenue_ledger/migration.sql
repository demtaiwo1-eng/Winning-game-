CREATE TABLE "PlatformRevenueAccount" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balanceMinor" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "PlatformRevenueAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformRevenueEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "balanceAfterMinor" BIGINT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformRevenueEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformRevenueAccount_currency_key" ON "PlatformRevenueAccount"("currency");
CREATE UNIQUE INDEX "PlatformRevenueEntry_idempotencyKey_key" ON "PlatformRevenueEntry"("idempotencyKey");
CREATE INDEX "PlatformRevenueEntry_accountId_createdAt_idx" ON "PlatformRevenueEntry"("accountId", "createdAt");

ALTER TABLE "PlatformRevenueEntry"
ADD CONSTRAINT "PlatformRevenueEntry_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "PlatformRevenueAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
