import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/async";
import { requireAuth, requireRole } from "../../middleware/auth";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/overview", asyncHandler(async (_req, res) => {
  const settledStatuses = ["PAID", "CONFIRMED", "FULFILLED"] as const;
  const [
    totalUsers,
    activeUsers,
    totalEvents,
    totalVendors,
    activeListings,
    pendingVerifications,
    disputedBookings,
    bookingsByStatus,
    settledByCurrency,
    activeListingCountries,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.event.count(),
    prisma.vendorProfile.count(),
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.verificationRequest.count({ where: { status: "PENDING" } }),
    prisma.booking.count({ where: { status: "DISPUTED" } }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["currency"],
      where: { status: { in: [...settledStatuses] } },
      _sum: { totalMinor: true },
    }),
    prisma.listing.findMany({
      where: { status: "ACTIVE", country: { not: null } },
      select: { country: true },
      distinct: ["country"],
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        actor: { select: { name: true, role: true } },
      },
    }),
  ]);

  res.json({
    accounts: { total: totalUsers, active: activeUsers },
    events: totalEvents,
    vendors: totalVendors,
    activeListings,
    activeMarkets: activeListingCountries.length,
    pendingVerifications,
    disputedBookings,
    bookingsByStatus: Object.fromEntries(bookingsByStatus.map(({ status, _count }) => [status, _count._all])),
    settledBookingValue: settledByCurrency.map(({ currency, _sum }) => ({
      currency,
      amountMinor: (_sum.totalMinor ?? 0n).toString(),
    })),
    recentAudit: recentAudit.map(({ id, action, entity, entityId, createdAt, actor }) => ({
      id,
      action,
      entity,
      entityId,
      createdAt,
      actor,
    })),
  });
}));

const paymentStatuses = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"] as const;
const ledgerTypes = ["DEPOSIT", "WITHDRAWAL", "ESCROW_HOLD", "ESCROW_RELEASE", "ESCROW_REFUND", "COMMISSION", "SUBSCRIPTION", "ADJUSTMENT"] as const;

function financePageParams(query: Record<string, unknown>) {
  const page = typeof query.page === "string" && /^\\d+$/.test(query.page) ? Math.max(1, Number(query.page)) : 1;
  const requestedLimit = typeof query.limit === "string" && /^\\d+$/.test(query.limit) ? Number(query.limit) : 25;
  const limit = Math.min(100, Math.max(1, requestedLimit));
  const from = typeof query.from === "string" ? new Date(query.from) : undefined;
  const to = typeof query.to === "string" ? new Date(query.to) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return { error: "Invalid date filter" as const };
  }
  if (from && to && from > to) return { error: "The from date must be before the to date" as const };
  return { page, limit, from, to };
}

/** Read-only finance feed. This route never changes balances or payment state. */
adminRouter.get("/finance/payment-intents", asyncHandler(async (req, res) => {
  const params = financePageParams(req.query as Record<string, unknown>);
  if ("error" in params) return res.status(400).json({ error: { code: "INVALID_FILTER", message: params.error } });
  const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
  if (status && !paymentStatuses.includes(status as typeof paymentStatuses[number])) {
    return res.status(400).json({ error: { code: "INVALID_FILTER", message: "Unsupported payment status" } });
  }
  const provider = typeof req.query.provider === "string" ? req.query.provider.trim().toLowerCase() : undefined;
  const currency = typeof req.query.currency === "string" ? req.query.currency.trim().toUpperCase() : undefined;
  const where = {
    ...(status ? { status: status as typeof paymentStatuses[number] } : {}),
    ...(provider ? { provider } : {}),
    ...(currency ? { currency } : {}),
    ...(params.from || params.to ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } } : {}),
  };
  const [total, items, grouped] = await Promise.all([
    prisma.paymentIntent.count({ where }),
    prisma.paymentIntent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true, provider: true, providerRef: true, amountMinor: true, currency: true,
        status: true, purpose: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.paymentIntent.groupBy({
      by: ["provider", "currency", "status"],
      where,
      _count: { _all: true },
      _sum: { amountMinor: true },
    }),
  ]);
  res.json({
    page: params.page,
    limit: params.limit,
    total,
    pages: Math.ceil(total / params.limit),
    summary: grouped.map((row) => ({
      provider: row.provider, currency: row.currency, status: row.status,
      count: row._count._all, amountMinor: (row._sum.amountMinor ?? 0n).toString(),
    })),
    items: items.map((item) => ({ ...item, amountMinor: item.amountMinor.toString() })),
  });
}));

/** Read-only wallet ledger feed; balances are sourced from append-only ledger rows. */
adminRouter.get("/finance/ledger", asyncHandler(async (req, res) => {
  const params = financePageParams(req.query as Record<string, unknown>);
  if ("error" in params) return res.status(400).json({ error: { code: "INVALID_FILTER", message: params.error } });
  const type = typeof req.query.type === "string" ? req.query.type.toUpperCase() : undefined;
  if (type && !ledgerTypes.includes(type as typeof ledgerTypes[number])) {
    return res.status(400).json({ error: { code: "INVALID_FILTER", message: "Unsupported ledger type" } });
  }
  const currency = typeof req.query.currency === "string" ? req.query.currency.trim().toUpperCase() : undefined;
  const where = {
    ...(type ? { type: type as typeof ledgerTypes[number] } : {}),
    ...(params.from || params.to ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } } : {}),
    ...(currency ? { wallet: { currency } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true, type: true, amountMinor: true, balanceAfterMinor: true,
        refType: true, refId: true, createdAt: true,
        wallet: { select: { currency: true, user: { select: { id: true, name: true, email: true } } } },
      },
    }),
  ]);
  res.json({
    page: params.page, limit: params.limit, total, pages: Math.ceil(total / params.limit),
    items: items.map((item) => ({
      ...item,
      amountMinor: item.amountMinor.toString(),
      balanceAfterMinor: item.balanceAfterMinor.toString(),
    })),
  });
}));
