ALTER TABLE "EventServiceCheck" ADD COLUMN "paymentRequestId" TEXT;

CREATE UNIQUE INDEX "EventServiceCheck_paymentRequestId_key" ON "EventServiceCheck"("paymentRequestId");

ALTER TABLE "EventServiceCheck"
ADD CONSTRAINT "EventServiceCheck_paymentRequestId_fkey"
FOREIGN KEY ("paymentRequestId") REFERENCES "BookingPaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
