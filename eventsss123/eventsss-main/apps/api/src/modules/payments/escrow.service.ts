import { BookingStatus, LedgerType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/errors";
import { env } from "../../config/env";
import { assertEscrowReleaseAllowed } from "./escrowPolicy";

/**
 * Release booking escrow to vendor (minus commission).
 * Idempotent via ledger keys release:{bookingId} / vendor_release:{bookingId}.
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
  if (booking.status === BookingStatus.FULFILLED) {
    return {
      status: "FULFILLED" as const,
      bookingId: booking.id,
      vendorNetMinor: (booking.totalMinor - booking.commissionMinor).toString(),
      commissionMinor: booking.commissionMinor.toString(),
      currency: booking.currency,
      alreadyReleased: true,
    };
  }

  const vendorUserId = booking.vendor.userId;
  const bps = env.COMMISSION_BPS;
  // Prefer stored commission; recompute if zero
  let commission = booking.commissionMinor;
  if (commission === 0n && bps > 0) {
    commission = (booking.totalMinor * BigInt(bps) + 5000n) / 10000n;
  }
  const vendorNet = booking.totalMinor - commission;
  const currency = booking.currency;
  const idempotencyKey = `release:${booking.id}`;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
    if (existing) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.FULFILLED },
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
    if (commission > 0n) {
      await tx.ledgerEntry.create({
        data: {
          walletId: vendorWallet.id,
          type: LedgerType.COMMISSION,
          amountMinor: commission,
          balanceAfterMinor: vendorBal,
          refType: "BOOKING",
          refId: booking.id,
          idempotencyKey: `commission:${booking.id}`,
        },
      });
    }
    await tx.wallet.update({
      where: { id: vendorWallet.id },
      data: { availableMinor: vendorBal },
    });
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
