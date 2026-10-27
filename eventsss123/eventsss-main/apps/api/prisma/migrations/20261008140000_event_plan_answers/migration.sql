CREATE TABLE "EventPlanAnswer" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPlanAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventPlanAnswer_eventId_questionKey_key"
ON "EventPlanAnswer"("eventId", "questionKey");

CREATE INDEX "EventPlanAnswer_eventId_idx"
ON "EventPlanAnswer"("eventId");

ALTER TABLE "EventPlanAnswer"
ADD CONSTRAINT "EventPlanAnswer_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;