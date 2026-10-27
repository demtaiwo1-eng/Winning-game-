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