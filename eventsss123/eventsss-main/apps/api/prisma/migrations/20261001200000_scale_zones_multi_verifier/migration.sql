ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "scaleTier" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "isVirtual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "parentEventId" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "budgetMinor" BIGINT;

CREATE INDEX IF NOT EXISTS "Event_parentEventId_idx" ON "Event"("parentEventId");

DO $$ BEGIN
  ALTER TABLE "Event" ADD CONSTRAINT "Event_parentEventId_fkey"
    FOREIGN KEY ("parentEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "EventServiceCheck" ADD COLUMN IF NOT EXISTS "zone" TEXT NOT NULL DEFAULT 'GENERAL';
CREATE INDEX IF NOT EXISTS "EventServiceCheck_eventId_zone_idx" ON "EventServiceCheck"("eventId", "zone");

ALTER TABLE "EventReadiness" ADD COLUMN IF NOT EXISTS "snapshotJson" TEXT;

CREATE TABLE IF NOT EXISTS "EventVerifierAssignment" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "verifierId" TEXT NOT NULL,
  "zone" TEXT NOT NULL DEFAULT 'GENERAL',
  "isLead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventVerifierAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventVerifierAssignment_eventId_verifierId_zone_key"
  ON "EventVerifierAssignment"("eventId", "verifierId", "zone");
CREATE INDEX IF NOT EXISTS "EventVerifierAssignment_verifierId_idx" ON "EventVerifierAssignment"("verifierId");

DO $$ BEGIN
  ALTER TABLE "EventVerifierAssignment" ADD CONSTRAINT "EventVerifierAssignment_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventVerifierAssignment" ADD CONSTRAINT "EventVerifierAssignment_verifierId_fkey"
    FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
