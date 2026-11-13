CREATE TABLE "PlatformRuntimeSetting" (
  "id" TEXT NOT NULL,
  "paymentMode" TEXT NOT NULL DEFAULT 'test',
  "changedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformRuntimeSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformRuntimeSetting_paymentMode_check" CHECK ("paymentMode" IN ('demo', 'test', 'live'))
);

INSERT INTO "PlatformRuntimeSetting" ("id", "paymentMode", "updatedAt")
VALUES ('global', 'test', CURRENT_TIMESTAMP);
