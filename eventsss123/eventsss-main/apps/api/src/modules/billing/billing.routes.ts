import { Router } from "express";
import rateLimit from "express-rate-limit";
import { BillingInterval, LedgerType, PromotionStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { isPromotionPaymentValid, isPromotionTrackingAction, isPromotionWithinSchedule } from "./promotionPolicy";

export const billingRouter = Router();

const promotionTrackingLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

billingRouter.get(
  "/public-promotions",
  asyncHandler(async (_req, res) => {
    const now = new Date();

    try {
      const items = await prisma.promotion.findMany({
        where: {
          status: PromotionStatus.ACTIVE,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        orderBy: [{ startsAt: "desc" }, { endsAt: "asc" }],
        take: 12,
        include: {
          listing: { select: { id: true, title: true, description: true } },
          vendor: { select: { businessName: true, city: true, country: true } },
        },
      });

      res.json({
        items: items.map((promotion) => ({
          id: promotion.id,
          title: promotion.title,
          vendorName: promotion.vendor.businessName,
          listingTitle: promotion.listing?.title ?? null,
          description: promotion.listing?.description ?? null,
          city: promotion.vendor.city ?? null,
          country: promotion.vendor.country ?? null,
          startsAt: promotion.startsAt.toISOString(),
          endsAt: promotion.endsAt.toISOString(),
          currency: "NGN",
          budgetMinor: promotion.budgetMinor.toString(),
        })),
      });
    } catch (error) {
      logger.warn({ error }, "Public promotions feed unavailable; returning empty list");
      res.json({ items: [] });
    }
  }),
);

/** Public plan catalog (auth required to keep API consistent). */
billingRouter.get(
  "/plans",
  requireAuth,
  asyncHandler(async (req, res) => {
    const audience = typeof req.query.audience === "string" ? req.query.audience : undefined;
    const plans = await prisma.plan.findMany({
      where: {
        active: true,
        ...(audience ? { audience: audience as never } : {}),
      },
      orderBy: { priceMinor: "asc" },
    });
    res.json({
      items: plans.map((p) => ({
        ...p,
        priceMinor: p.priceMinor.toString(),
      })),
    });
  }),
);

billingRouter.get(
  "/subscriptions/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await prisma.subscription.findMany({
      where: { userId: req.user!.id },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      items: items.map((s) => ({
        ...s,
        plan: { ...s.plan, priceMinor: s.plan.priceMinor.toString() },
      })),
    });
  }),
);

billingRouter.post(
  "/subscriptions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const planId = String(req.body.planId || "");
    const plan = await prisma.plan.findFirst({ where: { id: planId, active: true } });
    if (!plan) throw new HttpError(404, "NOT_FOUND", "Plan not found");

    const periodMs =
      plan.interval === BillingInterval.YEARLY
        ? 365 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

    const sub = await prisma.subscription.create({
      data: {
        userId: req.user!.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + periodMs),
        autoRenew: true,
      },
      include: { plan: true },
    });

    res.status(201).json({
      subscription: {
        ...sub,
        plan: { ...sub.plan, priceMinor: sub.plan.priceMinor.toString() },
      },
    });
  }),
);

billingRouter.post(
  "/subscriptions/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!sub) throw new HttpError(404, "NOT_FOUND", "Subscription not found");

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        autoRenew: false,
        cancelledAt: new Date(),
      },
      include: { plan: true },
    });

    res.json({
      subscription: {
        ...updated,
        plan: { ...updated.plan, priceMinor: updated.plan.priceMinor.toString() },
      },
    });
  }),
);

/** Vendor promotions */
billingRouter.get(
  "/promotions",
  requireAuth,
  requireRole("VENDOR", "ADMIN"),
  asyncHandler(async (req, res) => {
    const where =
      req.user!.role === "ADMIN"
        ? {}
        : { vendor: { userId: req.user!.id } };
    const items = await prisma.promotion.findMany({
      where,
      orderBy: { startsAt: "desc" },
      take: 50,
      include: { listing: { select: { id: true, title: true } } },
    });
    res.json({
      items: items.map((p) => ({
        ...p,
        budgetMinor: p.budgetMinor.toString(),
        spentMinor: p.spentMinor.toString(),
      })),
    });
  }),
);

