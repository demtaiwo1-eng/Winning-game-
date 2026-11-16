import { Router } from "express";
import { BookingStatus, ListingStatus, ListingType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";

export const marketplaceRouter = Router();

/** Public-friendly catalog (auth optional for future personalization). */

/** Public, read-only catalogue. Only verified vendors and active listings are visible. */
marketplaceRouter.get(
  "/public",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : undefined;
    const city = typeof req.query.city === "string" ? req.query.city.trim().slice(0, 80) : undefined;
    const typeRaw = typeof req.query.type === "string" ? req.query.type.trim().toUpperCase() : undefined;
    const type = typeRaw && ["VENUE", "GOOD", "SERVICE"].includes(typeRaw) ? (typeRaw as ListingType) : undefined;
    const pageRaw = Number(req.query.page ?? 1);
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 10000) : 1;
    const takeRaw = Number(req.query.take ?? 24);
    const take = Number.isInteger(takeRaw) && takeRaw > 0 ? Math.min(takeRaw, 50) : 24;
    const where = {
      status: ListingStatus.ACTIVE,
      vendor: { verification: "VERIFIED" as const, user: { status: "ACTIVE" as const } },
      ...(q ? { OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
        { city: { contains: q, mode: "insensitive" as const } },
      ] } : {}),
      ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
      ...(type ? { type } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.listing.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * take, take,
        select: {
          id: true, title: true, description: true, type: true, priceMinor: true,
          currency: true, country: true, city: true, capacity: true, mediaUrls: true,
          vendor: { select: { businessName: true, slug: true } },
          category: { select: { name: true, slug: true } },
        },
      }),
      prisma.listing.count({ where }),
    ]);
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json({
      items: items.map((item) => ({
        id: item.id, title: item.title, description: item.description, type: item.type,
        priceMinor: item.priceMinor.toString(), currency: item.currency, country: item.country,
        city: item.city, capacity: item.capacity, mediaUrls: item.mediaUrls.slice(0, 6),
        vendorName: item.vendor.businessName, vendorSlug: item.vendor.slug,
        category: item.category.name, categorySlug: item.category.slug,
      })),
      pagination: { page, take, total, totalPages: Math.ceil(total / take) },
    });
  }),
);

marketplaceRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const city = typeof req.query.city === "string" ? req.query.city.trim() : undefined;
    const category = typeof req.query.category === "string" ? req.query.category.trim() : undefined;
    const currency =
      typeof req.query.currency === "string" ? req.query.currency.trim().toUpperCase() : undefined;
    const typeRaw =
      typeof req.query.type === "string" ? req.query.type.trim().toUpperCase() : undefined;
    const type =
      typeRaw && ["VENUE", "GOOD", "SERVICE"].includes(typeRaw)
        ? (typeRaw as ListingType)
        : undefined;

    const items = await prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        ...(currency ? { currency } : {}),
        ...(type ? { type } : {}),
        ...(category
          ? { category: { name: { contains: category, mode: "insensitive" } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        vendor: { select: { businessName: true, slug: true, verification: true } },
        category: { select: { id: true, name: true } },
      },
    });
    const vendorIds = [...new Set(items.map((item) => item.vendorId))];
    const ratings = vendorIds.length
      ? await prisma.review.groupBy({
          by: ["vendorId"],
          where: { vendorId: { in: vendorIds } },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : [];
    const ratingByVendor = new Map(
      ratings.map((rating) => [
        rating.vendorId,
        { average: rating._avg.rating ?? 0, count: rating._count._all },
      ]),
    );

    res.json({
      items: items.map((l) => ({
        ...l,
        priceMinor: l.priceMinor.toString(),
        ratingAvg: ratingByVendor.get(l.vendorId)?.average ?? 0,
        reviewCount: ratingByVendor.get(l.vendorId)?.count ?? 0,
      })),
    });
  }),
);

marketplaceRouter.get(
  "/categories",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const items = await prisma.category.findMany({ orderBy: { name: "asc" } });
    res.json({ items });
  }),
);

marketplaceRouter.get(
  "/reviews/eligible",
  requireAuth,
  requireRole("CLIENT"),
  asyncHandler(async (req, res) => {
    const items = await prisma.booking.findMany({
      where: {
        buyerId: req.user!.id,
        status: BookingStatus.FULFILLED,
        review: null,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        vendor: { select: { businessName: true } },
        items: { include: { listing: { select: { title: true } } } },
      },
    });

    res.json({
      items: items.map((booking) => ({
        id: booking.id,
        status: booking.status,
        currency: booking.currency,
        totalMinor: booking.totalMinor.toString(),
        completedAt: booking.updatedAt,
        vendor: booking.vendor,
        items: booking.items.map((item) => ({
          id: item.id,
          title: item.listing.title,
          quantity: item.quantity,
        })),
      })),
    });
  }),
);

marketplaceRouter.post(
  "/reviews",
  requireAuth,
  requireRole("CLIENT"),
  asyncHandler(async (req, res) => {
    const bookingId = typeof req.body.bookingId === "string" ? req.body.bookingId.trim() : "";
    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";

    if (!bookingId) throw new HttpError(400, "BOOKING_REQUIRED", "bookingId is required");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpError(400, "INVALID_RATING", "rating must be an integer from 1 to 5");
    }
    if (comment.length > 2000) {
      throw new HttpError(400, "COMMENT_TOO_LONG", "comment must be 2000 characters or fewer");
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, buyerId: req.user!.id },
      select: { id: true, vendorId: true, status: true, review: { select: { id: true } } },
    });
    if (!booking) throw new HttpError(404, "BOOKING_NOT_FOUND", "Booking not found");
    if (booking.status !== BookingStatus.FULFILLED) {
      throw new HttpError(409, "BOOKING_NOT_COMPLETED", "Feedback is available after the booking is completed");
    }
    if (booking.review) throw new HttpError(409, "REVIEW_EXISTS", "Feedback has already been submitted for this booking");

    let review;
    try {
      review = await prisma.review.create({
        data: {
          bookingId: booking.id,
          authorId: req.user!.id,
          vendorId: booking.vendorId,
          rating,
          comment: comment || null,
        },
        include: { author: { select: { name: true } } },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new HttpError(409, "REVIEW_EXISTS", "Feedback has already been submitted for this booking");
      }
      throw error;
    }

    res.status(201).json({ review });
  }),
);

marketplaceRouter.get(
  "/:listingId/reviews",
  requireAuth,
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.listingId },
      select: { vendorId: true },
    });
    if (!listing) throw new HttpError(404, "LISTING_NOT_FOUND", "Listing not found");

    const [reviews, aggregate] = await Promise.all([
      prisma.review.findMany({
        where: { vendorId: listing.vendorId },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { author: { select: { name: true } } },
      }),
      prisma.review.aggregate({
        where: { vendorId: listing.vendorId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    res.json({
      items: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        authorName: review.author.name,
        createdAt: review.createdAt,
      })),
      ratingAvg: aggregate._avg.rating ?? 0,
      reviewCount: aggregate._count._all,
    });
  }),
);
