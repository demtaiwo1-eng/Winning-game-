ALTER TABLE "Event" ADD COLUMN "clientRequestId" TEXT;

CREATE UNIQUE INDEX "Event_ownerId_clientRequestId_key"
ON "Event"("ownerId", "clientRequestId");
