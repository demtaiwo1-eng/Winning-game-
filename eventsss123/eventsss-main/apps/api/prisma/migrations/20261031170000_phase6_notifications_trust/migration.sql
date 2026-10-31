CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'NOT_REQUESTED',
  'PENDING',
  'SENT',
  'FAILED',
  'NOT_CONFIGURED'
);

ALTER TABLE "Notification"
  ADD COLUMN "data" JSONB,
  ADD COLUMN "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "failureCode" TEXT;

CREATE TABLE "PushDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "messages" BOOLEAN NOT NULL DEFAULT true,
  "bookings" BOOLEAN NOT NULL DEFAULT true,
  "payments" BOOLEAN NOT NULL DEFAULT true,
  "marketing" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushDevice_tokenHash_key" ON "PushDevice"("tokenHash");
CREATE INDEX "PushDevice_userId_revokedAt_idx" ON "PushDevice"("userId", "revokedAt");
CREATE UNIQUE INDEX "PushPreference_userId_key" ON "PushPreference"("userId");
CREATE INDEX "Notification_userId_createdAt_id_idx" ON "Notification"("userId", "createdAt", "id");
CREATE INDEX "Message_eventId_createdAt_id_idx" ON "Message"("eventId", "createdAt", "id");
CREATE INDEX "Message_senderId_recipientId_createdAt_idx" ON "Message"("senderId", "recipientId", "createdAt");

ALTER TABLE "PushDevice"
  ADD CONSTRAINT "PushDevice_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushPreference"
  ADD CONSTRAINT "PushPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
