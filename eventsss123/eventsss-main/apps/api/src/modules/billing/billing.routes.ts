import { Router } from "express";
import { BillingInterval, PromotionStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";

export const billingRouter = Router();

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

    const budgetMinor = BigInt(String(req.body.budgetMinor || "0"));
    if (budgetMinor <= 0n) throw new HttpError(400, "INVALID_AMOUNT", "budgetMinor must be > 0");

    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
    const endsAt = req.body.endsAt
      ? new Date(req.body.endsAt)
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const promo = await prisma.promotion.create({
      data: {
        vendorId: profile.id,
        listingId: typeof req.body.listingId === "string" ? req.body.listingId : null,
        title,
        budgetMinor,
        startsAt,
        endsAt,
        status:
          req.body.status === "ACTIVE" ? PromotionStatus.ACTIVE : PromotionStatus.DRAFT,
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
