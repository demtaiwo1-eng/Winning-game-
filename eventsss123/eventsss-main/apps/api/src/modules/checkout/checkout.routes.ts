import { Router } from "express";
import { BookingStatus, CartStatus, CheckoutSessionStatus, LedgerType, ListingStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { env } from "../../config/env";
import { commissionMinor } from "../../lib/money";

export const checkoutRouter = Router();
const SESSION_MINUTES = 30;

function positiveInt(value: unknown, fallback = 1) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 1000) return fallback;
  return n;
}

async function ownedEvent(userId: string, eventId: string | null) {
  if (!eventId) return null;
  const event = await prisma.event.findFirst({ where: { id: eventId, ownerId: userId } });
  if (!event) throw new HttpError(403, "EVENT_ACCESS_DENIED", "You do not have access to this event");
  return event;
}

/**
 * Prisma cannot represent a nullable unique component consistently across
 * databases, so the public cart lookup uses an explicit query rather than
 * relying on a synthetic compound unique key.
 */
async function getOrCreateCart(userId: string, eventId: string | null, currency: string) {
  let cart = await prisma.cart.findFirst({
    where: { userId, eventId, currency, status: CartStatus.ACTIVE },
    include: { items: { include: { listing: { include: { vendor: true, category: true } } } } },
  });
  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId, eventId, currency, status: CartStatus.ACTIVE },
      include: { items: { include: { listing: { include: { vendor: true, category: true } } } } },
    });
  }
  return cart;
}

function serializeCart(cart: any) {
  return {
    id: cart.id,
    eventId: cart.eventId,
    currency: cart.currency,
    status: cart.status,
    items: cart.items.map((item: any) => ({
      id: item.id,
      listingId: item.listingId,
      title: item.listing.title,
      vendor: item.listing.vendor?.businessName,
      vendorVerification: item.listing.vendor?.verification,
      category: item.listing.category?.name,
      quantity: item.quantity,
      unitPriceMinor: item.listing.priceMinor.toString(),
      lineTotalMinor: (item.listing.priceMinor * BigInt(item.quantity)).toString(),
      currency: item.listing.currency,
    })),
  };
}

checkoutRouter.get("/cart", requireAuth, asyncHandler(async (req, res) => {
  const eventId = typeof req.query.eventId === "string" ? req.query.eventId : null;
  await ownedEvent(req.user!.id, eventId);
  const currency = typeof req.query.currency === "string" ? req.query.currency.toUpperCase() : env.DEFAULT_CURRENCY;
  const cart = await getOrCreateCart(req.user!.id, eventId, currency);
  res.json({ cart: serializeCart(cart) });
}));

checkoutRouter.post("/cart/items", requireAuth, asyncHandler(async (req, res) => {
  const listingId = String(req.body.listingId || "");
  const quantity = positiveInt(req.body.quantity);
  const eventId = typeof req.body.eventId === "string" ? req.body.eventId : null;
  if (!listingId) throw new HttpError(400, "LISTING_REQUIRED", "listingId is required");
  await ownedEvent(req.user!.id, eventId);

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, status: ListingStatus.ACTIVE },
    include: { vendor: true, category: true },
  });
  if (!listing) throw new HttpError(404, "LISTING_NOT_FOUND", "Listing is not active or does not exist");
  if (listing.vendor.verification !== "VERIFIED") {
    throw new HttpError(409, "VENDOR_NOT_VERIFIED", "This vendor must complete verification before the service can be added to checkout");
  }

  const cart = await getOrCreateCart(req.user!.id, eventId, listing.currency);
  if (cart.currency !== listing.currency) {
    throw new HttpError(409, "CURRENCY_MISMATCH", "A cart can contain items in one currency only");
  }
  const item = await prisma.cartItem.upsert({
    where: { cartId_listingId: { cartId: cart.id, listingId } },
    create: { cartId: cart.id, listingId, quantity },
    update: { quantity: { increment: quantity } },
    include: { listing: { include: { vendor: true, category: true } } },
  });
  const fresh = await prisma.cart.findUniqueOrThrow({
    where: { id: cart.id },
    include: { items: { include: { listing: { include: { vendor: true, category: true } } } } },
  });
  res.status(201).json({ item, cart: serializeCart(fresh) });
}));

