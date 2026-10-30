-- Additive event guest check-in audit history. Existing Guest.checkedInAt fields remain intact.
CREATE TABLE "EventGuestCheckIn" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "checkedInById" TEXT NOT NULL,
    "method" "GuestCheckInMethod" NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventGuestCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventGuestCheckIn_eventId_checkedInAt_idx"
    ON "EventGuestCheckIn"("eventId", "checkedInAt");
CREATE INDEX "EventGuestCheckIn_guestId_checkedInAt_idx"
    ON "EventGuestCheckIn"("guestId", "checkedInAt");

ALTER TABLE "EventGuestCheckIn"
    ADD CONSTRAINT "EventGuestCheckIn_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventGuestCheckIn"
    ADD CONSTRAINT "EventGuestCheckIn_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventGuestCheckIn"
    ADD CONSTRAINT "EventGuestCheckIn_checkedInById_fkey"
    FOREIGN KEY ("checkedInById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
