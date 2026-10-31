CREATE TYPE "VendorEnquiryStatus" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED');

CREATE TABLE "VendorEnquiry" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "response" TEXT,
  "status" "VendorEnquiryStatus" NOT NULL DEFAULT 'OPEN',
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "responderId" TEXT,
  CONSTRAINT "VendorEnquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VendorEnquiry_vendorId_status_createdAt_idx" ON "VendorEnquiry"("vendorId", "status", "createdAt");
CREATE INDEX "VendorEnquiry_buyerId_createdAt_idx" ON "VendorEnquiry"("buyerId", "createdAt");
CREATE INDEX "VendorEnquiry_listingId_createdAt_idx" ON "VendorEnquiry"("listingId", "createdAt");

ALTER TABLE "VendorEnquiry" ADD CONSTRAINT "VendorEnquiry_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorEnquiry" ADD CONSTRAINT "VendorEnquiry_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorEnquiry" ADD CONSTRAINT "VendorEnquiry_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorEnquiry" ADD CONSTRAINT "VendorEnquiry_responderId_fkey"
  FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