billingRouter.post(
  "/promotions",
  requireAuth,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const profile = await prisma.vendorProfile.findUnique({
      where: { userId: req.user!.id },
    });
    if (!profile) throw new HttpError(404, "NOT_FOUND", "Vendor profile required");

    const title = String(req.body.title || "").trim();
    if (title.length < 2) throw new HttpError(400, "INVALID", "Title required");

    const rawBudget = String(req.body.budgetMinor ?? "");
    if (!/^\d+$/.test(rawBudget)) {
      throw new HttpError(400, "INVALID_AMOUNT", "budgetMinor must be a positive integer in minor currency units");
    }
    const budgetMinor = BigInt(rawBudget);
    if (budgetMinor <= 0n) throw new HttpError(400, "INVALID_AMOUNT", "budgetMinor must be > 0");

    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
    const endsAt = req.body.endsAt
      ? new Date(req.body.endsAt)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
      throw new HttpError(400, "INVALID_DATES", "Promotion end date must be later than its valid start date");
    }
    if (endsAt <= new Date()) {
      throw new HttpError(400, "INVALID_DATES", "Promotion end date must be in the future");
    }

    const listingId = typeof req.body.listingId === "string" && req.body.listingId.trim()
      ? req.body.listingId.trim()
      : null;
    if (listingId) {
      const ownedListing = await prisma.listing.findFirst({
        where: { id: listingId, vendorId: profile.id },
        select: { id: true },
      });
      if (!ownedListing) {
        throw new HttpError(404, "LISTING_NOT_FOUND", "The selected listing was not found in your vendor account");
      }
    }

    // Vendor requests must never self-publish a paid placement. Activation is
    // withheld until verified billing and an authorized approval flow exist.
    const promo = await prisma.promotion.create({
      data: {
        vendorId: profile.id,
        listingId,
        title,
        budgetMinor,
        startsAt,
        endsAt,
        status: PromotionStatus.DRAFT,
      },
    });

    res.status(201).json({
      promotion: {
        ...promo,
        budgetMinor: promo.budgetMinor.toString(),
        spentMinor: promo.spentMinor.toString(),
      },
    });
  }),
);

/** Vendor pays for a campaign from their verified NGN wallet. */
billingRouter.post(
  "/promotions/:id/pay",
  requireAuth,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const profile = await prisma.vendorProfile.findUnique({ where: { userId: req.user!.id } });
    if (!profile) throw new HttpError(404, "NOT_FOUND", "Vendor profile required");

    const result = await prisma.$transaction(async (tx) => {
      const promotion = await tx.promotion.findFirst({
        where: { id: req.params.id, vendorId: profile.id },
      });
      if (!promotion) throw new HttpError(404, "NOT_FOUND", "Promotion not found");
      if (promotion.status !== PromotionStatus.DRAFT) {
        throw new HttpError(409, "INVALID_PROMOTION_STATE", "Only draft campaigns can be paid");
      }

      const idempotencyKey = `promotion_payment:${promotion.id}`;
      const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
      if (existing) {
        if (existing.refType !== "PROMOTION_PAYMENT" || existing.refId !== promotion.id || existing.amountMinor !== promotion.budgetMinor) {
          throw new HttpError(409, "PAYMENT_RECORD_CONFLICT", "The campaign payment record does not match this campaign");
        }
        return { promotion, entry: existing, replayed: true };
      }

      const paidAt = new Date();
      const paymentClaim = await tx.promotion.updateMany({
        where: { id: promotion.id, status: PromotionStatus.DRAFT, paidAt: null },
        data: { paidAt },
      });
      if (paymentClaim.count !== 1) {
        const claimedPayment = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
        if (isPromotionPaymentValid(claimedPayment, promotion.id, promotion.budgetMinor)) {
          return { promotion: { ...promotion, paidAt: promotion.paidAt || paidAt }, entry: claimedPayment!, replayed: true };
        }
        throw new HttpError(409, "PROMOTION_PAYMENT_IN_PROGRESS", "Campaign payment is already being processed or the campaign is no longer payable");
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency: "NGN" } },
      });
      if (!wallet || wallet.availableMinor < promotion.budgetMinor) {
        throw new HttpError(400, "INSUFFICIENT_FUNDS", "Add sufficient verified NGN wallet funds before paying for this campaign");
      }

      const debit = await tx.wallet.updateMany({
        where: { id: wallet.id, availableMinor: { gte: promotion.budgetMinor } },
        data: { availableMinor: { decrement: promotion.budgetMinor } },
      });
      if (debit.count !== 1) {
        throw new HttpError(400, "INSUFFICIENT_FUNDS", "Wallet balance changed; refresh and try again");
      }
      const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const entry = await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.WITHDRAWAL,
          amountMinor: promotion.budgetMinor,
          balanceAfterMinor: updatedWallet.availableMinor,
          refType: "PROMOTION_PAYMENT",
          refId: promotion.id,
          idempotencyKey,
        },
      });
      const updatedPromotion = { ...promotion, paidAt };
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "PROMOTION_PAID_FROM_WALLET",
          entity: "Promotion",
          entityId: promotion.id,
          meta: { amountMinor: promotion.budgetMinor.toString(), currency: "NGN", ledgerEntryId: entry.id },
        },
      });
      return { promotion: updatedPromotion, entry, replayed: false };
    });

    res.status(result.replayed ? 200 : 201).json({
      promotion: {
        id: result.promotion.id,
        status: result.promotion.status,
        paidAt: result.promotion.paidAt,
        approvedAt: result.promotion.approvedAt,
      },
      payment: {
        ledgerEntryId: result.entry.id,
        amountMinor: result.entry.amountMinor.toString(),
        currency: "NGN",
        replayed: result.replayed,
      },
      message: "Payment recorded. Campaign remains unpublished until an administrator approves it.",
    });
  }),
);

