CREATE TABLE "MusicRightsOwner" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MusicRightsOwner_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MusicTrack" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "artist" TEXT NOT NULL,
  "assetUrl" TEXT NOT NULL,
  "rightsOwnerId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MusicTrack_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MusicPlaySession" (
  "id" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "userId" TEXT,
  "listenedSeconds" INTEGER NOT NULL,
  "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MusicPlaySession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MusicRevenueEntry" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "reference" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MusicRevenueEntry_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MusicRoyaltyStatement" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL,
  "grossRevenueMinor" BIGINT NOT NULL,
  "royaltyMinor" BIGINT NOT NULL,
  "shareRateBps" INTEGER NOT NULL DEFAULT 2500,
  "listenedSeconds" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MusicRoyaltyStatement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MusicRightsOwner_userId_key" ON "MusicRightsOwner"("userId");
CREATE UNIQUE INDEX "MusicTrack_key_key" ON "MusicTrack"("key");
CREATE INDEX "MusicTrack_rightsOwnerId_active_idx" ON "MusicTrack"("rightsOwnerId", "active");
CREATE INDEX "MusicPlaySession_trackId_playedAt_idx" ON "MusicPlaySession"("trackId", "playedAt");
CREATE INDEX "MusicPlaySession_userId_playedAt_idx" ON "MusicPlaySession"("userId", "playedAt");
CREATE UNIQUE INDEX "MusicRevenueEntry_reference_key" ON "MusicRevenueEntry"("reference");
CREATE INDEX "MusicRevenueEntry_currency_periodStart_periodEnd_idx" ON "MusicRevenueEntry"("currency", "periodStart", "periodEnd");
CREATE UNIQUE INDEX "MusicRoyaltyStatement_ownerId_periodStart_periodEnd_currency_key" ON "MusicRoyaltyStatement"("ownerId", "periodStart", "periodEnd", "currency");
CREATE INDEX "MusicRoyaltyStatement_ownerId_periodStart_idx" ON "MusicRoyaltyStatement"("ownerId", "periodStart");
ALTER TABLE "MusicRightsOwner" ADD CONSTRAINT "MusicRightsOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_rightsOwnerId_fkey" FOREIGN KEY ("rightsOwnerId") REFERENCES "MusicRightsOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MusicPlaySession" ADD CONSTRAINT "MusicPlaySession_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "MusicTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MusicRoyaltyStatement" ADD CONSTRAINT "MusicRoyaltyStatement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MusicRightsOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "MusicTrack" ("id","key","title","artist","assetUrl","updatedAt") VALUES (md5('ephinta-music-track:here-we-are-1'),'here-we-are-1','Here we are — 1','Wale Waves','/audio/Here%20we%20are-1%20-Wale%20Waves_ESS_Wedding.mp3',CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "MusicTrack" ("id","key","title","artist","assetUrl","updatedAt") VALUES (md5('ephinta-music-track:here-we-are-2'),'here-we-are-2','Here we are — 2','Wale Waves','/audio/Here%20we%20are-2%20-Wale%20Waves_ESS_Wedding.mp3',CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "MusicTrack" ("id","key","title","artist","assetUrl","updatedAt") VALUES (md5('ephinta-music-track:welcome-little-one-1'),'welcome-little-one-1','Welcome, Little One — 1','Wale Waves','/audio/Welcome,%20Little%20One-1-Wale%20Waves_ESS_Naming.mp3',CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "MusicTrack" ("id","key","title","artist","assetUrl","updatedAt") VALUES (md5('ephinta-music-track:welcome-little-one-2'),'welcome-little-one-2','Welcome, Little One — 2','Wale Waves','/audio/Welcome,%20Little%20One-2-Wale%20Waves_ESS_Naming.mp3',CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "MusicTrack" ("id","key","title","artist","assetUrl","updatedAt") VALUES (md5('ephinta-music-track:you-will-live-1'),'you-will-live-1','You Will Live in Our Hearts — 1','Wale Waves','/audio/You%20Will%20Live%20in%20Our%20Hearts-1-Wale%20Waves_ESS_Burials.mp3',CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "MusicTrack" ("id","key","title","artist","assetUrl","updatedAt") VALUES (md5('ephinta-music-track:you-will-live-2'),'you-will-live-2','You Will Live in Our Hearts — 2','Wale Waves','/audio/You%20Will%20Live%20in%20Our%20Hearts-2-Wale%20Waves_ESS_Burials.mp3',CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING;
