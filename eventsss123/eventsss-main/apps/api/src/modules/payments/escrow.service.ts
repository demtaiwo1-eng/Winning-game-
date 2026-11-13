import { BookingStatus, LedgerType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/errors";
import { env } from "../../config/env";
import { bookingCommissionMinor } from "./feePolicy";
import { recordPlatformRevenue } from "./platformRevenue.service";
import { assertEscrowReleaseAllowed } from "./escrowPolicy";

/**
 * Release booking escrow to vendor (minus commission).
 * Vendor payout and platform commission are separate journal movements.
 * Idempotency keys: release:{bookingId}, vendor_release:{bookingId},
 * platform_commission:{bookingId}.
 */
export async function releaseBookingEscrow(bookingId: string, actorUserId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vendor: true },
  });
  if (!booking) throw new HttpError(404, "NOT_FOUND", "Booking not found");
  if (!booking.eventId) {
    throw new HttpError(409, "EVENT_REQUIRED", "Escrow release requires an event and its assigned verifier");
  }
  const event = await prisma.event.findUnique({
    where: { id: booking.eventId },
    include: {
      readiness: { select: { assignedVerifierId: true } },
      serviceChecks: { select: { status: true } },
    },
  });
  if (!event) throw new HttpError(409, "EVENT_REQUIRED", "Booking event is not available for verifier confirmation");
  assertEscrowReleaseAllowed({
    actorUserId,
    assignedVerifierId: event.readiness?.assignedVerifierId ?? null,
    eventStatus: event.status,
    eventEndsAt: event.endsAt,
    checkCount: event.serviceChecks.length,
    greenCount: event.serviceChecks.filter((check) => check.status === "GREEN").length,
  });
  if (
    booking.status !== BookingStatus.PAID &&
    booking.status !== BookingStatus.CONFIRMED &&
    booking.status !== BookingStatus.FULFILLED
  ) {
    throw new HttpError(400, "INVALID_STATE", `Cannot release from status ${booking.status}`);
  }

  const commission = booking.commissionMinor > 0n
    ? booking.commissionMinor
    : bookingCommissionMinor(booking.totalMinor, env);
  const vendorNet = booking.totalMinor - commission;
  const currency = booking.currency;
  const idempotencyKey = `release:${booking.id}`;

  // Older releases wrote commission as an informational vendor-wallet row.
  // Ensure the platform journal is populated even when replaying an already
  // fulfilled booking created before this accounting correction.
  if (booking.status === BookingStatus.FULFILLED) {
    await prisma.$transaction(async (tx) => {
      await recordPlatformRevenue(tx, { amountMinor: commission, currency, refType: "BOOKING", refId: booking.id, idempotencyKey: `platform_commission:${booking.id}` });
      if (booking.commissionMinor === 0n && commission > 0n) {
        await tx.booking.update({ where: { id: booking.id }, data: { commissionMinor: commission } });
      }
    });
    return {
      status: "FULFILLED" as const,
      bookingId: booking.id,
      vendorNetMinor: vendorNet.toString(),
      commissionMinor: commission.toString(),
      currency,
      alreadyReleased: true,
    };
  }

  const vendorUserId = booking.vendor.userId;
  await prisma.$transaction(async (tx) => {
    const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
    if (existing) {
      await recordPlatformRevenue(tx, { amountMinor: commission, currency, refType: "BOOKING", refId: booking.id, idempotencyKey: `platform_commission:${booking.id}` });
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.FULFILLED, commissionMinor: commission },
      });
      return;
    }

    const buyerWallet = await tx.wallet.findUnique({
      where: { userId_currency: { userId: booking.buyerId, currency } },
    });
    if (!buyerWallet || buyerWallet.escrowMinor < booking.totalMinor) {
      throw new HttpError(
        409,
        "ESCROW_BALANCE_MISMATCH",
        "The payer's escrow balance does not cover this booking; release was blocked",
      );
    }
    const newEscrow = buyerWallet.escrowMinor - booking.totalMinor;
    await tx.ledgerEntry.create({
      data: {
        walletId: buyerWallet.id,
        type: LedgerType.ESCROW_RELEASE,
        amountMinor: booking.totalMinor,
        balanceAfterMinor: buyerWallet.availableMinor,
        refType: "BOOKING",
        refId: booking.id,
        idempotencyKey,
      },
    });
    await tx.wallet.update({
      where: { id: buyerWallet.id },
      data: { escrowMinor: newEscrow },
    });

    let vendorWallet = await tx.wallet.findUnique({
      where: { userId_currency: { userId: vendorUserId, currency } },
    });
    if (!vendorWallet) {
      vendorWallet = await tx.wallet.create({
        data: { userId: vendorUserId, currency, availableMinor: 0n, escrowMinor: 0n },
      });
    }
    const vendorBal = vendorWallet.availableMinor + vendorNet;
    await tx.ledgerEntry.create({
      data: {
        walletId: vendorWallet.id,
        type: LedgerType.ESCROW_RELEASE,
        amountMinor: vendorNet,
        balanceAfterMinor: vendorBal,
        refType: "BOOKING",
        refId: booking.id,
        idempotencyKey: `vendor_release:${booking.id}`,
      },
    });
    await tx.wallet.update({
      where: { id: vendorWallet.id },
      data: { availableMinor: vendorBal },
    });

    // This is a distinct platform asset/liability ledger, not a second
    // vendor-wallet debit or a customer checkout surcharge.
    await recordPlatformRevenue(tx, { amountMinor: commission, currency, refType: "BOOKING", refId: booking.id, idempotencyKey: `platform_commission:${booking.id}` });

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.FULFILLED,
        commissionMinor: commission,
      },
    });
  });

  return {
    status: "FULFILLED" as const,
    bookingId: booking.id,
    vendorNetMinor: vendorNet.toString(),
    commissionMinor: commission.toString(),
    currency,
    alreadyReleased: false,
  };
}
