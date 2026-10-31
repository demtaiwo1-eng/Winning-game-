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
} from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { commissionMinor } from "../../lib/money";
import { env } from "../../config/env";
import {
  initializeFlutterwave,
  initializePaystack,
  initializeStripe,
  selectProvider,
  getPaymentMode,
  canCompleteDemoCheckout,
  verifyFlutterwave,
  verifyPaystack,
  verifyStripe,
} from "./providers";
import { releaseBookingEscrow } from "./escrow.service";
import {
  assertVerifiedPayment,
  verifyPaystackSignature,
  verifyFlutterwaveSignature,
  verifyStripeSignature,
} from "./webhookVerification";


export const paymentsRouter = Router();


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
    const callbackUrl = new URL(
      `/dashboard/${user.role.toLowerCase()}?tab=wallet&payment=return`,
      env.APP_BASE_URL,
    ).toString();

    let init: { provider: string; providerRef: string; authorizationUrl?: string; mode: string };
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
    if (init.mode === "live") {
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

    const intent = await prisma.paymentIntent.create({
      data: {
        userId: req.user!.id,
        provider: init.provider,
        amountMinor,
        currency,
        status: PaymentStatus.PENDING,
        purpose,
        providerRef: init.providerRef,
      },
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
      message:
        init.mode === "live"
          ? `Redirect customer to checkoutUrl (${init.provider}). Webhook will credit wallet.`
          : `Demo mode. POST ${checkoutUrl} or set PAYSTACK_SECRET_KEY / FLUTTERWAVE_SECRET_KEY for live.`,
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
  if (!rawBody) throw new HttpError(400, "RAW_BODY_MISSING", "Webhook raw body is unavailable");
  const secret = provider === "paystack" ? env.PAYSTACK_SECRET_KEY : provider === "flutterwave" ? env.FLUTTERWAVE_SECRET_KEY : env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, "WEBHOOK_SECRET_MISSING", "Webhook verification is not configured");
  if (provider === "paystack") {
    const received = String(req.headers["x-paystack-signature"] || "");
    if (!verifyPaystackSignature(rawBody, received, secret)) throw new HttpError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid Paystack webhook signature");
  } else if (provider === "flutterwave") {
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
    if (!["paystack", "flutterwave", "stripe"].includes(provider)) throw new HttpError(404, "UNKNOWN_PROVIDER", "Unsupported payment provider");
    verifyWebhookSignature(provider, req);

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
      provider === "flutterwave"
        ? data?.tx_ref || ""
        : provider === "stripe"
          ? data?.object?.id || ""
          : data?.reference || ""
    );
    const transactionId = String(provider === "flutterwave" ? data?.id || "" : providerRef);
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

    if (provider === "paystack") {
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
      const feeMinor = commissionMinor(intent.amountMinor, env.COMMISSION_BPS);
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
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            type: LedgerType.COMMISSION,
            amountMinor: feeMinor,
            balanceAfterMinor: updatedWallet.availableMinor,
            refType: "PAYMENT_INTENT",
            refId: intentId,
            idempotencyKey: `pay_deposit_fee:${intentId}`,
          },
        });
      }
    }
    return true;
  });
}
const RECONCILIATION_MAX_ATTEMPTS = 8;
const RECONCILIATION_LOCK_MS = 2 * 60_000;
const RECONCILIATION_BASE_BACKOFF_MS = 60_000;
const RECONCILIATION_MAX_BACKOFF_MS = 6 * 60 * 60_000;

function reconciliationBackoffMs(attempt: number): number {
  return Math.min(
    RECONCILIATION_BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1),
    RECONCILIATION_MAX_BACKOFF_MS,
  );
}

function reconciliationErrorCode(error: unknown): string {
  // Persist only a stable, non-sensitive error category; never provider payloads,
  // credentials, request URLs, or raw error messages.
  return error instanceof Error ? error.name.slice(0, 80) : "UnknownError";
}

export async function reconcilePendingPayments(batchSize = 50) {
  const now = new Date();
  const eligibleWhere = {
    status: PaymentStatus.PENDING,
    providerRef: { not: null },
    provider: { in: ["paystack", "flutterwave", "stripe"] },
    reconciliationDeadLetteredAt: null,
    AND: [
      { OR: [{ reconciliationNextAttemptAt: null }, { reconciliationNextAttemptAt: { lte: now } }] },
      { OR: [{ reconciliationLockedUntil: null }, { reconciliationLockedUntil: { lt: now } }] },
    ],
  } as const;
  const candidates = await prisma.paymentIntent.findMany({
    where: eligibleWhere,
    take: Math.max(1, Math.min(batchSize, 100)),
    orderBy: [{ reconciliationNextAttemptAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  let reconciled = 0;
  let retried = 0;
  let deadLettered = 0;
  let skipped = 0;

  for (const candidate of candidates) {
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
      if (intent.provider === "paystack") {
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
    const commission = commissionMinor(subtotal, env.COMMISSION_BPS);
    const total = subtotal;
    const currency = listing.currency;
    const idempotencyKey =
      typeof req.body.idempotencyKey === "string"
        ? req.body.idempotencyKey
        : `book:${req.user!.id}:${listingId}:${randomUUID()}`;

    const result = await prisma.$transaction(async (tx) => {
      const existingLedger = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
      if (existingLedger) {
        throw new HttpError(409, "DUPLICATE", "Booking already processed for this key");
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency } },
      });
      if (!wallet || wallet.availableMinor < total) {
        throw new HttpError(
          400,
          "INSUFFICIENT_FUNDS",
          `Need ${total.toString()} ${currency} available. Deposit via /payments/intents first.`,
        );
      }

      const booking = await tx.booking.create({
        data: {
          buyerId: req.user!.id,
          vendorId: listing.vendorId,
          eventId,
          status: BookingStatus.PAID,
          currency,
          subtotalMinor: subtotal,
          commissionMinor: commission,
          totalMinor: total,
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

      const newAvailable = wallet.availableMinor - total;
      const newEscrow = wallet.escrowMinor + total;
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.ESCROW_HOLD,
          amountMinor: total,
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

    // Auto-create readiness checks so verifier board is fresh (no demo data required)
    if (eventId) {
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
        items: result.items.map((i) => ({
          ...i,
          unitPriceMinor: i.unitPriceMinor.toString(),
        })),
      },
      message:
        "Payment held in platform-controlled escrow. The assigned lead verifier can authorize release only after the event ends and all service checks are green.",
    });
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

/** External payouts are unavailable until a payout provider is integrated. */
paymentsRouter.post(
  "/payouts",
  requireAuth,
  requireRole("VENDOR", "AFFILIATE", "ADMIN"),
  asyncHandler(async (req, res) => {
    throw new HttpError(
      501,
      "PAYOUT_NOT_CONFIGURED",
      "External payouts are not enabled; no wallet funds were moved.",
    );
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
        items: b.items.map((i) => ({
          ...i,
          unitPriceMinor: i.unitPriceMinor.toString(),
        })),
      })),
    });
  }),
);