checkoutRouter.patch("/cart/items/:itemId", requireAuth, asyncHandler(async (req, res) => {
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
    throw new HttpError(400, "INVALID_QUANTITY", "quantity must be an integer from 1 to 1000");
  }
  const item = await prisma.cartItem.findFirst({
    where: { id: req.params.itemId, cart: { userId: req.user!.id, status: CartStatus.ACTIVE } },
  });
  if (!item) throw new HttpError(404, "CART_ITEM_NOT_FOUND", "Cart item not found");
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  const cart = await prisma.cart.findUniqueOrThrow({
    where: { id: item.cartId },
    include: { items: { include: { listing: { include: { vendor: true, category: true } } } } },
  });
  res.json({ cart: serializeCart(cart) });
}));

checkoutRouter.delete("/cart/items/:itemId", requireAuth, asyncHandler(async (req, res) => {
  const item = await prisma.cartItem.findFirst({
    where: { id: req.params.itemId, cart: { userId: req.user!.id, status: CartStatus.ACTIVE } },
  });
  if (!item) throw new HttpError(404, "CART_ITEM_NOT_FOUND", "Cart item not found");
  await prisma.cartItem.delete({ where: { id: item.id } });
  res.json({ ok: true });
}));

checkoutRouter.post("/checkout-sessions", requireAuth, asyncHandler(async (req, res) => {
  const cartId = typeof req.body.cartId === "string" ? req.body.cartId : null;
  const eventId = typeof req.body.eventId === "string" ? req.body.eventId : null;
  if (eventId) await ownedEvent(req.user!.id, eventId);

  const cart = cartId
    ? await prisma.cart.findFirst({
        where: { id: cartId, userId: req.user!.id, status: CartStatus.ACTIVE },
        include: { items: { include: { listing: { include: { vendor: true, category: true } } } } },
      })
    : await getOrCreateCart(req.user!.id, eventId, env.DEFAULT_CURRENCY);

  if (!cart) throw new HttpError(404, "CART_NOT_FOUND", "Active cart not found");
  if (cart.items.length === 0) throw new HttpError(400, "EMPTY_CART", "Add at least one verified vendor service before checkout");
  if (cart.eventId && eventId && cart.eventId !== eventId) throw new HttpError(409, "EVENT_MISMATCH", "Cart and checkout event do not match");

  const checkoutEventId = cart.eventId ?? eventId;
  if (!checkoutEventId) {
    throw new HttpError(400, "EVENT_REQUIRED", "Choose an event before starting checkout");
  }
  const event = await ownedEvent(req.user!.id, checkoutEventId);
  if (!event) throw new HttpError(404, "EVENT_REQUIRED", "Choose an event before starting checkout");
  if (event.status === "COMPLETED" || event.status === "CANCELLED") {
    throw new HttpError(409, "INVALID_EVENT_STATE", "Cannot book services for a completed or cancelled event");
  }
  const readiness = await prisma.eventReadiness.findUnique({
    where: { eventId: event.id },
    select: { assignedVerifierId: true },
  });
  if (!readiness?.assignedVerifierId) {
    throw new HttpError(409, "VERIFIER_REQUIRED", "Select a lead verifier before starting checkout");
  }
  for (const item of cart.items) {
    if (item.listing.status !== ListingStatus.ACTIVE) throw new HttpError(409, "LISTING_UNAVAILABLE", `${item.listing.title} is no longer available`);
    if (item.listing.vendor.verification !== "VERIFIED") throw new HttpError(409, "VENDOR_NOT_VERIFIED", `${item.listing.vendor.businessName} is not verified`);
    if (item.listing.currency !== cart.currency) throw new HttpError(409, "CURRENCY_MISMATCH", "All checkout items must use the same currency");
  }

  const subtotal = cart.items.reduce((sum, item) => sum + item.listing.priceMinor * BigInt(item.quantity), 0n);
  const commission = commissionMinor(subtotal, env.COMMISSION_BPS);
  const total = subtotal;
  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60_000);

  const session = await prisma.$transaction(async tx => {
    const created = await tx.checkoutSession.create({
      data: {
        userId: req.user!.id,
        cartId: cart.id,
        eventId: event.id,
        currency: cart.currency,
        subtotalMinor: subtotal,
        commissionMinor: commission,
        totalMinor: total,
        status: CheckoutSessionStatus.OPEN,
        expiresAt,
        items: {
          create: cart.items.map(item => ({
            listingId: item.listingId,
            vendorId: item.listing.vendorId,
            title: item.listing.title,
            quantity: item.quantity,
            unitPriceMinor: item.listing.priceMinor,
            currency: item.listing.currency,
          })),
        },
      },
      include: { items: true },
    });
    await tx.checkoutSession.update({ where: { id: created.id }, data: { status: CheckoutSessionStatus.PAYMENT_PENDING } });
    return created;
  });

  res.status(201).json({
    session: {
      id: session.id,
      status: CheckoutSessionStatus.PAYMENT_PENDING,
      currency: session.currency,
      subtotalMinor: session.subtotalMinor.toString(),
      commissionMinor: session.commissionMinor.toString(),
      totalMinor: session.totalMinor.toString(),
      expiresAt: session.expiresAt,
      items: session.items.map(i => ({ ...i, unitPriceMinor: i.unitPriceMinor.toString() })),
      paymentMethods: ["WALLET"],
    },
  });
}));