/** A vendor may pause only their own currently active campaign. */
billingRouter.post(
  "/promotions/:id/pause",
  requireAuth,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const profile = await prisma.vendorProfile.findUnique({ where: { userId: req.user!.id } });
    if (!profile) throw new HttpError(404, "NOT_FOUND", "Vendor profile required");
    const promotion = await prisma.promotion.findFirst({
      where: { id: req.params.id, vendorId: profile.id },
    });
    if (!promotion) throw new HttpError(404, "NOT_FOUND", "Promotion not found");
    if (promotion.status !== PromotionStatus.ACTIVE) {
      throw new HttpError(409, "INVALID_PROMOTION_STATE", "Only active campaigns can be paused");
    }
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.promotion.update({
        where: { id: promotion.id },
        data: { status: PromotionStatus.PAUSED, pausedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "PROMOTION_PAUSED",
          entity: "Promotion",
          entityId: promotion.id,
          meta: { actorRole: "VENDOR" },
        },
      });
      return item;
    });
    res.json({ promotion: { id: updated.id, status: updated.status, pausedAt: updated.pausedAt } });
  }),
);

/** Admin approval/status control. Activation requires a matching wallet ledger payment. */
billingRouter.patch(
  "/promotions/:id/status",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const requested = String(req.body.status || "").toUpperCase();
    if (![PromotionStatus.ACTIVE, PromotionStatus.PAUSED, PromotionStatus.ENDED].includes(requested as PromotionStatus)) {
      throw new HttpError(400, "INVALID_STATUS", "Status must be ACTIVE, PAUSED, or ENDED");
    }
    const promotion = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!promotion) throw new HttpError(404, "NOT_FOUND", "Promotion not found");

    if (requested === PromotionStatus.ACTIVE) {
      const payment = await prisma.ledgerEntry.findUnique({
        where: { idempotencyKey: `promotion_payment:${promotion.id}` },
      });
      if (!isPromotionPaymentValid(payment, promotion.id, promotion.budgetMinor)) {
        throw new HttpError(409, "PROMOTION_UNPAID", "A matching verified wallet payment is required before approval");
      }
      if (promotion.endsAt <= new Date()) {
        throw new HttpError(409, "PROMOTION_EXPIRED", "An expired campaign cannot be activated");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.promotion.update({
        where: { id: promotion.id },
        data: {
          status: requested as PromotionStatus,
          approvedAt: requested === PromotionStatus.ACTIVE ? promotion.approvedAt || new Date() : promotion.approvedAt,
          approvedById: requested === PromotionStatus.ACTIVE ? req.user!.id : promotion.approvedById,
          pausedAt: requested === PromotionStatus.PAUSED ? new Date() : requested === PromotionStatus.ACTIVE ? null : promotion.pausedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: requested === PromotionStatus.ACTIVE ? "PROMOTION_APPROVED" : requested === PromotionStatus.PAUSED ? "PROMOTION_PAUSED_BY_ADMIN" : "PROMOTION_ENDED",
          entity: "Promotion",
          entityId: promotion.id,
          meta: { previousStatus: promotion.status, newStatus: requested },
        },
      });
      return item;
    });
    res.json({
      promotion: {
        id: updated.id,
        status: updated.status,
        paidAt: updated.paidAt,
        approvedAt: updated.approvedAt,
        approvedById: updated.approvedById,
        pausedAt: updated.pausedAt,
      },
    });
  }),
);

/** Rate-limited public campaign measurement; never returns vendor financial data. */
billingRouter.post(
  "/public-promotions/:id/track",
  promotionTrackingLimit,
  asyncHandler(async (req, res) => {
    const action = String(req.body.action || "").toLowerCase();
    if (!isPromotionTrackingAction(action)) {
      throw new HttpError(400, "INVALID_TRACKING_ACTION", "Action must be impression or click");
    }
    const promotion = await prisma.promotion.findFirst({
      where: { id: req.params.id, status: PromotionStatus.ACTIVE },
      select: { id: true, startsAt: true, endsAt: true },
    });
    if (!promotion || !isPromotionWithinSchedule(promotion.startsAt, promotion.endsAt)) {
      throw new HttpError(404, "PROMOTION_NOT_FOUND", "Active promotion not found");
    }
    const result = await prisma.promotion.updateMany({
      where: { id: promotion.id, status: PromotionStatus.ACTIVE },
      data: action === "impression" ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } },
    });
    if (result.count !== 1) throw new HttpError(404, "PROMOTION_NOT_FOUND", "Active promotion not found");
    res.status(202).json({ ok: true });
  }),
);

