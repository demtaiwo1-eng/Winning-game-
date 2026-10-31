CREATE TABLE "ListingAvailability" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingAvailability_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ListingAvailability_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ListingAvailability_listingId_startsAt_endsAt_key"
  ON "ListingAvailability"("listingId", "startsAt", "endsAt");
CREATE INDEX "ListingAvailability_listingId_startsAt_endsAt_idx"
  ON "ListingAvailability"("listingId", "startsAt", "endsAt");
