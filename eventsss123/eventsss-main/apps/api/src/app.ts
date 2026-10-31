import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import "./lib/bigint";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { errorHandler, notFound } from "./middleware/error";
import { authRouter } from "./modules/auth/auth.routes";
import { eventsRouter } from "./modules/events/events.routes";
import { eventMessagesRouter } from "./modules/events/messages.routes";
import { rsvpRouter } from "./modules/rsvp/rsvp.routes";
import { marketplaceRouter } from "./modules/marketplace/marketplace.routes";
import { walletRouter } from "./modules/wallet/wallet.routes";
import { billingRouter } from "./modules/billing/billing.routes";
import { kycRouter } from "./modules/kyc/kyc.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { checkoutRouter } from "./modules/checkout/checkout.routes";
import { readinessRouter } from "./modules/readiness/readiness.routes";
import { adminRouter } from "./modules/admin/admin.routes";

import { hasRole, requireAuth } from "./middleware/auth";
import { requireRole } from "./middleware/auth";
import { ListingStatus, ListingType } from "@prisma/client";

export function createApp() {
  const app = express();
  const allowed = env.CORS_ORIGINS.split(",").map((s) => s.trim());

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowed.includes(origin)) return cb(null, true);
        if (env.ALLOW_CODESPACES === "true" && /^https:\/\/[a-z0-9-]+\.app\.github\.dev$/.test(origin)) return cb(null, true);
        cb(null, false);
      },
    }),
  );
  if (env.NODE_ENV !== "test") app.use(pinoHttp({ logger }));
  app.use(express.json({
    limit: "1mb",
    verify(req, _res, buf) {
      if (req.url?.startsWith("/api/v1/payments/webhooks/")) {
        (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      }
    },
  }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });
  app.get("/ready", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "db_unavailable" });
    }
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/events", eventMessagesRouter);
  app.use("/api/v1/events", eventsRouter);
  app.use("/api/v1/rsvp", rsvpRouter);
  app.use("/api/v1/marketplace", marketplaceRouter);
  app.use("/api/v1/wallet", walletRouter);
  app.use("/api/v1/billing", billingRouter);
  app.use("/api/v1/kyc", kycRouter);
  app.use("/api/v1/payments", paymentsRouter);
  app.use("/api/v1/checkout", checkoutRouter);
  app.use("/api/v1/notifications", notificationsRouter);
  app.use("/api/v1/readiness", readinessRouter);
  app.use("/api/v1/admin", adminRouter);
  app.get("/api/v1/vendor/profile", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const profile = await prisma.vendorProfile.findUnique({ where: { userId: req.user!.id }, include: { shops: true } });
      if (!profile) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Vendor profile not found" } });
      res.json({ profile });
    } catch (error) { next(error); }
  });
  app.patch("/api/v1/vendor/profile", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const profile = await prisma.vendorProfile.update({
        where: { userId: req.user!.id },
        data: {
          businessName: typeof req.body.businessName === "string" ? req.body.businessName.trim() : undefined,
          description: typeof req.body.description === "string" ? req.body.description.trim() : undefined,
          country: typeof req.body.country === "string" ? req.body.country.toUpperCase() : undefined,
          city: typeof req.body.city === "string" ? req.body.city.trim() : undefined,
          lat: typeof req.body.lat === "number" ? req.body.lat : undefined,
          lng: typeof req.body.lng === "number" ? req.body.lng : undefined,
        },
      });
      res.json({ profile });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/vendor/categories", requireAuth, requireRole("VENDOR"), async (_req, res, next) => {
    try { res.json({ items: await prisma.category.findMany({ orderBy: { name: "asc" } }) }); } catch (error) { next(error); }
  });
  app.get("/api/v1/vendor/kyc", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try { res.json({ items: await prisma.verificationRequest.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" } }) }); } catch (error) { next(error); }
  });
  app.post("/api/v1/vendor/kyc", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const request = await prisma.verificationRequest.create({ data: { userId: req.user!.id, kind: req.body.kind === "IDENTITY" ? "IDENTITY" : "BUSINESS", documentUrl: String(req.body.documentUrl), notes: req.body.notes ? String(req.body.notes) : null } });
      res.status(201).json({ request });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/vendor/listings", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const items = await prisma.listing.findMany({
        where: { vendor: { userId: req.user!.id } },
        orderBy: { updatedAt: "desc" },
        include: { category: { select: { id: true, name: true } } },
      });
      res.json({
        items: items.map((listing) => ({
          ...listing,
          priceMinor: listing.priceMinor.toString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/v1/vendor/listings", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
      const rawPrice = String(req.body.priceMinor ?? "");
      const type = String(req.body.type ?? "").toUpperCase();
      const currency = String(req.body.currency || "NGN").toUpperCase();
      const capacity = req.body.capacity == null || req.body.capacity === "" ? null : Number(req.body.capacity);
      const mediaUrls = Array.isArray(req.body.mediaUrls) ? req.body.mediaUrls : [];
      if (title.length < 2 || title.length > 160) {
        return res.status(400).json({ error: { code: "INVALID_TITLE", message: "Listing title must be 2–160 characters" } });
      }
      if (!/^[1-9][0-9]*$/.test(rawPrice)) {
        return res.status(400).json({ error: { code: "INVALID_PRICE", message: "priceMinor must be a positive integer" } });
      }
      if (!["VENUE", "GOOD", "SERVICE"].includes(type)) {
        return res.status(400).json({ error: { code: "INVALID_TYPE", message: "Listing type is invalid" } });
      }
      if (!/^[A-Z]{3}$/.test(currency)) {
        return res.status(400).json({ error: { code: "INVALID_CURRENCY", message: "Currency must be a three-letter code" } });
      }
      if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1)) {
        return res.status(400).json({ error: { code: "INVALID_CAPACITY", message: "Capacity must be a positive whole number" } });
      }
      if (mediaUrls.length > 8 || mediaUrls.some((value: unknown) => typeof value !== "string" || value.length > 2048 || !value.startsWith("https://"))) {
        return res.status(400).json({ error: { code: "INVALID_MEDIA", message: "Use up to 8 HTTPS media URLs" } });
      }
      const category = await prisma.category.findUnique({ where: { id: String(req.body.categoryId || "") }, select: { id: true } });
      if (!category) return res.status(400).json({ error: { code: "INVALID_CATEGORY", message: "Choose an available listing category" } });
      const profile = await prisma.vendorProfile.findUniqueOrThrow({ where: { userId: req.user!.id } });
      const listing = await prisma.listing.create({ data: {
        vendorId: profile.id,
        categoryId: category.id,
        type: type as ListingType,
        title,
        description: typeof req.body.description === "string" ? req.body.description.trim().slice(0, 4000) : null,
        priceMinor: BigInt(rawPrice),
        currency,
        country: req.body.country ? String(req.body.country).toUpperCase() : profile.country,
        city: req.body.city ? String(req.body.city).trim().slice(0, 120) : profile.city,
        capacity,
        mediaUrls: mediaUrls as string[],
        status: ListingStatus.DRAFT,
      }, include: { category: { select: { name: true } } } });
      res.status(201).json({ listing });
    } catch (error) { next(error); }
  });
  app.patch("/api/v1/vendor/listings/:listingId", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const owned = await prisma.listing.findFirst({ where: { id: req.params.listingId, vendor: { userId: req.user!.id } } });
      if (!owned) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Listing not found" } });
      const listing = await prisma.listing.update({ where: { id: owned.id }, data: {
        title: typeof req.body.title === "string" ? req.body.title.trim() : undefined,
        description: typeof req.body.description === "string" ? req.body.description.trim() : undefined,
        priceMinor: req.body.priceMinor !== undefined ? BigInt(String(req.body.priceMinor)) : undefined,
        city: typeof req.body.city === "string" ? req.body.city.trim() : undefined,
        country: typeof req.body.country === "string" ? req.body.country.toUpperCase() : undefined,
        capacity: req.body.capacity !== undefined ? Number(req.body.capacity) : undefined,
        status: req.body.status === "DRAFT" ? ListingStatus.DRAFT : undefined,
      } });
      res.json({ listing });
    } catch (error) { next(error); }
  });
  app.delete("/api/v1/vendor/listings/:listingId", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const owned = await prisma.listing.findFirst({ where: { id: req.params.listingId, vendor: { userId: req.user!.id } } });
      if (!owned) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Listing not found" } });
      await prisma.listing.delete({ where: { id: owned.id } });
      res.status(204).end();
    } catch (error) { next(error); }
  });
  app.get("/api/v1/vendor/listings/:listingId/availability", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const listing = await prisma.listing.findFirst({
        where: { id: req.params.listingId, vendor: { userId: req.user!.id } },
        select: { id: true },
      });
      if (!listing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Listing not found" } });
      const items = await prisma.listingAvailability.findMany({
        where: { listingId: listing.id },
        orderBy: { startsAt: "asc" },
      });
      res.json({ items });
    } catch (error) { next(error); }
  });
  app.post("/api/v1/vendor/listings/:listingId/availability", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const listing = await prisma.listing.findFirst({
        where: { id: req.params.listingId, vendor: { userId: req.user!.id } },
        select: { id: true },
      });
      if (!listing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Listing not found" } });
      const startsAt = new Date(String(req.body.startsAt || ""));
      const endsAt = new Date(String(req.body.endsAt || ""));
      const capacity = req.body.capacity === undefined ? 1 : Number(req.body.capacity);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        return res.status(400).json({ error: { code: "INVALID_AVAILABILITY_WINDOW", message: "Provide a valid start and end time; end must be after start" } });
      }
      if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 100000) {
        return res.status(400).json({ error: { code: "INVALID_AVAILABILITY_CAPACITY", message: "Capacity must be a positive whole number" } });
      }
      const conflict = await prisma.listingAvailability.findFirst({
        where: { listingId: listing.id, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        select: { id: true },
      });
      if (conflict) return res.status(409).json({ error: { code: "AVAILABILITY_OVERLAP", message: "This availability window overlaps an existing window" } });
      const item = await prisma.listingAvailability.create({
        data: { listingId: listing.id, startsAt, endsAt, capacity },
      });
      res.status(201).json({ item });
    } catch (error) { next(error); }
  });
  app.delete("/api/v1/vendor/listings/:listingId/availability/:availabilityId", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const item = await prisma.listingAvailability.findFirst({
        where: {
          id: req.params.availabilityId,
          listingId: req.params.listingId,
          listing: { vendor: { userId: req.user!.id } },
        },
        select: { id: true },
      });
      if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Availability window not found" } });
      await prisma.listingAvailability.delete({ where: { id: item.id } });
      res.status(204).end();
    } catch (error) { next(error); }
  });
  app.post("/api/v1/listings/:listingId/enquiries", requireAuth, async (req, res, next) => {
    try {
      const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
      if (message.length < 10 || message.length > 4000) {
        return res.status(400).json({ error: { code: "INVALID_ENQUIRY", message: "Message must be between 10 and 4000 characters" } });
      }
      const listing = await prisma.listing.findFirst({
        where: { id: req.params.listingId, status: ListingStatus.ACTIVE },
        select: { id: true, vendorId: true, vendor: { select: { userId: true } } },
      });
      if (!listing) return res.status(404).json({ error: { code: "LISTING_NOT_FOUND", message: "Active listing not found" } });
      if (listing.vendor.userId === req.user!.id) return res.status(409).json({ error: { code: "OWN_LISTING", message: "You cannot enquire about your own listing" } });
      const enquiry = await prisma.vendorEnquiry.create({
        data: { listingId: listing.id, vendorId: listing.vendorId, buyerId: req.user!.id, message },
        select: { id: true, listingId: true, message: true, status: true, createdAt: true },
      });
      res.status(201).json({ enquiry });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/vendor/enquiries", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
      if (!vendor) return res.status(404).json({ error: { code: "VENDOR_NOT_FOUND", message: "Vendor profile not found" } });
      const items = await prisma.vendorEnquiry.findMany({
        where: { vendorId: vendor.id },
        orderBy: { createdAt: "desc" }, take: 100,
        include: { listing: { select: { id: true, title: true } }, buyer: { select: { id: true, name: true } } },
      });
      res.json({ items });
    } catch (error) { next(error); }
  });
  app.patch("/api/v1/vendor/enquiries/:enquiryId", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const response = typeof req.body.response === "string" ? req.body.response.trim() : "";
      const status = req.body.status === "CLOSED" ? "CLOSED" : "RESPONDED";
      if (response.length < 2 || response.length > 4000) return res.status(400).json({ error: { code: "INVALID_RESPONSE", message: "Response must be between 2 and 4000 characters" } });
      const enquiry = await prisma.vendorEnquiry.findFirst({
        where: { id: req.params.enquiryId, vendor: { userId: req.user!.id } },
        select: { id: true },
      });
      if (!enquiry) return res.status(404).json({ error: { code: "ENQUIRY_NOT_FOUND", message: "Enquiry not found" } });
      const updated = await prisma.vendorEnquiry.update({
        where: { id: enquiry.id },
        data: { response, status, responderId: req.user!.id, respondedAt: new Date() },
      });
      res.json({ enquiry: updated });
    } catch (error) { next(error); }
  });
  app.get("/api/v1/vendor/metrics", requireAuth, requireRole("VENDOR"), async (req, res, next) => {
    try {
      const vendor = await prisma.vendorProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
      if (!vendor) return res.status(404).json({ error: { code: "VENDOR_NOT_FOUND", message: "Vendor profile not found" } });
      const [listings, bookings, enquiries, reviews] = await Promise.all([
        prisma.listing.groupBy({ by: ["status"], where: { vendorId: vendor.id }, _count: { _all: true } }),
        prisma.booking.groupBy({ by: ["status"], where: { vendorId: vendor.id }, _count: { _all: true }, _sum: { totalMinor: true } }),
        prisma.vendorEnquiry.groupBy({ by: ["status"], where: { vendorId: vendor.id }, _count: { _all: true } }),
        prisma.review.aggregate({ where: { vendorId: vendor.id }, _avg: { rating: true }, _count: { _all: true } }),
      ]);
      res.json({
        listings: Object.fromEntries(listings.map(x => [x.status, x._count._all])),
        bookings: Object.fromEntries(bookings.map(x => [x.status, { count: x._count._all, totalMinor: (x._sum.totalMinor ?? 0n).toString() }])),
        enquiries: Object.fromEntries(enquiries.map(x => [x.status, x._count._all])),
        reviews: { averageRating: reviews._avg.rating, count: reviews._count._all },
      });
    } catch (error) { next(error); }
  });
  const riderRetired = (_req: express.Request, res: express.Response) =>
    res.status(410).json({
      error: { code: "ROLE_RETIRED", message: "Rider logistics is no longer supported" },
    });
  app.get("/api/v1/rider/jobs", riderRetired);
  app.patch("/api/v1/rider/jobs/:jobId", riderRetired);
  app.get("/api/v1/listings", requireAuth, async (req, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
      const city = typeof req.query.city === "string" ? req.query.city.trim() : undefined;
      const currency = typeof req.query.currency === "string" ? req.query.currency.trim().toUpperCase() : undefined;
      const type = typeof req.query.type === "string" ? req.query.type.trim().toUpperCase() : undefined;
      const maxPriceMinor = typeof req.query.maxPriceMinor === "string" && /^\d+$/.test(req.query.maxPriceMinor)
        ? BigInt(req.query.maxPriceMinor)
        : undefined;
      const listings = await prisma.listing.findMany({
        where: {
          status: "ACTIVE",
          ...(hasRole(req.user, "VENDOR") ? { vendor: { userId: req.user!.id } } : {}),
          ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
          ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
          ...(currency ? { currency } : {}),
          ...(type ? { type: type as "VENUE" | "GOOD" | "SERVICE" } : {}),
          ...(maxPriceMinor !== undefined ? { priceMinor: { lte: maxPriceMinor } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { vendor: { select: { businessName: true, slug: true } }, category: { select: { name: true } } },
      });
      res.json({ items: listings });
    } catch (error) {
      next(error);
    }
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
