-- Phase 3 Step 2: Cart + CheckoutSession
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('OPEN', 'PAYMENT_PENDING', 'PAID', 'EXPIRED', 'CANCELLED');

ALTER TABLE "PaymentIntent" ADD COLUMN "checkoutSessionId" TEXT;

CREATE TABLE "Cart" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartItem" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckoutSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cartId" TEXT,
  "eventId" TEXT,
  "currency" TEXT NOT NULL,
  "subtotalMinor" BIGINT NOT NULL,
  "commissionMinor" BIGINT NOT NULL DEFAULT 0,
  "totalMinor" BIGINT NOT NULL,
  "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'OPEN',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckoutItem" (
  "id" TEXT NOT NULL,
  "checkoutSessionId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPriceMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  CONSTRAINT "CheckoutItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Cart_userId_status_idx" ON "Cart"("userId", "status");
CREATE INDEX "Cart_eventId_idx" ON "Cart"("eventId");
CREATE UNIQUE INDEX "CartItem_cartId_listingId_key" ON "CartItem"("cartId", "listingId");
CREATE INDEX "CartItem_listingId_idx" ON "CartItem"("listingId");
CREATE INDEX "CheckoutSession_userId_status_idx" ON "CheckoutSession"("userId", "status");
CREATE INDEX "CheckoutSession_expiresAt_idx" ON "CheckoutSession"("expiresAt");
CREATE INDEX "CheckoutItem_checkoutSessionId_idx" ON "CheckoutItem"("checkoutSessionId");
CREATE INDEX "CheckoutItem_listingId_idx" ON "CheckoutItem"("listingId");
CREATE INDEX "PaymentIntent_checkoutSessionId_idx" ON "PaymentIntent"("checkoutSessionId");

ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckoutItem" ADD CONSTRAINT "CheckoutItem_checkoutSessionId_fkey"
  FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutItem" ADD CONSTRAINT "CheckoutItem_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckoutItem" ADD CONSTRAINT "CheckoutItem_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "VendorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_checkoutSessionId_fkey"
  FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
