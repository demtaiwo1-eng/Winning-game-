ALTER TABLE "EventServiceCheck" ADD COLUMN "taskId" TEXT;

CREATE UNIQUE INDEX "EventServiceCheck_taskId_key" ON "EventServiceCheck"("taskId");

ALTER TABLE "EventServiceCheck"
ADD CONSTRAINT "EventServiceCheck_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "EventTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
