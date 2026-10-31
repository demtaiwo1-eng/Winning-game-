CREATE TYPE "AdminApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

CREATE TABLE "AdminApproval" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "amountMinor" BIGINT,
    "currency" TEXT,
    "reason" TEXT NOT NULL,
    "status" "AdminApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminApproval_idempotencyKey_key" ON "AdminApproval"("idempotencyKey");
CREATE INDEX "AdminApproval_status_createdAt_idx" ON "AdminApproval"("status", "createdAt");
CREATE INDEX "AdminApproval_entity_entityId_idx" ON "AdminApproval"("entity", "entityId");
CREATE INDEX "AdminApproval_requestedById_createdAt_idx" ON "AdminApproval"("requestedById", "createdAt");
