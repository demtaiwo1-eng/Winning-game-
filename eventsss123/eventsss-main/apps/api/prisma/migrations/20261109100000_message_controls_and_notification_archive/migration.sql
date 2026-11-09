-- Per-recipient message controls and notification archive support.
ALTER TABLE "Message"
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "recipientKind" TEXT NOT NULL DEFAULT 'TO',
  ADD COLUMN "toRecipientIds" JSONB,
  ADD COLUMN "ccRecipientIds" JSONB,
  ADD COLUMN "senderArchivedAt" TIMESTAMP(3),
  ADD COLUMN "recipientArchivedAt" TIMESTAMP(3),
  ADD COLUMN "senderDeletedAt" TIMESTAMP(3),
  ADD COLUMN "recipientDeletedAt" TIMESTAMP(3);

UPDATE "Message" SET "groupId" = gen_random_uuid()::text WHERE "groupId" IS NULL;
ALTER TABLE "Message" ALTER COLUMN "groupId" SET NOT NULL;

CREATE INDEX "Message_groupId_idx" ON "Message"("groupId");

ALTER TABLE "Notification" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Notification_userId_archivedAt_createdAt_idx" ON "Notification"("userId", "archivedAt", "createdAt");
