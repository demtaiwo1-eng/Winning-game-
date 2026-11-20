CREATE TYPE "WalletFundingSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "CustomerFundingAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'unassigned',
  "providerCustomerRef" TEXT,
  "providerAccountRef" TEXT,
  "bankName" TEXT,
  "accountNumber" TEXT,
  "accountName" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" TEXT NOT NULL DEFAULT 'PENDING_PARTNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerFundingAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletFundingSubmission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "senderName" TEXT NOT NULL,
  "senderBank" TEXT,
  "transferReference" TEXT NOT NULL,
  "receiptUrl" TEXT NOT NULL,
  "status" "WalletFundingSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "creditLedgerEntryId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletFundingSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerFundingAccount_userId_key" ON "CustomerFundingAccount"("userId");
CREATE UNIQUE INDEX "CustomerFundingAccount_accountNumber_key" ON "CustomerFundingAccount"("accountNumber");
CREATE INDEX "CustomerFundingAccount_provider_providerAccountRef_idx" ON "CustomerFundingAccount"("provider", "providerAccountRef");
CREATE INDEX "CustomerFundingAccount_status_idx" ON "CustomerFundingAccount"("status");
CREATE UNIQUE INDEX "WalletFundingSubmission_transferReference_key" ON "WalletFundingSubmission"("transferReference");
CREATE UNIQUE INDEX "WalletFundingSubmission_creditLedgerEntryId_key" ON "WalletFundingSubmission"("creditLedgerEntryId");
CREATE UNIQUE INDEX "WalletFundingSubmission_idempotencyKey_key" ON "WalletFundingSubmission"("idempotencyKey");
CREATE INDEX "WalletFundingSubmission_userId_createdAt_idx" ON "WalletFundingSubmission"("userId", "createdAt");
CREATE INDEX "WalletFundingSubmission_status_createdAt_idx" ON "WalletFundingSubmission"("status", "createdAt");

ALTER TABLE "CustomerFundingAccount" ADD CONSTRAINT "CustomerFundingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletFundingSubmission" ADD CONSTRAINT "WalletFundingSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
