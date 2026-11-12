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

-- Reclassify historical fee journal rows into the new platform revenue
-- subledger. Customer/vendor wallet balances are not changed by this backfill.
WITH legacy_fees AS (
    SELECT
        le."idempotencyKey",
        le."amountMinor",
        w."currency",
        le."refType",
        le."refId",
        le."createdAt"
    FROM "LedgerEntry" le
    JOIN "Wallet" w ON w."id" = le."walletId"
    WHERE le."idempotencyKey" LIKE 'pay_deposit_fee:%'
      AND le."amountMinor" > 0

    UNION ALL

    SELECT
        le."idempotencyKey",
        le."amountMinor",
        w."currency",
        le."refType",
        le."refId",
        le."createdAt"
    FROM "LedgerEntry" le
    JOIN "Wallet" w ON w."id" = le."walletId"
    WHERE le."idempotencyKey" LIKE 'commission:%'
      AND le."amountMinor" > 0
),
fee_totals AS (
    SELECT "currency", SUM("amountMinor") AS "balanceMinor"
    FROM legacy_fees
    GROUP BY "currency"
)
INSERT INTO "PlatformRevenueAccount" ("id", "currency", "balanceMinor")
SELECT md5('platform-revenue-account:' || "currency"), "currency", "balanceMinor"
FROM fee_totals
ON CONFLICT ("currency") DO UPDATE
SET "balanceMinor" = EXCLUDED."balanceMinor";

WITH legacy_fees AS (
    SELECT
        le."idempotencyKey",
        le."amountMinor",
        w."currency",
        le."refType",
        le."refId",
        le."createdAt"
    FROM "LedgerEntry" le
    JOIN "Wallet" w ON w."id" = le."walletId"
    WHERE le."idempotencyKey" LIKE 'pay_deposit_fee:%'
      AND le."amountMinor" > 0

    UNION ALL

    SELECT
        le."idempotencyKey",
        le."amountMinor",
        w."currency",
        le."refType",
        le."refId",
        le."createdAt"
    FROM "LedgerEntry" le
    JOIN "Wallet" w ON w."id" = le."walletId"
    WHERE le."idempotencyKey" LIKE 'commission:%'
      AND le."amountMinor" > 0
),
sequenced_fees AS (
    SELECT
        lf.*,
        SUM(lf."amountMinor") OVER (
            PARTITION BY lf."currency"
            ORDER BY lf."createdAt", lf."idempotencyKey"
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS "balanceAfterMinor"
    FROM legacy_fees lf
)
INSERT INTO "PlatformRevenueEntry" (
    "id", "accountId", "amountMinor", "balanceAfterMinor",
    "refType", "refId", "idempotencyKey", "createdAt"
)
SELECT
    md5('platform-revenue-entry:' || sf."idempotencyKey"),
    pra."id",
    sf."amountMinor",
    sf."balanceAfterMinor",
    sf."refType",
    sf."refId",
    CASE
        WHEN sf."idempotencyKey" LIKE 'pay_deposit_fee:%'
            THEN 'platform_wallet_topup_fee:' || substring(sf."idempotencyKey" FROM length('pay_deposit_fee:') + 1)
        ELSE 'platform_commission:' || substring(sf."idempotencyKey" FROM length('commission:') + 1)
    END,
    sf."createdAt"
FROM sequenced_fees sf
JOIN "PlatformRevenueAccount" pra ON pra."currency" = sf."currency";
