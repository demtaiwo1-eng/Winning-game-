/**
 * Multi-provider payment port (Paystack / Flutterwave / Stripe-ready).
 * Demo mode completes immediately; webhook endpoint mirrors production.
 */
import { Router } from "express";
import {
  BookingStatus,
  LedgerType,
  ListingStatus,
  PaymentStatus,
  Prisma,
  type BookingPaymentRequest,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { bookingCommissionMinor, walletTopupFeeMinor } from "./feePolicy";
import { env } from "../../config/env";
import {
  initializeFlutterwave,
  initializeOpay,
  initializePaystack,
  initializeStripe,
  selectProvider,
  getPaymentMode,
  canCompleteDemoCheckout,
  verifyFlutterwave,
  verifyPaystack,
  verifyStripe,
  verifyOpay,
  getOpayWebhookSecret,
} from "./providers";
import { releaseBookingEscrow } from "./escrow.service";
import { recordPlatformRevenue } from "./platformRevenue.service";
import { payoutsRouter } from "./payouts.routes";
import { paymentModeGuard, lockCurrentPaymentMode } from "./runtimePaymentMode";
import { reconciliationBackoffMs, reconciliationErrorCode, RECONCILIATION_LOCK_MS, RECONCILIATION_MAX_ATTEMPTS, RECONCILIATION_PROVIDER_MAX_WAIT_MS, RECONCILIATION_PROVIDER_MIN_INTERVAL_MS, reconciliationProviderNextAllowedAt } from "./reconciliationPolicy";
import {
  assertVerifiedPayment,
  verifyPaystackSignature,
  verifyPaystackWebhookSignature,
  verifyFlutterwaveSignature,
  verifyStripeSignature,
  verifyOpayCallbackSignature,
} from "./webhookVerification";


export const paymentsRouter = Router();
paymentsRouter.use(paymentModeGuard);
paymentsRouter.use(payoutsRouter);

logger.info({
  opayMerchantConfigured: Boolean(env.OPAY_TEST_MERCHANT_ID || env.OPAY_MERCHANT_ID),
  opayPublicKeyConfigured: Boolean(env.OPAY_TEST_PUBLIC_KEY || env.OPAY_PUBLIC_KEY),
  opaySecretConfigured: Boolean(env.OPAY_TEST_SECRET_KEY || env.OPAY_SECRET_KEY),
  opayTransfersEnabled: env.OPAY_TRANSFERS_ENABLED === "true",
  paymentMode: getPaymentMode(),
}, "OPay bank transfer configuration readiness");


/** Create payment intent to fund wallet */
paymentsRouter.post(
  "/intents",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currency = String(req.body.currency || "NGN").toUpperCase();
    if (!["NGN", "GHS"].includes(currency)) {
      throw new HttpError(400, "UNSUPPORTED_CURRENCY", "Currently supported payment currencies are NGN and GHS");
    }
    const purpose = String(req.body.purpose || "WALLET_DEPOSIT");
    if (purpose !== "WALLET_DEPOSIT") {
      throw new HttpError(400, "UNSUPPORTED_PAYMENT_PURPOSE", "Only WALLET_DEPOSIT is supported");
    }
    const amountRaw = String(req.body.amountMinor ?? "");
    if (!/^[1-9]\d*$/.test(amountRaw)) {
      throw new HttpError(400, "INVALID_AMOUNT", "amountMinor must be a positive whole number");
    }
    const amountMinor = BigInt(amountRaw);
    if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new HttpError(400, "INVALID_AMOUNT", "amountMinor exceeds the supported payment-provider limit");
    }
    if (amountMinor <= 0n) throw new HttpError(400, "INVALID_AMOUNT", "amountMinor must be > 0");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const provider = selectProvider(currency, req.body.country || user.country || undefined);
    const reference = `${provider}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    // Persist the in-flight transaction before contacting OPay. The admin mode
    // switch refuses to proceed while this intent is pending.
    const pendingIntent = await prisma.$transaction(async (tx) => {
      await lockCurrentPaymentMode(tx);
      return tx.paymentIntent.create({
      data: {
        userId: req.user!.id,
        provider,
        amountMinor,
        currency,
        status: PaymentStatus.PENDING,
        purpose,
        providerRef: reference,
      },
      });
    });
    const callbackUrl = new URL(
      `/dashboard/${user.role.toLowerCase()}?tab=wallet&payment=return`,
      env.APP_BASE_URL,
    ).toString();

    let init: { provider: string; providerRef: string; authorizationUrl?: string; mode: string };
    try {
    if (provider === "paystack") {
      init = await initializePaystack({
        email: user.email,
        amountMinor,
        currency,
        reference,
        callbackUrl,
        metadata: { userId: user.id, purpose: "WALLET_DEPOSIT" },
      });
    } else if (provider === "flutterwave") {
      init = await initializeFlutterwave({
        email: user.email,
        name: user.name,
        amountMinor,
        currency,
        reference,
        redirectUrl: callbackUrl,
      });
    } else if (provider === "opay") {
      init = await initializeOpay({
        amountMinor,
        currency,
        reference,
        callbackUrl,
        notifyUrl: env.API_BASE_URL
          ? new URL("/api/v1/payments/webhooks/opay", env.API_BASE_URL).toString()
          : undefined,
      });
    } else if (provider === "stripe") {
      init = await initializeStripe({
        email: user.email,
        amountMinor,
        currency,
        reference,
        successUrl: callbackUrl,
        cancelUrl: callbackUrl,
      });
    } else {
      init = { provider: "demo", providerRef: reference, mode: "demo" };
    }
    } catch (error) {
      // Keep the intent pending on ambiguous provider failures/timeouts. An
      // operator must reconcile it before the global mode can change.
      throw error;
    }

    if (init.authorizationUrl) {
      let checkout: URL;
      try {
        checkout = new URL(init.authorizationUrl || "");
      } catch {
        throw new HttpError(502, "INVALID_PROVIDER_CHECKOUT", "Payment provider returned an invalid checkout URL");
      }
      if (checkout.protocol !== "https:") {
        throw new HttpError(502, "INVALID_PROVIDER_CHECKOUT", "Payment provider checkout must use HTTPS");
      }
    }

    const intent = await prisma.paymentIntent.update({
      where: { id: pendingIntent.id },
      data: { provider: init.provider, providerRef: init.providerRef },
    });

    const checkoutUrl =
      init.authorizationUrl || `/api/v1/payments/demo-checkout/${intent.id}`;

    res.status(201).json({
      intent: {
        id: intent.id,
        provider: intent.provider,
        amountMinor: intent.amountMinor.toString(),
        currency: intent.currency,
        status: intent.status,
        providerRef: intent.providerRef,
        purpose: intent.purpose,
      },
      checkoutUrl,
      mode: init.mode,
      paymentMode: getPaymentMode(),
      message: init.authorizationUrl
        ? `Redirect customer to checkoutUrl (${init.provider}); this is ${init.mode} checkout. The verified webhook credits the wallet.`
        : `Demo mode. POST ${checkoutUrl} to simulate checkout.`,
    });
  }),
);

/** Demo checkout — marks intent succeeded and credits wallet */
paymentsRouter.post(
  "/demo-checkout/:intentId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const intent = await prisma.paymentIntent.findFirst({
      where: { id: req.params.intentId, userId: req.user!.id },
    });
    if (!intent) throw new HttpError(404, "NOT_FOUND", "Payment intent not found");
    if (intent.status === PaymentStatus.SUCCEEDED) {
      return res.json({ status: "already_succeeded", intentId: intent.id });
    }
    if (!canCompleteDemoCheckout(intent.provider, intent.status)) {
      throw new HttpError(403, "DEMO_CHECKOUT_DISABLED", "Only pending demo payment intents can use simulated checkout");
    }

    await applySuccessfulPayment(intent.id, intent.providerRef || intent.id);
    res.json({ status: "succeeded", intentId: intent.id });
  }),
);

function verifyWebhookSignature(provider: string, req: import("express").Request) {
  const rawBody = (req as import("express").Request & { rawBody?: Buffer }).rawBody;
  if (provider === "opay") {
    const opayWebhookSecret = getOpayWebhookSecret();
    if (!opayWebhookSecret) throw new HttpError(503, "WEBHOOK_SECRET_MISSING", "OPay webhook verification is not configured for the selected mode");
    const payload = req.body?.payload;
    const received = String(req.body?.sha512 || "");
    if (req.body?.type !== "transaction-status" ||
        !verifyOpayCallbackSignature(payload || {}, received, opayWebhookSecret)) {
      throw new HttpError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid OPay webhook signature");
    }
    return;
  }
  if (!rawBody) throw new HttpError(400, "RAW_BODY_MISSING", "Webhook raw body is unavailable");
  if (provider === "paystack") {
    const timestampedSignature = String(req.headers["paystack-signature"] || "");
    if (timestampedSignature && env.PAYSTACK_WEBHOOK_SECRET) {
      if (!verifyPaystackWebhookSignature(rawBody, timestampedSignature, env.PAYSTACK_WEBHOOK_SECRET)) {
        throw new HttpError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid Paystack webhook signature");
      }
      return;
    }
    // During migration, Paystack can send both headers. If the dedicated
    // whsec_ secret has not yet been installed, retain the documented legacy
    // signature check rather than rejecting a valid dual-signed delivery.
    if (timestampedSignature && !env.PAYSTACK_WEBHOOK_SECRET && !req.headers["x-paystack-signature"]) {
      throw new HttpError(503, "WEBHOOK_SECRET_MISSING", "Paystack webhook signing secret is not configured");
    }
    // Backward compatibility for integrations that have not enabled the
    // dedicated whsec_ signing secret yet.
    if (!env.PAYSTACK_SECRET_KEY) throw new HttpError(503, "WEBHOOK_SECRET_MISSING", "Paystack webhook verification is not configured");
    const legacySignature = String(req.headers["x-paystack-signature"] || "");
    if (!verifyPaystackSignature(rawBody, legacySignature, env.PAYSTACK_SECRET_KEY)) {
      throw new HttpError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid Paystack webhook signature");
    }
    return;
  }
  const secret = provider === "flutterwave" ? env.FLUTTERWAVE_SECRET_KEY : env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, "WEBHOOK_SECRET_MISSING", "Webhook verification is not configured");
  if (provider === "flutterwave") {
    const received = String(req.headers["verif-hash"] || "");
    if (!verifyFlutterwaveSignature(received, secret)) throw new HttpError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid Flutterwave webhook signature");
  } else {
    const received = String(req.headers["stripe-signature"] || "");
    if (!verifyStripeSignature(rawBody, received, secret)) throw new HttpError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid Stripe webhook signature");
  }
}

/** Provider webhooks (Paystack / Flutterwave / Stripe shape simplified) */
paymentsRouter.post(
  "/webhooks/:provider",
  asyncHandler(async (req, res) => {
    const provider = (req.params.provider as string).toLowerCase();
    if (!["paystack", "flutterwave", "stripe", "opay"].includes(provider)) throw new HttpError(404, "UNKNOWN_PROVIDER", "Unsupported payment provider");
    verifyWebhookSignature(provider, req);

    // Paystack endpoint health checks are signed ping events, not payments.
    if (provider === "paystack" && String(req.body?.event || "") === "ping") {
      return res.json({ ok: true, ping: true });
    }

    // OPay sends notifications for pending, failed and successful transactions.
    // Acknowledge non-success/refund events without attempting settlement.
    if (
      provider === "opay" &&
      (req.body?.payload?.status !== "SUCCESS" || req.body?.payload?.refunded === true)
    ) {
      return res.json({ ok: true, ignored: true });
    }

    // Ignore unrelated Stripe events; only completed Checkout Sessions
    // are eligible to trigger payment verification and settlement.
    if (
      provider === "stripe" &&
      ![
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(String(req.body?.type || ""))
    ) {
      return res.json({ ok: true, ignored: true });
    }

    const data = req.body?.data;
    const providerRef = String(
      provider === "opay"
        ? req.body?.payload?.reference || ""
        : provider === "flutterwave"
          ? data?.tx_ref || ""
          : provider === "stripe"
            ? data?.object?.id || ""
            : data?.reference || ""
    );
    const transactionId = String(
      provider === "opay"
        ? req.body?.payload?.transactionId || providerRef
        : provider === "flutterwave" ? data?.id || "" : providerRef
    );
    if (!providerRef || !transactionId) throw new HttpError(400, "INVALID", "A provider transaction reference is required");
    const eventId = String(req.body?.id || `${provider}:${transactionId}`);

    const existing = await prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId } },
    });
    if (existing?.processedAt) {
      return res.json({ ok: true, replayed: true });
    }

    const intent = await prisma.paymentIntent.findFirst({
      where: { providerRef, provider },
    });
    if (!intent) throw new HttpError(404, "PAYMENT_INTENT_NOT_FOUND", "No payment matches this provider reference");

    if (provider === "opay") {
      const verification = await verifyOpay(providerRef);
      assertVerifiedPayment(verification, intent, providerRef);
    } else if (provider === "paystack") {
      const verification = await verifyPaystack(providerRef);
      assertVerifiedPayment(verification, intent, providerRef);
    } else if (provider === "flutterwave") {
      const verification = await verifyFlutterwave(transactionId);
      assertVerifiedPayment({ ...verification, reference: verification.txRef }, intent, providerRef);
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { providerTransactionId: transactionId },
      });
    } else {
      const verification = await verifyStripe(transactionId);
      assertVerifiedPayment({ ...verification, reference: verification.sessionId }, intent, providerRef);
    }

    await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider, eventId } },
      create: { provider, eventId, payload: req.body },
      update: { payload: req.body },
    });

    if (intent && intent.status !== PaymentStatus.SUCCEEDED) {
      await applySuccessfulPayment(intent.id, providerRef);
    }

    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { processedAt: new Date() },
    });

    res.json({ ok: true });
  }),
);

async function applySuccessfulPayment(intentId: string, providerRef: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Atomically claim only a pending intent. Concurrent webhook deliveries
    // for the same intent cannot both claim and credit it.
    const claim = await tx.paymentIntent.updateMany({
      where: {
        id: intentId,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.SUCCEEDED,
        providerRef,
      },
    });

    if (claim.count !== 1) {
      // Already processed, or no longer pending.
      return false;
    }

    const intent = await tx.paymentIntent.findUniqueOrThrow({
      where: { id: intentId },
    });
    if (intent.purpose !== "WALLET_DEPOSIT") {
      throw new HttpError(400, "UNSUPPORTED_PAYMENT_PURPOSE", "This payment purpose cannot be settled");
    }

    if (intent.purpose === "WALLET_DEPOSIT") {
      const wallet = await tx.wallet.upsert({
        where: {
          userId_currency: {
            userId: intent.userId,
            currency: intent.currency,
          },
        },
        create: {
          userId: intent.userId,
          currency: intent.currency,
          availableMinor: 0n,
          escrowMinor: 0n,
        },
        update: {},
      });

      // Apply the configured platform fee to incoming wallet funding.
      // The provider collects the gross amount; only the net amount is
      // credited to the customer wallet. Both ledger rows commit atomically.
      const feeMinor = walletTopupFeeMinor(intent.amountMinor, env);
      const creditedMinor = intent.amountMinor - feeMinor;
      if (creditedMinor <= 0n) {
        throw new HttpError(400, "PAYMENT_TOO_SMALL", "Payment amount is too small after the platform fee");
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableMinor: { increment: creditedMinor } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.DEPOSIT,
          amountMinor: creditedMinor,
          balanceAfterMinor: updatedWallet.availableMinor,
          refType: "PAYMENT_INTENT",
          refId: intentId,
          idempotencyKey: `pay_deposit:${intentId}`,
        },
      });
      if (feeMinor > 0n) {
        await recordPlatformRevenue(tx, {
          amountMinor: feeMinor,
          currency: intent.currency,
          refType: "PAYMENT_INTENT",
          refId: intentId,
          idempotencyKey: `platform_wallet_topup_fee:${intentId}`,
        });
      }
    }
    return true;
  });
}
async function reserveReconciliationProviderSlot(provider: string): Promise<boolean> {
  await prisma.paymentProviderThrottle.upsert({
    where: { provider },
    update: {},
    create: { provider, nextAllowedAt: new Date(0) },
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < RECONCILIATION_PROVIDER_MAX_WAIT_MS) {
    const now = new Date();
    const reserved = await prisma.paymentProviderThrottle.updateMany({
      where: { provider, nextAllowedAt: { lte: now } },
      data: { nextAllowedAt: reconciliationProviderNextAllowedAt(now.getTime()) },
    });
    if (reserved.count === 1) return true;

    const throttle = await prisma.paymentProviderThrottle.findUnique({
      where: { provider },
      select: { nextAllowedAt: true },
    });
    const remaining = RECONCILIATION_PROVIDER_MAX_WAIT_MS - (Date.now() - startedAt);
    const waitMs = Math.max(1, Math.min(remaining, throttle
      ? throttle.nextAllowedAt.getTime() - Date.now()
      : RECONCILIATION_PROVIDER_MIN_INTERVAL_MS));
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
  return false;
}

export async function reconcilePendingPayments(batchSize = 50) {
  const now = new Date();
  const eligibleWhere = {
    status: PaymentStatus.PENDING,
    providerRef: { not: null },
    provider: { in: ["paystack", "flutterwave", "stripe", "opay"] },
    reconciliationDeadLetteredAt: null,
    AND: [
      { OR: [{ reconciliationNextAttemptAt: null }, { reconciliationNextAttemptAt: { lte: now } }] },
      { OR: [{ reconciliationLockedUntil: null }, { reconciliationLockedUntil: { lt: now } }] },
    ],
  };
  const candidates = await prisma.paymentIntent.findMany({
    where: eligibleWhere,
    take: Math.max(1, Math.min(batchSize, 100)),
    orderBy: [{ reconciliationNextAttemptAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, provider: true },
  });

  let reconciled = 0;
  let retried = 0;
  let deadLettered = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const providerSlotReserved = await reserveReconciliationProviderSlot(candidate.provider);
    if (!providerSlotReserved) {
      skipped += 1;
      continue;
    }
    const lockToken = randomUUID();
    const lockedUntil = new Date(Date.now() + RECONCILIATION_LOCK_MS);
    const claim = await prisma.paymentIntent.updateMany({
      where: {
        id: candidate.id,
        status: PaymentStatus.PENDING,
        providerRef: { not: null },
        reconciliationDeadLetteredAt: null,
        AND: [
          { OR: [{ reconciliationNextAttemptAt: null }, { reconciliationNextAttemptAt: { lte: new Date() } }] },
          { OR: [{ reconciliationLockedUntil: null }, { reconciliationLockedUntil: { lt: new Date() } }] },
        ],
      },
      data: { reconciliationLockToken: lockToken, reconciliationLockedUntil: lockedUntil },
    });
    if (claim.count !== 1) {
      skipped += 1;
      continue;
    }

    const intent = await prisma.paymentIntent.findFirst({
      where: { id: candidate.id, reconciliationLockToken: lockToken },
    });
    if (!intent || !intent.providerRef) {
      skipped += 1;
      continue;
    }

    try {
      const reference = intent.providerRef;
      if (intent.provider === "opay") {
        const verification = await verifyOpay(reference);
        assertVerifiedPayment(verification, intent, reference);
      } else if (intent.provider === "paystack") {
        const verification = await verifyPaystack(reference);
        assertVerifiedPayment(verification, intent, reference);
      } else if (intent.provider === "flutterwave") {
        const transactionId = intent.providerTransactionId;
        if (!transactionId) {
          throw new Error("FlutterwaveTransactionIdUnavailable");
        }
        const verification = await verifyFlutterwave(transactionId);
        assertVerifiedPayment({ ...verification, reference: verification.txRef }, intent, reference);
      } else if (intent.provider === "stripe") {
        const verification = await verifyStripe(reference);
        assertVerifiedPayment({ ...verification, reference: verification.sessionId }, intent, reference);
      } else {
        throw new Error("UnsupportedReconciliationProvider");
      }

      const settled = await applySuccessfulPayment(intent.id, reference);
      if (settled) reconciled += 1;
      await prisma.paymentIntent.updateMany({
        where: { id: intent.id, reconciliationLockToken: lockToken },
        data: {
          reconciliationLockToken: null,
          reconciliationLockedUntil: null,
          reconciliationLastError: null,
          reconciliationNextAttemptAt: null,
        },
      });
    } catch (error) {
      const attempts = intent.reconciliationAttempts + 1;
      const isDeadLetter = attempts >= RECONCILIATION_MAX_ATTEMPTS;
      const retryAt = isDeadLetter
        ? null
        : new Date(Date.now() + reconciliationBackoffMs(attempts));
      const update = await prisma.paymentIntent.updateMany({
        where: { id: intent.id, reconciliationLockToken: lockToken, status: PaymentStatus.PENDING },
        data: {
          reconciliationAttempts: attempts,
          reconciliationNextAttemptAt: retryAt,
          reconciliationLastError: reconciliationErrorCode(error),
          reconciliationDeadLetteredAt: isDeadLetter ? new Date() : null,
          reconciliationLockToken: null,
          reconciliationLockedUntil: null,
        },
      });
      if (update.count === 1) {
        if (isDeadLetter) deadLettered += 1;
        else retried += 1;
      }
      logger.warn(
        { paymentIntentId: intent.id, provider: intent.provider, attempt: attempts, deadLettered: isDeadLetter },
        "Pending payment reconciliation verification did not complete",
      );
    }
  }

  return { scanned: candidates.length, reconciled, retried, deadLettered, skipped };
}

/**
 * Book a listing: hold funds in escrow + create booking.
 * Requires sufficient available balance.
 */
paymentsRouter.post(
  "/book",
  requireAuth,
  asyncHandler(async (req, res) => {
    const listingId = String(req.body.listingId || "");
    const quantity = Math.max(1, Number(req.body.quantity) || 1);
    const eventId = typeof req.body.eventId === "string" ? req.body.eventId : null;
    if (!eventId) {
      throw new HttpError(400, "EVENT_REQUIRED", "Bookings must be linked to an event with an assigned verifier");
    }
    const event = await prisma.event.findFirst({
      where: { id: eventId, ownerId: req.user!.id },
      include: { readiness: { select: { assignedVerifierId: true } } },
    });
    if (!event) throw new HttpError(404, "NOT_FOUND", "Event not found");
    if (event.status === "COMPLETED" || event.status === "CANCELLED") {
      throw new HttpError(409, "INVALID_EVENT_STATE", "Cannot book services for a completed or cancelled event");
    }
    if (!event.readiness?.assignedVerifierId) {
      throw new HttpError(409, "VERIFIER_REQUIRED", "Select a lead verifier before booking services");
    }

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, status: ListingStatus.ACTIVE },
      include: { vendor: true },
    });
    if (!listing) throw new HttpError(404, "NOT_FOUND", "Listing not found or not active");

    const subtotal = listing.priceMinor * BigInt(quantity);
    const commission = bookingCommissionMinor(subtotal, env);
    const total = subtotal;
    const initialPaymentRaw = req.body.initialPaymentMinor === undefined
      ? total.toString()
      : String(req.body.initialPaymentMinor);
    if (!/^[1-9]\d*$/.test(initialPaymentRaw)) {
      throw new HttpError(400, "INVALID_INITIAL_PAYMENT", "initialPaymentMinor must be a positive whole number");
    }
    const initialPayment = BigInt(initialPaymentRaw);
    if (initialPayment > total) {
      throw new HttpError(400, "INVALID_INITIAL_PAYMENT", "Initial payment cannot exceed the booking total");
    }
    const currency = listing.currency;
    const idempotencyKey =
      typeof req.body.idempotencyKey === "string"
        ? req.body.idempotencyKey
        : `book:${req.user!.id}:${listingId}:${randomUUID()}`;

    const result = await prisma.$transaction(async (tx) => {
      const existingLedger = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
      if (existingLedger) {
        const existingBooking = existingLedger.refType === "BOOKING" && existingLedger.refId
          ? await tx.booking.findFirst({
              where: { id: existingLedger.refId, buyerId: req.user!.id, eventId, items: { some: { listingId } } },
              include: { items: true },
            })
          : null;
        if (existingBooking) {
          if (existingBooking.totalMinor === total && existingBooking.paidMinor === initialPayment) return existingBooking;
          throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "This booking key was reused with different payment details");
        }
        throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "This booking key was already used for another operation");
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency } },
      });
      if (!wallet || wallet.availableMinor < initialPayment) {
        throw new HttpError(
          400,
          "INSUFFICIENT_FUNDS",
          `Need ${initialPayment.toString()} ${currency} available for the initial payment. Deposit via /payments/intents first.`,
        );
      }

      const booking = await tx.booking.create({
        data: {
          buyerId: req.user!.id,
          vendorId: listing.vendorId,
          eventId,
          status: initialPayment === total ? BookingStatus.PAID : BookingStatus.PENDING,
          currency,
          subtotalMinor: subtotal,
          commissionMinor: commission,
          totalMinor: total,
          paidMinor: initialPayment,
          notes: typeof req.body.notes === "string" ? req.body.notes : null,
          items: {
            create: {
              listingId: listing.id,
              quantity,
              unitPriceMinor: listing.priceMinor,
            },
          },
        },
        include: { items: true },
      });

      const newAvailable = wallet.availableMinor - initialPayment;
      const newEscrow = wallet.escrowMinor + initialPayment;
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.ESCROW_HOLD,
          amountMinor: initialPayment,
          balanceAfterMinor: newAvailable,
          refType: "BOOKING",
          refId: booking.id,
          idempotencyKey,
        },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableMinor: newAvailable, escrowMinor: newEscrow },
      });

      return booking;
    });

    // Only fully funded bookings enter the service-verification and completion workflow.
    if (eventId && initialPayment === total) {
      try {
        for (const item of result.items) {
          const listing = await prisma.listing.findUnique({ where: { id: item.listingId } });
          const exists = await prisma.eventServiceCheck.findFirst({
            where: { eventId, bookingId: result.id, listingId: item.listingId },
          });
          if (!exists) {
            await prisma.eventServiceCheck.create({
              data: {
                eventId,
                bookingId: result.id,
                listingId: item.listingId,
                label: listing?.title || "Booked service",
                category: listing?.type || "SERVICE",
                status: "PENDING",
              },
            });
          }
        }
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        const checks = await prisma.eventServiceCheck.findMany({ where: { eventId } });
        const startsAt = event?.startsAt || null;
        const windowOpensAt = startsAt
          ? new Date(startsAt.getTime() - 6 * 60 * 60 * 1000)
          : null;
        const greenDeadlineAt = startsAt
          ? new Date(startsAt.getTime() - 2 * 60 * 60 * 1000)
          : null;
        const green = checks.filter((c) => c.status === "GREEN").length;
        const amber = checks.filter((c) => c.status === "AMBER").length;
        const red = checks.filter((c) => c.status === "RED").length;
        const pending = checks.filter((c) => c.status === "PENDING").length;
        await prisma.eventReadiness.upsert({
          where: { eventId },
          create: {
            eventId,
            status: checks.length === 0 ? "NOT_STARTED" : "IN_PROGRESS",
            totalChecks: checks.length,
            greenCount: green,
            amberCount: amber,
            redCount: red,
            pendingCount: pending,
            windowOpensAt,
            greenDeadlineAt,
            startsAt,
          },
          update: {
            totalChecks: checks.length,
            greenCount: green,
            amberCount: amber,
            redCount: red,
            pendingCount: pending,
            windowOpensAt,
            greenDeadlineAt,
            startsAt,
            status: red > 0 ? "BLOCKED" : green === checks.length && checks.length > 0 ? "ALL_GREEN" : "IN_PROGRESS",
          },
        });
      } catch {
        // non-fatal
      }
    }

    res.status(201).json({
      booking: {
        ...result,
        subtotalMinor: result.subtotalMinor.toString(),
        commissionMinor: result.commissionMinor.toString(),
        totalMinor: result.totalMinor.toString(),
        paidMinor: result.paidMinor.toString(),
        items: result.items.map((i) => ({
          ...i,
          unitPriceMinor: i.unitPriceMinor.toString(),
        })),
      },
      message:
        initialPayment === total
          ? "Full booking payment held in platform-controlled escrow. The assigned lead verifier can authorize release only after the event ends and all service checks are green."
          : "Initial payment held in escrow. Vendors may request further milestone payments for planner approval; service verification begins when the booking is fully paid.",
    });
  }),
);


/** Vendor requests a milestone/essentials payment; planner must approve it. */
paymentsRouter.post(
  "/bookings/:id/payment-requests",
  requireAuth,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const amountRaw = String(req.body.amountMinor ?? "");
    const reason = String(req.body.reason ?? "").trim();
    if (!/^[1-9]\d*$/.test(amountRaw)) throw new HttpError(400, "INVALID_AMOUNT", "amountMinor must be a positive whole number");
    if (reason.length < 8 || reason.length > 500) throw new HttpError(400, "INVALID_REASON", "Explain the requested essentials or milestone (8–500 characters)");
    const amountMinor = BigInt(amountRaw);
    const suppliedKey = req.body.idempotencyKey;
    if (typeof suppliedKey !== "string" || suppliedKey.length < 8 || suppliedKey.length > 100) {
      throw new HttpError(400, "INVALID_IDEMPOTENCY_KEY", "A unique idempotencyKey of 8–100 characters is required");
    }
    const idempotencyKey = `booking-payment-request:${req.user!.id}:${req.params.id}:${suppliedKey}`;
    const replay = (existing: BookingPaymentRequest) => {
      if (
        existing.bookingId !== req.params.id ||
        existing.requestedById !== req.user!.id ||
        existing.amountMinor !== amountMinor ||
        existing.reason !== reason
      ) {
        throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "This request key was already used with different payment details");
      }
      return { request: existing, alreadyProcessed: true };
    };

    let outcome: { request: BookingPaymentRequest; alreadyProcessed: boolean };
    try {
      outcome = await prisma.$transaction(async (tx) => {
        const existing = await tx.bookingPaymentRequest.findUnique({ where: { idempotencyKey } });
        if (existing) return replay(existing);
        const booking = await tx.booking.findUnique({
          where: { id: req.params.id },
          include: { vendor: { select: { userId: true } } },
        });
        if (!booking) throw new HttpError(404, "NOT_FOUND", "Booking not found");
        if (booking.vendor.userId !== req.user!.id) throw new HttpError(403, "FORBIDDEN", "Only the assigned vendor can request a booking payment");
        if (!booking.eventId || ["CANCELLED", "REFUNDED", "FULFILLED"].includes(booking.status)) {
          throw new HttpError(409, "BOOKING_NOT_PAYABLE", "This booking cannot accept further payment requests");
        }
        const pending = await tx.bookingPaymentRequest.aggregate({
          where: { bookingId: booking.id, status: "PENDING" },
          _sum: { amountMinor: true },
        });
        const remaining = booking.totalMinor - booking.paidMinor - (pending._sum.amountMinor ?? 0n);
        if (amountMinor > remaining) throw new HttpError(409, "AMOUNT_EXCEEDS_REMAINING", "Requested amount exceeds the unpaid booking balance");
        const request = await tx.bookingPaymentRequest.create({
          data: { bookingId: booking.id, requestedById: req.user!.id, amountMinor, reason, idempotencyKey },
        });
        return { request, alreadyProcessed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
      if (code === "P2002" || code === "P2034") {
        // A serializable transaction can lose a race to an identical request.
        // The winning transaction may still be committing when PostgreSQL
        // reports P2034, so an immediate lookup can incorrectly miss it.
        // Briefly re-read the idempotency key before reporting a conflict.
        const retryDelays = code === "P2034" ? [10, 25, 50, 100] : [0];
        for (const delayMs of retryDelays) {
          if (delayMs > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
          }
          const existing = await prisma.bookingPaymentRequest.findUnique({ where: { idempotencyKey } });
          if (existing) {
            const result = replay(existing);
            return res.status(200).json({
              request: { ...result.request, amountMinor: result.request.amountMinor.toString() },
              alreadyProcessed: true,
            });
          }
        }
        if (code === "P2034") {
          throw new HttpError(409, "BOOKING_BALANCE_CHANGED", "Another payment request was submitted at the same time. Refresh the booking and try again.");
        }
      }
      throw error;
    }
    res.status(outcome.alreadyProcessed ? 200 : 201).json({
      request: { ...outcome.request, amountMinor: outcome.request.amountMinor.toString() },
      alreadyProcessed: outcome.alreadyProcessed,
    });
  }),
);


/** Planner and vendor can view requests for a booking they participate in. */
paymentsRouter.get(
  "/bookings/:id/payment-requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { vendor: { select: { userId: true } } },
    });
    if (!booking) throw new HttpError(404, "NOT_FOUND", "Booking not found");
    if (booking.buyerId !== req.user!.id && booking.vendor.userId !== req.user!.id) {
      throw new HttpError(403, "FORBIDDEN", "You are not a participant in this booking");
    }
    const items = await prisma.bookingPaymentRequest.findMany({
      where: { bookingId: booking.id }, orderBy: { createdAt: "asc" },
      include: { requestedBy: { select: { id: true, name: true } } },
    });
    res.json({ items: items.map((item) => ({ ...item, amountMinor: item.amountMinor.toString() })) });
  }),
);

/** Planner approval transfers wallet funds into the booking escrow atomically. */
paymentsRouter.post(
  "/bookings/:id/payment-requests/:requestId/approve",
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { vendor: { select: { userId: true } }, items: { include: { listing: { select: { title: true, type: true } } } } },
    });
    if (!booking) throw new HttpError(404, "NOT_FOUND", "Booking not found");
    if (booking.buyerId !== req.user!.id) throw new HttpError(403, "FORBIDDEN", "Only the event planner can approve this payment");
    const paymentRequest = await prisma.bookingPaymentRequest.findFirst({
      where: { id: req.params.requestId, bookingId: booking.id },
    });
    if (!paymentRequest) throw new HttpError(404, "PAYMENT_REQUEST_NOT_FOUND", "Payment request not found");
    if (paymentRequest.status === "PAID") return res.json({ status: "already_paid", requestId: paymentRequest.id });
    if (paymentRequest.status !== "PENDING") throw new HttpError(409, "REQUEST_NOT_PENDING", "This payment request is no longer pending");
    if (booking.paidMinor + paymentRequest.amountMinor > booking.totalMinor) {
      throw new HttpError(409, "AMOUNT_EXCEEDS_REMAINING", "Payment request exceeds the unpaid booking balance");
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.bookingPaymentRequest.updateMany({
        where: { id: paymentRequest.id, bookingId: booking.id, status: "PENDING" },
        data: { status: "PROCESSING" },
      });
      if (claimed.count !== 1) throw new HttpError(409, "REQUEST_NOT_PENDING", "This payment request was already processed");
      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency: booking.currency } },
      });
      if (!wallet) throw new HttpError(400, "WALLET_NOT_FOUND", "Fund your wallet before approving this payment");
      const debit = await tx.wallet.updateMany({
        where: { id: wallet.id, availableMinor: { gte: paymentRequest.amountMinor } },
        data: { availableMinor: { decrement: paymentRequest.amountMinor }, escrowMinor: { increment: paymentRequest.amountMinor } },
      });
      if (debit.count !== 1) throw new HttpError(400, "INSUFFICIENT_FUNDS", "Your available wallet balance is too low");
      const paidUpdate = await tx.booking.updateMany({
        where: { id: booking.id, paidMinor: booking.paidMinor },
        data: {
          paidMinor: { increment: paymentRequest.amountMinor },
          ...(booking.paidMinor + paymentRequest.amountMinor === booking.totalMinor ? { status: BookingStatus.PAID } : {}),
        },
      });
      if (paidUpdate.count !== 1) throw new HttpError(409, "BOOKING_BALANCE_CHANGED", "The booking balance changed. Refresh and try again.");
      const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id, type: LedgerType.ESCROW_HOLD,
          amountMinor: paymentRequest.amountMinor,
          balanceAfterMinor: updatedWallet.availableMinor,
          refType: "BOOKING_PAYMENT_REQUEST", refId: paymentRequest.id,
          idempotencyKey: `booking-payment-request:${paymentRequest.id}`,
        },
      });
      await tx.bookingPaymentRequest.update({
        where: { id: paymentRequest.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (booking.eventId && booking.paidMinor + paymentRequest.amountMinor === booking.totalMinor) {
        for (const item of booking.items) {
          const existingCheck = await tx.eventServiceCheck.findFirst({
            where: { eventId: booking.eventId, bookingId: booking.id, listingId: item.listingId },
          });
          if (!existingCheck) {
            await tx.eventServiceCheck.create({
              data: {
                eventId: booking.eventId,
                bookingId: booking.id,
                listingId: item.listingId,
                label: item.listing.title,
                category: item.listing.type,
                status: "PENDING",
              },
            });
          }
        }
        const checks = await tx.eventServiceCheck.findMany({ where: { eventId: booking.eventId } });
        await tx.eventReadiness.upsert({
          where: { eventId: booking.eventId },
          create: {
            eventId: booking.eventId,
            status: "IN_PROGRESS",
            totalChecks: checks.length,
            greenCount: checks.filter((check) => check.status === "GREEN").length,
            amberCount: checks.filter((check) => check.status === "AMBER").length,
            redCount: checks.filter((check) => check.status === "RED").length,
            pendingCount: checks.filter((check) => check.status === "PENDING").length,
          },
          update: {
            status: "IN_PROGRESS",
            totalChecks: checks.length,
            greenCount: checks.filter((check) => check.status === "GREEN").length,
            amberCount: checks.filter((check) => check.status === "AMBER").length,
            redCount: checks.filter((check) => check.status === "RED").length,
            pendingCount: checks.filter((check) => check.status === "PENDING").length,
          },
        });
      }
    });
    res.json({ status: "paid_into_escrow", requestId: paymentRequest.id, amountMinor: paymentRequest.amountMinor.toString() });
  }),
);

/** Planner can decline a vendor's pending payment request. */
paymentsRouter.post(
  "/bookings/:id/payment-requests/:requestId/reject",
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) throw new HttpError(404, "NOT_FOUND", "Booking not found");
    if (booking.buyerId !== req.user!.id) throw new HttpError(403, "FORBIDDEN", "Only the event planner can reject this payment");
    const result = await prisma.bookingPaymentRequest.updateMany({
      where: { id: req.params.requestId, bookingId: booking.id, status: "PENDING" },
      data: { status: "REJECTED" },
    });
    if (result.count !== 1) throw new HttpError(409, "REQUEST_NOT_PENDING", "This payment request is no longer pending");
    res.json({ status: "rejected", requestId: req.params.requestId });
  }),
);

/** The assigned verifier releases event escrow after final completion. */
paymentsRouter.post(
  "/bookings/:id/release",
  requireAuth,
  requireRole("VERIFIER"),
  asyncHandler(async (req, res) => {
    const result = await releaseBookingEscrow(req.params.id, req.user!.id);
    res.json(result);
  }),
);

/** List my bookings */
paymentsRouter.get(
  "/bookings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const asVendor = req.query.as === "vendor";
    let vendorId: string | undefined;
    if (asVendor) {
      const profile = await prisma.vendorProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!profile) throw new HttpError(404, "VENDOR_PROFILE_NOT_FOUND", "Vendor profile not found");
      vendorId = profile.id;
    }
    const items = await prisma.booking.findMany({
      where: asVendor && vendorId ? { vendorId } : { buyerId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: { include: { listing: { select: { title: true } } } },
        vendor: { select: { businessName: true } },
        event: { select: { id: true, title: true } },
      },
    });
    res.json({
      items: items.map((b) => ({
        ...b,
        subtotalMinor: b.subtotalMinor.toString(),
        commissionMinor: b.commissionMinor.toString(),
        totalMinor: b.totalMinor.toString(),
        paidMinor: b.paidMinor.toString(),
        items: b.items.map((i) => ({
          ...i,
          unitPriceMinor: i.unitPriceMinor.toString(),
        })),
      })),
    });
  }),
);
