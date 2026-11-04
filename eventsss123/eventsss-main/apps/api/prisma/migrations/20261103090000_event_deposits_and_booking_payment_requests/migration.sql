ALTER TABLE "Booking"
ADD COLUMN "paidMinor" BIGINT NOT NULL DEFAULT 0;

-- Existing paid bookings already hold their full amount in escrow.
UPDATE "Booking"
SET "paidMinor" = "totalMinor"
WHERE "status" IN ('PAID', 'CONFIRMED', 'FULFILLED');

CREATE TABLE "EventDeposit" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "payerId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'HELD',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventDeposit_idempotencyKey_key"
ON "EventDeposit"("idempotencyKey");
CREATE INDEX "EventDeposit_eventId_createdAt_idx"
ON "EventDeposit"("eventId", "createdAt");
CREATE INDEX "EventDeposit_payerId_createdAt_idx"
ON "EventDeposit"("payerId", "createdAt");

ALTER TABLE "EventDeposit"
ADD CONSTRAINT "EventDeposit_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventDeposit"
ADD CONSTRAINT "EventDeposit_payerId_fkey"
FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BookingPaymentRequest" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingPaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingPaymentRequest_bookingId_status_idx"
ON "BookingPaymentRequest"("bookingId", "status");
CREATE INDEX "BookingPaymentRequest_requestedById_createdAt_idx"
ON "BookingPaymentRequest"("requestedById", "createdAt");

ALTER TABLE "BookingPaymentRequest"
ADD CONSTRAINT "BookingPaymentRequest_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingPaymentRequest"
ADD CONSTRAINT "BookingPaymentRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
