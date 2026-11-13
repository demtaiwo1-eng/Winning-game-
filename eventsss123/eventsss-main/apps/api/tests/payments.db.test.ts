import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { env } from "../src/config/env";
import { bookingCommissionMinor, walletTopupFeeMinor } from "../src/modules/payments/feePolicy";

const app = createApp();
const run = process.env.RUN_DB_TESTS === "1";

async function register(tag: string, role: "CLIENT" | "VENDOR" | "VERIFIER" = "CLIENT") {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
  const response = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "correct-horse-1",
    name: `User ${tag}`,
    role,
    ...(role === "VENDOR" ? { businessName: `Test business ${tag}` } : {}),
  });
  expect(response.status).toBe(201);
  return { token: response.body.accessToken as string, id: response.body.user.id as string };
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe.skipIf(!run)("platform revenue accounting (DB)", () => {
  it("posts wallet top-up fees to platform revenue once without debiting the wallet twice", async () => {
    const customer = await register("platform-topup-fee");
    const intent = await prisma.paymentIntent.create({
      data: {
        userId: customer.id,
        provider: "demo",
        providerRef: `platform-topup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amountMinor: 100000n,
        currency: "NGN",
        purpose: "WALLET_DEPOSIT",
        status: "PENDING",
      },
    });
    try {
      const settled = await request(app).post(`/api/v1/payments/demo-checkout/${intent.id}`)
        .set(auth(customer.token)).set("x-ephinta-test-payment-mode", "demo").send({});
      expect(settled.status).toBe(200);
      const wallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId_currency: { userId: customer.id, currency: "NGN" } },
      });
      const expectedTopupFee = walletTopupFeeMinor(100000n, env);
      expect(wallet.availableMinor).toBe(100000n - expectedTopupFee);
      const revenue = await prisma.platformRevenueEntry.findUniqueOrThrow({
        where: { idempotencyKey: `platform_wallet_topup_fee:${intent.id}` },
      });
      expect(revenue.amountMinor).toBe(expectedTopupFee);
      expect(revenue.refType).toBe("PAYMENT_INTENT");
      expect(revenue.refId).toBe(intent.id);
      expect(await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: `pay_deposit_fee:${intent.id}` } })).toBeNull();

      const replay = await request(app).post(`/api/v1/payments/demo-checkout/${intent.id}`)
        .set(auth(customer.token)).set("x-ephinta-test-payment-mode", "demo").send({});
      expect(replay.status).toBe(200);
      expect((await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).availableMinor).toBe(100000n - expectedTopupFee);
      expect(await prisma.platformRevenueEntry.count({ where: { idempotencyKey: `platform_wallet_topup_fee:${intent.id}` } })).toBe(1);
    } finally {
      const revenue = await prisma.platformRevenueEntry.findUnique({
        where: { idempotencyKey: `platform_wallet_topup_fee:${intent.id}` },
      });
      if (revenue) {
        await prisma.platformRevenueAccount.update({
          where: { id: revenue.accountId },
          data: { balanceMinor: { decrement: revenue.amountMinor } },
        });
        await prisma.platformRevenueEntry.delete({ where: { id: revenue.id } });
      }
      await prisma.paymentIntent.deleteMany({ where: { id: intent.id } });
      await prisma.ledgerEntry.deleteMany({ where: { wallet: { userId: customer.id } } });
      await prisma.wallet.deleteMany({ where: { userId: customer.id } });
      await prisma.user.deleteMany({ where: { id: customer.id } });
    }
  });
});

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
    let bookingId: string | undefined;

    const vendorProfile = await prisma.vendorProfile.findUniqueOrThrow({ where: { userId: vendor.id } });
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
      update: { availableMinor: 110000n, escrowMinor: 0n },
      create: { userId: planner.id, currency: "NGN", availableMinor: 110000n, escrowMinor: 0n },
    });
    await prisma.eventReadiness.upsert({
      where: { eventId },
      update: { assignedVerifierId: verifier.id },
      create: { eventId, assignedVerifierId: verifier.id, status: "NOT_STARTED" },
    });

    try {
      const eventDeposit = await request(app).post(`/api/v1/events/${eventId}/deposits`).set(auth(planner.token))
        .send({ amountMinor: "10000", idempotencyKey: `full-flow-deposit-${eventId}` });
      expect(eventDeposit.status).toBe(201);
      const depositBudget = await request(app).get(`/api/v1/events/${eventId}/budget`).set(auth(planner.token));
      expect(depositBudget.body.funding.depositTotalMinor).toBe("10000");
      const walletAfterEventDeposit = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      expect(walletAfterEventDeposit.availableMinor).toBe(100000n);
      expect(walletAfterEventDeposit.escrowMinor).toBe(10000n);

      const created = await request(app).post("/api/v1/payments/book").set(auth(planner.token))
        .send({ listingId: listing.id, eventId, quantity: 1, initialPaymentMinor: "20000", idempotencyKey: `initial-${eventId}` });
      expect(created.status).toBe(201);
      const booking = created.body.booking;
      bookingId = booking.id as string;
      expect(booking.status).toBe("PENDING");
      expect(booking.paidMinor).toBe("20000");
      expect(booking.totalMinor).toBe("100000");
      const initialBudget = await request(app).get(`/api/v1/events/${eventId}/budget`).set(auth(planner.token));
      expect(initialBudget.body.funding.bookingPaymentsHeldMinor).toBe("20000");
      const replay = await request(app).post("/api/v1/payments/book").set(auth(planner.token))
        .send({ listingId: listing.id, eventId, quantity: 1, initialPaymentMinor: "20000", idempotencyKey: `initial-${eventId}` });
      expect(replay.status).toBe(201);
      expect(replay.body.booking.id).toBe(booking.id);
      const walletAfterReplay = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      expect(walletAfterReplay.availableMinor).toBe(80000n);
      expect(walletAfterReplay.escrowMinor).toBe(30000n);

      const personalMessage = await request(app).post(`/api/v1/events/${eventId}/messages`).set(auth(planner.token))
        .send({ recipientIds: [vendor.id], body: "Please confirm the catering essentials." });
      expect(personalMessage.status).toBe(201);
      expect(personalMessage.body.items).toHaveLength(1);
      const vendorInbox = await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(vendor.token));
      expect(vendorInbox.body.items.some((message: { body: string }) => message.body === "Please confirm the catering essentials.")).toBe(true);
      const teamMessage = await request(app).post(`/api/v1/events/${eventId}/messages`).set(auth(planner.token))
        .send({ broadcast: true, body: "The event team schedule is confirmed." });
      expect(teamMessage.status).toBe(201);
      expect(teamMessage.body.items).toHaveLength(2);
      const verifierInbox = await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(verifier.token));
      expect(verifierInbox.body.items.some((message: { body: string }) => message.body === "The event team schedule is confirmed.")).toBe(true);
      expect((await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(outsider.token))).status).toBe(403);

      const concurrentRequests = await Promise.all([
        request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`)
          .set(auth(vendor.token)).send({ amountMinor: "45000", reason: "Concurrent essential materials request A", idempotencyKey: `concurrent-request-a-${booking.id}` }),
        request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`)
          .set(auth(vendor.token)).send({ amountMinor: "45000", reason: "Concurrent essential materials request B", idempotencyKey: `concurrent-request-b-${booking.id}` }),
      ]);
      expect(concurrentRequests.map((response) => response.status).sort()).toEqual([201, 409]);
      const reservedRequest = concurrentRequests.find((response) => response.status === 201)!.body.request;
      expect((await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests/${reservedRequest.id}/reject`)
        .set(auth(planner.token)).send({})).status).toBe(200);

      const requestPayload = {
        amountMinor: "30000",
        reason: "Purchase essential catering ingredients",
        idempotencyKey: `vendor-essentials-${booking.id}`,
      };
      const firstRequestPair = await Promise.all([
        request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`).set(auth(vendor.token)).send(requestPayload),
        request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`).set(auth(vendor.token)).send(requestPayload),
      ]);
      expect(firstRequestPair.map((response) => response.status).sort()).toEqual([200, 201]);
      expect(firstRequestPair[0].body.request.id).toBe(firstRequestPair[1].body.request.id);
      const firstRequest = firstRequestPair.find((response) => response.status === 201)!;
      const paymentRequestId = firstRequest.body.request.id as string;
      expect(await prisma.bookingPaymentRequest.count({
        where: { bookingId: booking.id, idempotencyKey: `booking-payment-request:${vendor.id}:${booking.id}:${requestPayload.idempotencyKey}` },
      })).toBe(1);
      const changedReplay = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`)
        .set(auth(vendor.token)).send({ ...requestPayload, amountMinor: "30001" });
      expect(changedReplay.status).toBe(409);

      expect((await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests/${paymentRequestId}/approve`)
        .set(auth(outsider.token)).send({})).status).toBe(403);

      const approval = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests/${paymentRequestId}/approve`)
        .set(auth(planner.token)).send({});
      expect(approval.status).toBe(200);
      expect(approval.body.status).toBe("paid_into_escrow");

      const tooMuch = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`)
        .set(auth(vendor.token)).send({ amountMinor: "60000", reason: "Remaining essentials and final setup", idempotencyKey: `too-much-request-${booking.id}` });
      expect(tooMuch.status).toBe(409);

      const finalRequest = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests`)
        .set(auth(vendor.token)).send({ amountMinor: "50000", reason: "Final agreed service milestone", idempotencyKey: `final-milestone-${booking.id}` });
      expect(finalRequest.status).toBe(201);
      const finalId = finalRequest.body.request.id as string;
      const finalApproval = await request(app).post(`/api/v1/payments/bookings/${booking.id}/payment-requests/${finalId}/approve`)
        .set(auth(planner.token)).send({});
      expect(finalApproval.status).toBe(200);

      const refreshed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(refreshed.paidMinor).toBe(100000n);
      expect(refreshed.status).toBe("PAID");
      const fullyFundedBudget = await request(app).get(`/api/v1/events/${eventId}/budget`).set(auth(planner.token));
      expect(fullyFundedBudget.body.funding.bookingPaymentsHeldMinor).toBe("100000");
      const updatedWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      expect(updatedWallet.availableMinor).toBe(0n);
      expect(updatedWallet.escrowMinor).toBe(110000n);
      const fundedBudget = await request(app).get(`/api/v1/events/${eventId}/budget`).set(auth(planner.token));
      expect(fundedBudget.body.funding.depositTotalMinor).toBe("10000");
      expect(fundedBudget.body.funding.bookingPaymentsHeldMinor).toBe("100000");
      expect(await prisma.ledgerEntry.count({ where: { refType: "BOOKING_PAYMENT_REQUEST", refId: { in: [paymentRequestId, finalId] } } })).toBe(2);

      const vendorBookings = await request(app).get("/api/v1/payments/bookings?as=vendor").set(auth(vendor.token));
      expect(vendorBookings.body.items.find((item: { id: string }) => item.id === booking.id).paidMinor).toBe("100000");
      await prisma.event.update({
        where: { id: eventId },
        data: { startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000), endsAt: new Date(Date.now() - 60_000) },
      });
      const serviceCheck = await prisma.eventServiceCheck.findFirst({ where: { eventId, bookingId: booking.id } });
      expect(serviceCheck).toBeTruthy();
      const confirmation = await request(app).patch(`/api/v1/readiness/checks/${serviceCheck!.id}`)
        .set(auth(verifier.token)).send({ status: "GREEN", notes: "Service delivered and checked by assigned verifier" });
      expect(confirmation.status).toBe(200);
      expect(confirmation.body.check.status).toBe("GREEN");
      const finalized = await request(app).post(`/api/v1/readiness/events/${eventId}/finalize`).set(auth(verifier.token)).send({});
      expect(finalized.status).toBe(200);
      expect(finalized.body.event.status).toBe("COMPLETED");
      const released = await request(app).post(`/api/v1/payments/bookings/${booking.id}/release`).set(auth(verifier.token)).send({});
      expect(released.status).toBe(200);
      expect(released.body.status).toBe("FULFILLED");
      const buyerWalletAfterRelease = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      expect(buyerWalletAfterRelease.escrowMinor).toBe(10000n);
      const vendorWallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId_currency: { userId: vendor.id, currency: "NGN" } },
      });
      const expectedCommission = bookingCommissionMinor(100000n, env);
      const platformAccount = await prisma.platformRevenueAccount.findUniqueOrThrow({ where: { currency: "NGN" } });
      const platformEntry = await prisma.platformRevenueEntry.findUniqueOrThrow({
        where: { idempotencyKey: `platform_commission:${booking.id}` },
      });
      expect(platformEntry.amountMinor).toBe(expectedCommission);
      expect(platformAccount.balanceMinor).toBeGreaterThanOrEqual(expectedCommission);
      expect(platformEntry.refType).toBe("BOOKING");
      expect(platformEntry.refId).toBe(booking.id);
      expect(await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: `commission:${booking.id}` } })).toBeNull();
      expect(vendorWallet.availableMinor).toBe(100000n - expectedCommission);
      const replayRelease = await request(app).post(`/api/v1/payments/bookings/${booking.id}/release`).set(auth(verifier.token)).send({});
      expect(replayRelease.status).toBe(200);
      expect(replayRelease.body.alreadyReleased).toBe(true);
      expect(await prisma.platformRevenueEntry.count({ where: { idempotencyKey: `platform_commission:${booking.id}` } })).toBe(1);
      const releasedBudget = await request(app).get(`/api/v1/events/${eventId}/budget`).set(auth(planner.token));
      expect(releasedBudget.body.funding.bookingPaymentsHeldMinor).toBe("0");
    } finally {
      // Keep the shared platform account balanced while removing this isolated fixture.
      if (bookingId) {
        const revenueEntry = await prisma.platformRevenueEntry.findUnique({ where: { idempotencyKey: `platform_commission:${bookingId}` } });
        if (revenueEntry) {
          await prisma.platformRevenueAccount.update({
            where: { id: revenueEntry.accountId },
            data: { balanceMinor: { decrement: revenueEntry.amountMinor } },
          });
          await prisma.platformRevenueEntry.delete({ where: { id: revenueEntry.id } });
        }
        await prisma.booking.deleteMany({ where: { id: bookingId } });
      }
      await prisma.event.delete({ where: { id: eventId } });
      await prisma.listing.delete({ where: { id: listing.id } });
    }
  }, 45_000);
});