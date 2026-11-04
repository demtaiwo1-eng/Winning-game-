ALTER TABLE "BookingPaymentRequest"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "BookingPaymentRequest_idempotencyKey_key"
ON "BookingPaymentRequest"("idempotencyKey");
