import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

const app = createApp();
const run = process.env.RUN_DB_TESTS === "1";

async function register(tag: string, role: "CLIENT" | "VENDOR" | "VERIFIER" = "CLIENT") {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
  const response = await request(app).post("/api/v1/auth/register").send({
    email, password: "correct-horse-1", name: `User ${tag}`, role,
  });
  expect(response.status).toBe(201);
  return { token: response.body.accessToken as string, id: response.body.user.id as string };
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe.skipIf(!run)("booking payment milestones (DB)", () => {
  it("holds a planner's initial payment, lets a vendor request milestones, and requires planner approval", async () => {
    const planner = await register("installment-planner");
    const vendor = await register("installment-vendor", "VENDOR");
    const verifier = await register("installment-verifier", "VERIFIER");
    const outsider = await register("installment-outsider");
    const eventResponse = await request(app).post("/api/v1/events").set(auth(planner.token))
      .send({ title: "Milestone payment event", type: "PERSONAL", currency: "NGN" });
    expect(eventResponse.status).toBe(201);
    const eventId = eventResponse.body.event.id as string;

    const vendorProfile = await prisma.vendorProfile.create({
      data: {
        userId: vendor.id,
        businessName: "Milestone Test Vendor",
        slug: `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
    });
    const category = await prisma.category.upsert({
      where: { slug: "milestone-test-services" },
      update: {},
      create: { name: "Milestone Test Services", slug: "milestone-test-services" },
    });
    const listing = await prisma.listing.create({
      data: {
        vendorId: vendorProfile.id,
        categoryId: category.id,
        type: "SERVICE",
        title: "Event essential service",
        priceMinor: 100000n,
        currency: "NGN",
        status: "ACTIVE",
        mediaUrls: [],
      },
    });
    const wallet = await prisma.wallet.upsert({
      where: { userId_currency: { userId: planner.id, currency: "NGN" } },
      update: { availableMinor: 100000n, escrowMinor: 0n },
      create: { userId: planner.id, currency: "NGN", availableMinor: 100000n, escrowMinor: 0n },
    });
    await prisma.eventReadiness.upsert({
      where: { eventId },
      update: { assignedVerifierId: verifier.id },
      create: { eventId, assignedVerifierId: verifier.id, status: "NOT_STARTED" },
    });

    try {
      const created = await request(app).post("/api/v1/payments/book").set(auth(planner.token))
        .send({ listingId: listing.id, eventId, quantity: 1, initialPaymentMinor: "20000", idempotencyKey: `initial-${eventId}` });
      expect(created.status).toBe(201);
      const booking = created.body.booking;
      expect(booking.status).toBe("PENDING");
      expect(booking.paidMinor).toBe("20000");
      expect(booking.totalMinor).toBe("100000");
      const replay = await request(app).post("/api/v1/payments/book").set(auth(planner.token))
        .send({ listingId: listing.id, eventId, quantity: 1, initialPaymentMinor: "20000", idempotencyKey: `initial-${eventId}` });
      expect(replay.status).toBe(201);
      expect(replay.body.booking.id).toBe(booking.id);
      const walletAfterReplay = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      expect(walletAfterReplay.availableMinor).toBe(80000n);
      expect(walletAfterReplay.escrowMinor).toBe(20000n);

      const firstRequest = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`)
        .set(auth(vendor.token)).send({ amountMinor: "30000", reason: "Purchase essential catering ingredients" });
      expect(firstRequest.status).toBe(201);
      const paymentRequestId = firstRequest.body.request.id as string;

      expect((await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests/${paymentRequestId}/approve`)
        .set(auth(outsider.token)).send({})).status).toBe(403);

      const approval = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests/${paymentRequestId}/approve`)
        .set(auth(planner.token)).send({});
      expect(approval.status).toBe(200);
      expect(approval.body.status).toBe("paid_into_escrow");

      const tooMuch = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`)
        .set(auth(vendor.token)).send({ amountMinor: "60000", reason: "Remaining essentials and final setup" });
      expect(tooMuch.status).toBe(409);

      const finalRequest = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`)
        .set(auth(vendor.token)).send({ amountMinor: "50000", reason: "Final agreed service milestone" });
      expect(finalRequest.status).toBe(201);
      const finalId = finalRequest.body.request.id as string;
      const finalApproval = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests/${finalId}/approve`)
        .set(auth(planner.token)).send({});
      expect(finalApproval.status).toBe(200);

      const refreshed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(refreshed.paidMinor).toBe(100000n);
      expect(refreshed.status).toBe("PAID");
      const updatedWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      expect(updatedWallet.availableMinor).toBe(0n);
      expect(updatedWallet.escrowMinor).toBe(100000n);
      expect(await prisma.ledgerEntry.count({ where: { refType: "BOOKING_PAYMENT_REQUEST", refId: { in: [paymentRequestId, finalId] } } })).toBe(2);

      const vendorBookings = await request(app).get("/api/v1/payments/bookings?as=vendor").set(auth(vendor.token));
      expect(vendorBookings.body.items.find((item: { id: string }) => item.id === booking.id).paidMinor).toBe("100000");
      await prisma.event.update({
        where: { id: eventId },
        data: { startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000), endsAt: new Date(Date.now() - 60_000) },
      });
      const serviceCheck = await prisma.eventServiceCheck.findFirst({ where: { eventId, bookingId: booking.id } });
      expect(serviceCheck).toBeTruthy();
      await prisma.eventServiceCheck.update({ where: { id: serviceCheck!.id }, data: { status: "GREEN" } });
      const finalized = await request(app).post(`/api/v1/readiness/events/${eventId}/finalize`).set(auth(verifier.token)).send({});
      expect(finalized.status).toBe(200);
      expect(finalized.body.event.status).toBe("COMPLETED");
      const released = await request(app).post(`/api/v1/payments/bookings/${booking.id}/release`).set(auth(verifier.token)).send({});
      expect(released.status).toBe(200);
      expect(released.body.status).toBe("FULFILLED");
      const buyerWalletAfterRelease = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      expect(buyerWalletAfterRelease.escrowMinor).toBe(0n);
      const vendorWallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId_currency: { userId: vendor.id, currency: "NGN" } },
      });
      expect(vendorWallet.availableMinor).toBeGreaterThan(0n);
    } finally {
      await prisma.event.delete({ where: { id: eventId } });
      await prisma.listing.delete({ where: { id: listing.id } });
      await prisma.vendorProfile.delete({ where: { id: vendorProfile.id } });
    }
  }, 45_000);
});
