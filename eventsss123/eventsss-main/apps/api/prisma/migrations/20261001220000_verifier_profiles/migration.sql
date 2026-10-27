CREATE TABLE IF NOT EXISTS "VerifierProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "headline" TEXT,
  "bio" TEXT,
  "city" TEXT,
  "country" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "jobsCompleted" INTEGER NOT NULL DEFAULT 0,
  "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "specialties" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifierProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VerifierProfile_userId_key" ON "VerifierProfile"("userId");
CREATE INDEX IF NOT EXISTS "VerifierProfile_country_city_idx" ON "VerifierProfile"("country", "city");
CREATE INDEX IF NOT EXISTS "VerifierProfile_isAvailable_idx" ON "VerifierProfile"("isAvailable");
DO $$ BEGIN
  ALTER TABLE "VerifierProfile" ADD CONSTRAINT "VerifierProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "VerifierReview" (
  "id" TEXT NOT NULL,
  "verifierId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "eventId" TEXT,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerifierReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VerifierReview_verifierId_idx" ON "VerifierReview"("verifierId");
DO $$ BEGIN
  ALTER TABLE "VerifierReview" ADD CONSTRAINT "VerifierReview_verifierId_fkey"
    FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "VerifierReview" ADD CONSTRAINT "VerifierReview_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
