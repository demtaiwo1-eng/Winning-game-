import { Router } from "express";
import { LedgerType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
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

    const paymentIntentIds = entries
      .filter((entry) => entry.refType === "PAYMENT_INTENT" && entry.refId)
      .map((entry) => entry.refId as string);
    const paymentIntents = paymentIntentIds.length
      ? await prisma.paymentIntent.findMany({
          where: { id: { in: paymentIntentIds } },
          select: { id: true, provider: true },
        })
      : [];
    const providerByIntent = new Map(paymentIntents.map((intent) => [intent.id, intent.provider]));
    const payoutReferences = entries
      .filter((entry) => ["BANK_PAYOUT", "PAYOUT_REFUND", "PAYOUT_REVERSAL"].includes(entry.refType || "") && entry.refId)
      .map((entry) => entry.refId as string);
    const payouts = payoutReferences.length
      ? await prisma.payout.findMany({
          where: { OR: [{ reference: { in: payoutReferences } }, { id: { in: payoutReferences } }] },
          select: { id: true, reference: true, provider: true },
        })
      : [];
    const payoutProviderByReference = new Map(payouts.map((payout) => [payout.reference, payout.provider]));
    const payoutProviderById = new Map(payouts.map((payout) => [payout.id, payout.provider]));

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
        provider: e.refType === "PAYMENT_INTENT"
          ? (e.refId ? providerByIntent.get(e.refId) || "unknown" : "unknown")
          : ["BANK_PAYOUT", "PAYOUT_REFUND", "PAYOUT_REVERSAL"].includes(e.refType || "")
            ? (e.refId ? payoutProviderByReference.get(e.refId) || payoutProviderById.get(e.refId) || "unknown" : "unknown")
            : "internal",
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


/** Return the customer's bank-issued funding account, if a licensed partner has provisioned one. */
walletRouter.get("/funding-account", asyncHandler(async (req, res) => {
  const account = await prisma.customerFundingAccount.findUnique({ where: { userId: req.user!.id } });
  res.json({ account: account ? {
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    currency: account.currency,
    status: account.status,
    provider: account.provider,
  } : null, liveAccountAvailable: Boolean(account?.accountNumber && account.status === "ACTIVE") });
}));

/** Submit a bank transfer receipt for review. This endpoint never credits a wallet. */
walletRouter.post("/funding-submissions", asyncHandler(async (req, res) => {
  const amountRaw = String(req.body.amountMinor ?? "");
  const senderName = String(req.body.senderName ?? "").trim().slice(0, 120);
  const senderBank = String(req.body.senderBank ?? "").trim().slice(0, 100) || null;
  const transferReference = String(req.body.transferReference ?? "").trim().slice(0, 120);
  const receiptUrl = String(req.body.receiptUrl ?? "").trim();
  const idempotencyKey = String(req.get("Idempotency-Key") || req.body.idempotencyKey || "");
  if (!/^[1-9]\d{0,14}$/.test(amountRaw)) throw new HttpError(400, "INVALID_AMOUNT", "Enter a valid transfer amount in minor units.");
  if (!senderName || !transferReference || !/^https:\/\//i.test(receiptUrl)) throw new HttpError(400, "RECEIPT_DETAILS_REQUIRED", "Provide sender name, transfer reference and a secure HTTPS receipt link.");
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey)) throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Provide a valid Idempotency-Key.");
  const amountMinor = BigInt(amountRaw);
  const existing = await prisma.walletFundingSubmission.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.userId !== req.user!.id || existing.amountMinor !== amountMinor || existing.transferReference !== transferReference) throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "This request key was already used for another transfer.");
    return res.status(200).json({ submission: { id: existing.id, status: existing.status, createdAt: existing.createdAt }, replayed: true });
  }
  const submission = await prisma.walletFundingSubmission.create({ data: {
    userId: req.user!.id, amountMinor, currency: "NGN", senderName, senderBank,
    transferReference, receiptUrl, idempotencyKey,
  }});
  res.status(201).json({ submission: { id: submission.id, status: submission.status, amountMinor: submission.amountMinor.toString(), currency: submission.currency, createdAt: submission.createdAt }, message: "Receipt submitted. Your wallet will only be credited after an administrator verifies the matching bank transaction." });
}));