checkoutRouter.get("/checkout-sessions/:id", requireAuth, asyncHandler(async (req, res) => {
  const session = await prisma.checkoutSession.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { items: { include: { vendor: { select: { businessName: true, verification: true } } } } },
  });
  if (!session) throw new HttpError(404, "CHECKOUT_NOT_FOUND", "Checkout session not found");
  if (session.status === CheckoutSessionStatus.PAYMENT_PENDING && session.expiresAt.getTime() <= Date.now()) {
    await prisma.checkoutSession.update({ where: { id: session.id }, data: { status: CheckoutSessionStatus.EXPIRED } });
    return res.status(410).json({ error: { code: "CHECKOUT_EXPIRED", message: "Checkout session has expired" } });
  }
  res.json({ session: {
    ...session,
    subtotalMinor: session.subtotalMinor.toString(),
    commissionMinor: session.commissionMinor.toString(),
    totalMinor: session.totalMinor.toString(),
    items: session.items.map(i => ({ ...i, unitPriceMinor: i.unitPriceMinor.toString() })),
  }});
}));

checkoutRouter.post("/checkout-sessions/:id/pay-with-wallet", requireAuth, asyncHandler(async (req, res) => {
  const idempotencyKey = typeof req.body.idempotencyKey === "string" && req.body.idempotencyKey.trim()
    ? req.body.idempotencyKey.trim()
    : `checkout:${req.params.id}:${req.user!.id}`;

  const result = await prisma.$transaction(async tx => {
    const session = await tx.checkoutSession.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { items: true },
    });
    if (!session) throw new HttpError(404, "CHECKOUT_NOT_FOUND", "Checkout session not found");
    if (session.status === CheckoutSessionStatus.PAID) return { session, bookings: [] as any[] };
    if (session.status !== CheckoutSessionStatus.PAYMENT_PENDING && session.status !== CheckoutSessionStatus.OPEN) {
      throw new HttpError(409, "CHECKOUT_NOT_PAYABLE", `Checkout is ${session.status.toLowerCase()}`);
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      await tx.checkoutSession.update({ where: { id: session.id }, data: { status: CheckoutSessionStatus.EXPIRED } });
      throw new HttpError(410, "CHECKOUT_EXPIRED", "Checkout session has expired");
    }
    const eventId = session.eventId;
    if (!eventId) {
      throw new HttpError(409, "EVENT_REQUIRED", "Checkout session is not linked to an event");
    }
    const event = await tx.event.findFirst({
      where: { id: eventId, ownerId: req.user!.id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: { readiness: { select: { assignedVerifierId: true } } },
    });
    if (!event) throw new HttpError(409, "INVALID_EVENT_STATE", "Event is unavailable for checkout");
    if (!event.readiness?.assignedVerifierId) {
      throw new HttpError(409, "VERIFIER_REQUIRED", "Select a lead verifier before payment");
    }

    const wallet = await tx.wallet.findUnique({
      where: { userId_currency: { userId: req.user!.id, currency: session.currency } },
    });
    if (!wallet || wallet.availableMinor < session.totalMinor) {
      throw new HttpError(400, "INSUFFICIENT_FUNDS", `Need ${session.totalMinor.toString()} ${session.currency} available in your wallet`);
    }

    const bookings: any[] = [];
    let totalHeld = 0n;
    for (const item of session.items) {
      const listing = await tx.listing.findFirst({
        where: { id: item.listingId, status: ListingStatus.ACTIVE },
        include: { vendor: true },
      });
      if (!listing) throw new HttpError(409, "LISTING_UNAVAILABLE", `${item.title} is no longer available`);
      if (listing.vendor.verification !== "VERIFIED") throw new HttpError(409, "VENDOR_NOT_VERIFIED", `${listing.vendor.businessName} is not verified`);
      if (listing.currency !== session.currency || listing.priceMinor !== item.unitPriceMinor) {
        throw new HttpError(409, "PRICE_CHANGED", `${item.title} changed price or currency; rebuild checkout`);
      }

      // A vendor-managed calendar becomes authoritative once slots exist for a listing.
      const configuredSlots = await tx.listingAvailability.count({ where: { listingId: listing.id } });
      if (configuredSlots > 0) {
        if (!event.startsAt || !event.endsAt || event.endsAt <= event.startsAt) {
          throw new HttpError(409, "EVENT_DATES_REQUIRED", `${item.title} requires an event with valid start and end dates`);
        }
        const slot = await tx.listingAvailability.findFirst({
          where: { listingId: listing.id, startsAt: { lte: event.startsAt }, endsAt: { gte: event.endsAt } },
          orderBy: { startsAt: "asc" },
        });
        if (!slot) throw new HttpError(409, "LISTING_NOT_AVAILABLE", `${item.title} has no availability covering this event`);
        const reserved = await tx.bookingItem.aggregate({
          where: {
            listingId: listing.id,
            booking: {
              status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED, BookingStatus.FULFILLED, BookingStatus.DISPUTED] },
              event: { startsAt: { lt: event.endsAt }, endsAt: { gt: event.startsAt } },
            },
          },
          _sum: { quantity: true },
        });
        const alreadyReserved = reserved._sum.quantity || 0;
        if (alreadyReserved + item.quantity > slot.capacity) {
          throw new HttpError(409, "LISTING_CAPACITY_EXCEEDED", `${item.title} has insufficient remaining capacity for these dates`);
        }
      }

      const subtotal = item.unitPriceMinor * BigInt(item.quantity);
      const commission = commissionMinor(subtotal, env.COMMISSION_BPS);
      const booking = await tx.booking.create({
        data: {
          buyerId: req.user!.id,
          vendorId: listing.vendorId,
          eventId: session.eventId,
          status: BookingStatus.PAID,
          currency: session.currency,
          subtotalMinor: subtotal,
          commissionMinor: commission,
          totalMinor: subtotal,
          items: { create: { listingId: listing.id, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor } },
        },
      });
      bookings.push(booking);
      await tx.eventServiceCheck.create({
        data: {
          eventId,
          bookingId: booking.id,
          listingId: listing.id,
          label: listing.title,
          category: listing.type,
          status: "PENDING",
        },
      });
      totalHeld += subtotal;
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.ESCROW_HOLD,
          amountMinor: subtotal,
          balanceAfterMinor: wallet.availableMinor - totalHeld,
          refType: "CHECKOUT_SESSION",
          refId: session.id,
          idempotencyKey: `${idempotencyKey}:${item.id}`,
        },
      });
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { availableMinor: wallet.availableMinor - totalHeld, escrowMinor: wallet.escrowMinor + totalHeld },
    });
    const updated = await tx.checkoutSession.update({
      where: { id: session.id },
      data: { status: CheckoutSessionStatus.PAID },
    });
    if (session.cartId) await tx.cart.update({ where: { id: session.cartId }, data: { status: CartStatus.CHECKED_OUT } });
    return { session: updated, bookings };
  }, { isolationLevel: "Serializable" });

  res.json({
    status: "paid",
    sessionId: result.session.id,
    bookingIds: result.bookings.map((b: any) => b.id),
    totalMinor: result.session.totalMinor.toString(),
    currency: result.session.currency,
  });
}));

checkoutRouter.post("/checkout-sessions/:id/cancel", requireAuth, asyncHandler(async (req, res) => {
  const session = await prisma.checkoutSession.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!session) throw new HttpError(404, "CHECKOUT_NOT_FOUND", "Checkout session not found");
  if (session.status === CheckoutSessionStatus.PAID) throw new HttpError(409, "CHECKOUT_PAID", "A paid checkout cannot be cancelled");
  const updated = await prisma.checkoutSession.update({ where: { id: session.id }, data: { status: CheckoutSessionStatus.CANCELLED } });
  res.json({ session: { id: updated.id, status: updated.status } });
}));
