-- ESS Phase 7: guest check-in metadata for manual, NFC and Bluetooth-assisted entry.
CREATE TYPE "GuestCheckInMethod" AS ENUM ('MANUAL', 'NFC', 'BLUETOOTH');
ALTER TABLE "Guest" ADD COLUMN "checkedInAt" TIMESTAMP(3);
ALTER TABLE "Guest" ADD COLUMN "checkInMethod" "GuestCheckInMethod";
CREATE INDEX "Guest_eventId_checkedInAt_idx" ON "Guest"("eventId", "checkedInAt");