walletRouter.get("/funding-submissions", asyncHandler(async (req, res) => {
  const items = await prisma.walletFundingSubmission.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 50 });
  res.json({ items: items.map(item => ({ id: item.id, amountMinor: item.amountMinor.toString(), currency: item.currency, senderName: item.senderName, senderBank: item.senderBank, transferReference: item.transferReference, receiptUrl: item.receiptUrl, status: item.status, reviewNote: item.reviewNote, createdAt: item.createdAt, reviewedAt: item.reviewedAt })) });
}));

/** Admin queue. Verify the matching credit in the bank/provider portal before approval. */
walletRouter.get("/admin/funding-submissions", requireRole("ADMIN"), asyncHandler(async (_req, res) => {
  const items = await prisma.walletFundingSubmission.findMany({
    where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json({ items: items.map(item => ({ id: item.id, customer: item.user, amountMinor: item.amountMinor.toString(), currency: item.currency, senderName: item.senderName, senderBank: item.senderBank, transferReference: item.transferReference, receiptUrl: item.receiptUrl, createdAt: item.createdAt })) });
}));

/** Approve/reject a receipt. Approval atomically posts one append-only ledger credit. */
walletRouter.post("/admin/funding-submissions/:submissionId/review", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const action = String(req.body.action ?? "");
  const note = String(req.body.note ?? "").trim();
  if (!["APPROVE", "REJECT"].includes(action)) throw new HttpError(400, "INVALID_REVIEW_ACTION", "Choose APPROVE or REJECT.");
  if (note.length < 10 || note.length > 1000) throw new HttpError(400, "REVIEW_NOTE_REQUIRED", "Add an audit note of 10–1000 characters.");
  const result = await prisma.$transaction(async tx => {
    const submission = await tx.walletFundingSubmission.findUnique({ where: { id: req.params.submissionId } });
    if (!submission) throw new HttpError(404, "SUBMISSION_NOT_FOUND", "Funding submission not found.");
    if (submission.status !== "PENDING") throw new HttpError(409, "SUBMISSION_ALREADY_REVIEWED", "This funding submission has already been reviewed.");
    if (action === "REJECT") {
      const changed = await tx.walletFundingSubmission.updateMany({ where: { id: submission.id, status: "PENDING" }, data: { status: "REJECTED", reviewNote: note, reviewedById: req.user!.id, reviewedAt: new Date() } });
      if (changed.count !== 1) throw new HttpError(409, "REVIEW_CONFLICT", "This submission was reviewed by another administrator.");
      return { status: "REJECTED", balanceMinor: null };
    }
    const wallet = await tx.wallet.upsert({
      where: { userId_currency: { userId: submission.userId, currency: submission.currency } },
      create: { userId: submission.userId, currency: submission.currency, availableMinor: 0n, escrowMinor: 0n },
      update: {},
    });
    const idempotencyKey = "bank_receipt:" + submission.id;
    const previous = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
    if (previous) throw new HttpError(409, "ALREADY_CREDITED", "A ledger credit already exists for this receipt.");
    const newBalance = wallet.availableMinor + submission.amountMinor;
    const entry = await tx.ledgerEntry.create({ data: {
      walletId: wallet.id, type: LedgerType.DEPOSIT, amountMinor: submission.amountMinor,
      balanceAfterMinor: newBalance, refType: "BANK_TRANSFER_RECEIPT", refId: submission.id, idempotencyKey,
    }});
    await tx.wallet.update({ where: { id: wallet.id }, data: { availableMinor: newBalance } });
    const changed = await tx.walletFundingSubmission.updateMany({ where: { id: submission.id, status: "PENDING" }, data: { status: "APPROVED", reviewNote: note, reviewedById: req.user!.id, reviewedAt: new Date(), creditLedgerEntryId: entry.id } });
    if (changed.count !== 1) throw new HttpError(409, "REVIEW_CONFLICT", "This submission was reviewed by another administrator.");
    return { status: "APPROVED", balanceMinor: newBalance.toString() };
  }, { isolationLevel: "Serializable" });
  res.json({ submissionId: req.params.submissionId, ...result, message: result.status === "APPROVED" ? "Transfer approved and wallet credited." : "Transfer rejected. No wallet credit was made." });
}));
