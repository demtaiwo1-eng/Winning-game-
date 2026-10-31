CREATE TABLE "PaymentProviderThrottle" (
  "provider" TEXT NOT NULL,
  "nextAllowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentProviderThrottle_pkey" PRIMARY KEY ("provider")
);
