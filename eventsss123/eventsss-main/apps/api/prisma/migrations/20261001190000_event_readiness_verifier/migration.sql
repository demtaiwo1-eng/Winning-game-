-- AlterEnum Role add VERIFIER
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VERIFIER';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ServiceCheckStatus" AS ENUM ('PENDING', 'GREEN', 'AMBER', 'RED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EventReadinessStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ALL_GREEN', 'AT_RISK', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "EventServiceCheck" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "bookingId" TEXT,
    "listingId" TEXT,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "status" "ServiceCheckStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "verifiedById" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventServiceCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EventReadiness" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "EventReadinessStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "totalChecks" INTEGER NOT NULL DEFAULT 0,
    "greenCount" INTEGER NOT NULL DEFAULT 0,
    "amberCount" INTEGER NOT NULL DEFAULT 0,
    "redCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "windowOpensAt" TIMESTAMP(3),
    "greenDeadlineAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "assignedVerifierId" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "customerNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventReadiness_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventReadiness_eventId_key" ON "EventReadiness"("eventId");
CREATE INDEX IF NOT EXISTS "EventServiceCheck_eventId_status_idx" ON "EventServiceCheck"("eventId", "status");
CREATE INDEX IF NOT EXISTS "EventServiceCheck_verifiedById_idx" ON "EventServiceCheck"("verifiedById");

DO $$ BEGIN
  ALTER TABLE "EventServiceCheck" ADD CONSTRAINT "EventServiceCheck_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventServiceCheck" ADD CONSTRAINT "EventServiceCheck_verifiedById_fkey"
    FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventReadiness" ADD CONSTRAINT "EventReadiness_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventReadiness" ADD CONSTRAINT "EventReadiness_assignedVerifierId_fkey"
    FOREIGN KEY ("assignedVerifierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
