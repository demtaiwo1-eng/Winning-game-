import { Router } from "express";
import { LedgerType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { randomUUID } from "crypto";
import { isCompatibleWalletReplay } from "./currencyPolicy";

export const walletRouter = Router();

walletRouter.use(requireAuth);

/** List wallets for the authenticated user (one per currency). */
walletRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const wallets = await prisma.wallet.findMany({
      where: { userId: req.user!.id },
      orderBy: { currency: "asc" },
    });
    res.json({
      items: wallets.map((w) => ({
        id: w.id,
        currency: w.currency,
        availableMinor: w.availableMinor.toString(),
        escrowMinor: w.escrowMinor.toString(),
        pendingMinor: "0", // derived from open holds if needed later
      })),
    });
  }),
);

/** Ledger history for a wallet (append-only). */
walletRouter.get(
  "/:walletId/ledger",
  asyncHandler(async (req, res) => {
    const wallet = await prisma.wallet.findFirst({
      where: { id: req.params.walletId, userId: req.user!.id },
    });
    if (!wallet) throw new HttpError(404, "NOT_FOUND", "Wallet not found");

    const entries = await prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        availableMinor: wallet.availableMinor.toString(),
        escrowMinor: wallet.escrowMinor.toString(),
      },
      items: entries.map((e) => ({
        id: e.id,
        type: e.type,
        amountMinor: e.amountMinor.toString(),
        balanceAfterMinor: e.balanceAfterMinor.toString(),
        refType: e.refType,
        refId: e.refId,
        idempotencyKey: e.idempotencyKey,
        createdAt: e.createdAt,
      })),
    });
  }),
);

/**
 * Simulated deposit (Phase 4 port: swap for Paystack/Flutterwave webhook).
 * Creates ledger DEPOSIT and increases available balance.
 */
walletRouter.post(
  "/deposit",
  (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        error: "Direct wallet deposits are disabled in production",
      });
    }
    next();
  },
  asyncHandler(async (req, res) => {
    const currency = String(req.body.currency || "NGN").trim().toUpperCase();
    const amountRaw = String(req.body.amountMinor ?? "");
    if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, "INVALID_CURRENCY", "currency must be a three-letter ISO code");
    if (!/^[1-9]\d*$/.test(amountRaw)) throw new HttpError(400, "INVALID_AMOUNT", "amountMinor must be a positive integer");
    const amountMinor = BigInt(amountRaw);
    const refId = typeof req.body.refId === "string" && req.body.refId.trim() ? req.body.refId.trim() : null;
    const suppliedKey = req.body.idempotencyKey;
    if (suppliedKey !== undefined && suppliedKey !== null && (typeof suppliedKey !== "string" || !/^[A-Za-z0-9._:-]{8,120}$/.test(suppliedKey))) {
      throw new HttpError(400, "INVALID_IDEMPOTENCY_KEY", "idempotencyKey must be 8–120 safe characters");
    }
    const idempotencyKey = typeof suppliedKey === "string"
      ? suppliedKey
      : `deposit:${req.user!.id}:${currency}:${randomUUID()}`;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
      if (existing) {
        const w = await tx.wallet.findUniqueOrThrow({ where: { id: existing.walletId } });
        if (!isCompatibleWalletReplay(w, existing, {
          userId: req.user!.id,
          currency,
          amountMinor,
          type: LedgerType.DEPOSIT,
          refType: "PAYMENT_INTENT",
          refId,
        })) {
          throw new HttpError(409, "IDEMPOTENCY_KEY_CONFLICT", "This idempotency key was already used for a different wallet, currency, amount, or reference");
        }
        return { wallet: w, entry: existing, replayed: true };
      }

      let wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency } },
      });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId: req.user!.id, currency, availableMinor: 0n, escrowMinor: 0n },
        });
      }

      const newAvailable = wallet.availableMinor + amountMinor;
      const entry = await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.DEPOSIT,
          amountMinor,
          balanceAfterMinor: newAvailable,
          refType: "PAYMENT_INTENT",
          refId,
          idempotencyKey,
        },
      });
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableMinor: newAvailable },
      });
      return { wallet: updated, entry, replayed: false };
    });

    res.status(result.replayed ? 200 : 201).json({
      wallet: {
        id: result.wallet.id,
        currency: result.wallet.currency,
        availableMinor: result.wallet.availableMinor.toString(),
        escrowMinor: result.wallet.escrowMinor.toString(),
      },
      entry: {
        id: result.entry.id,
        type: result.entry.type,
        amountMinor: result.entry.amountMinor.toString(),
        balanceAfterMinor: result.entry.balanceAfterMinor.toString(),
      },
      replayed: result.replayed,
    });
  }),
);

/**
 * Move available → escrow (booking hold). Idempotent.
 */
walletRouter.post(
  "/escrow-hold",
  asyncHandler(async (req, res) => {
    const currency = String(req.body.currency || "NGN").trim().toUpperCase();
    const amountRaw = String(req.body.amountMinor ?? "");
    const refId = typeof req.body.refId === "string" && req.body.refId.trim() ? req.body.refId.trim() : null;
    if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, "INVALID_CURRENCY", "currency must be a three-letter ISO code");
    if (!/^[1-9]\d*$/.test(amountRaw)) throw new HttpError(400, "INVALID_AMOUNT", "amountMinor must be a positive integer");
    const amountMinor = BigInt(amountRaw);
    const suppliedKey = req.body.idempotencyKey;
    if (suppliedKey !== undefined && suppliedKey !== null && (typeof suppliedKey !== "string" || !/^[A-Za-z0-9._:-]{8,120}$/.test(suppliedKey))) {
      throw new HttpError(400, "INVALID_IDEMPOTENCY_KEY", "idempotencyKey must be 8–120 safe characters");
    }
    const idempotencyKey = typeof suppliedKey === "string"
      ? suppliedKey
      : `escrow_hold:${req.user!.id}:${currency}:${refId || randomUUID()}`;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
      if (existing) {
        const w = await tx.wallet.findUniqueOrThrow({ where: { id: existing.walletId } });
        if (!isCompatibleWalletReplay(w, existing, {
          userId: req.user!.id,
          currency,
          amountMinor,
          type: LedgerType.ESCROW_HOLD,
          refType: "BOOKING",
          refId,
        })) {
          throw new HttpError(409, "IDEMPOTENCY_KEY_CONFLICT", "This idempotency key was already used for a different wallet, currency, amount, or reference");
        }
        return { wallet: w, entry: existing, replayed: true };
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency } },
      });
      if (!wallet || wallet.availableMinor < amountMinor) {
        throw new HttpError(400, "INSUFFICIENT_FUNDS", "Not enough available balance");
      }

      const newAvailable = wallet.availableMinor - amountMinor;
      const newEscrow = wallet.escrowMinor + amountMinor;
      const entry = await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: LedgerType.ESCROW_HOLD,
          amountMinor,
          balanceAfterMinor: newAvailable,
          refType: "BOOKING",
          refId,
          idempotencyKey,
        },
      });
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableMinor: newAvailable, escrowMinor: newEscrow },
      });
      return { wallet: updated, entry, replayed: false };
    });

    res.status(result.replayed ? 200 : 201).json({
      wallet: {
        id: result.wallet.id,
        currency: result.wallet.currency,
        availableMinor: result.wallet.availableMinor.toString(),
        escrowMinor: result.wallet.escrowMinor.toString(),
      },
      entry: {
        id: result.entry.id,
        type: result.entry.type,
        amountMinor: result.entry.amountMinor.toString(),
      },
      replayed: result.replayed,
    });
  }),
);
