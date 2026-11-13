import { Router } from "express";
import { LedgerType, PayoutStatus, type Payout } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { payoutFeeMinor } from "./feePolicy";
import { getRuntimePaymentMode, lockCurrentPaymentMode } from "./runtimePaymentMode";
import { recordPlatformRevenue } from "./platformRevenue.service";
import { assertOpayTransfersEnabled, maskAccount, normalizeOpayTransferStatus, opayCreateBankTransfer, opayGetBankTransferStatus, opayListBanks, opayResolveBankAccount } from "./opay-payouts.provider";

export const payoutsRouter = Router();

function publicPayout(p: {
  id: string; reference: string; provider: string; amountMinor: bigint; feeMinor: bigint;
  netAmountMinor: bigint; currency: string; bankName: string | null;
  accountName: string; maskedAccountNumber: string; status: PayoutStatus;
  failureReason: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: p.id, reference: p.reference, provider: p.provider,
    amountMinor: p.amountMinor.toString(),
    feeMinor: p.feeMinor.toString(), netAmountMinor: p.netAmountMinor.toString(),
    currency: p.currency, bankName: p.bankName, accountName: p.accountName,
    accountNumber: p.maskedAccountNumber, status: p.status,
    failureReason: p.failureReason, createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

export async function completePayout(reference: string, status: "success" | "failed" | "reversed", providerTransferCode?: string, providerTransferId?: string) {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payout.findUnique({ where: { reference } });
    if (!payout) return false;

    if (status === "success") {
      const claim = await tx.payout.updateMany({
        where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
        data: { status: PayoutStatus.SUCCEEDED, providerTransferCode, providerTransferId, failureReason: null },
      });
      if (claim.count !== 1) return true;
      await recordPlatformRevenue(tx, {
        amountMinor: payout.feeMinor, currency: payout.currency,
        refType: "BANK_PAYOUT", refId: payout.id,
        idempotencyKey: `platform_payout_fee:${payout.id}`,
      });
      return true;
    }

    if (status === "failed") {
      const claim = await tx.payout.updateMany({
        where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
        data: { status: PayoutStatus.FAILED, failureReason: "The transfer provider reported a failed payout.", providerTransferCode, providerTransferId },
      });
      if (claim.count !== 1) return true;
      const wallet = await tx.wallet.update({
        where: { id: payout.walletId },
        data: { availableMinor: { increment: payout.amountMinor } },
      });
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id, type: LedgerType.ADJUSTMENT,
          amountMinor: payout.amountMinor, balanceAfterMinor: wallet.availableMinor,
          refType: "PAYOUT_REFUND", refId: payout.id,
          idempotencyKey: `payout_refund:${payout.id}`,
        },
      });
      return true;
    }

    // Claim a reversal once. It can follow a successful transfer or arrive
    // before a later OPay status enquiry confirms settlement.
    const claim = await tx.payout.updateMany({
      where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING, PayoutStatus.SUCCEEDED] } },
      data: { status: PayoutStatus.REVERSED, failureReason: "The bank transfer was reversed by the provider.", providerTransferCode, providerTransferId },
    });
    if (claim.count !== 1) return true;
    const wallet = await tx.wallet.update({
      where: { id: payout.walletId },
      data: { availableMinor: { increment: payout.amountMinor } },
    });
    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id, type: LedgerType.ADJUSTMENT,
        amountMinor: payout.amountMinor, balanceAfterMinor: wallet.availableMinor,
        refType: "PAYOUT_REVERSAL", refId: payout.id,
        idempotencyKey: `payout_reversal_refund:${payout.id}`,
      },
    });
    const feeEntry = await tx.platformRevenueEntry.findUnique({
      where: { idempotencyKey: `platform_payout_fee:${payout.id}` },
    });
    if (feeEntry) {
      const account = await tx.platformRevenueAccount.update({
        where: { id: feeEntry.accountId },
        data: { balanceMinor: { decrement: feeEntry.amountMinor } },
      });
      await tx.platformRevenueEntry.create({
        data: {
          accountId: feeEntry.accountId, amountMinor: -feeEntry.amountMinor,
          balanceAfterMinor: account.balanceMinor, refType: "BANK_PAYOUT_REVERSAL",
          refId: payout.id, idempotencyKey: `platform_payout_fee_reversal:${payout.id}`,
        },
      });
    }
    return true;
  });
}

payoutsRouter.get(
  "/payouts/banks",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const items = await opayListBanks();
    res.json({ items });
  }),
);

payoutsRouter.get(
  "/payouts/resolve-account",
  requireAuth,
  asyncHandler(async (req, res) => {
    const accountNumber = String(req.query.accountNumber || "");
    const bankCode = String(req.query.bankCode || "");
    if (!/^\d{10}$/.test(accountNumber) || !/^\d{2,8}$/.test(bankCode)) {
      throw new HttpError(400, "INVALID_BANK_DETAILS", "Provide a valid 10-digit account number and bank code.");
    }
    const result = await opayResolveBankAccount(accountNumber, bankCode);
    res.json(result);
  }),
);

payoutsRouter.post(
  "/payouts",
  requireAuth,
  requireRole("VENDOR", "AFFILIATE", "ADMIN"),
  asyncHandler(async (req, res) => {
    if (getRuntimePaymentMode() === "demo") throw new HttpError(409, "PAYOUTS_DISABLED_IN_DEMO", "External bank withdrawals are disabled in DEMO mode.");
    assertOpayTransfersEnabled();
    const amountRaw = String(req.body.amountMinor ?? "");
    const accountNumber = String(req.body.accountNumber ?? "");
    const bankCode = String(req.body.bankCode ?? "");
    const confirmed = req.body.confirmAccountName === true;
    const idempotencyKey = String(req.get("Idempotency-Key") || req.body.idempotencyKey || "");
    if (!/^[1-9]\d{0,14}$/.test(amountRaw)) throw new HttpError(400, "INVALID_AMOUNT", "amountMinor must be a positive whole number.");
    if (!/^\d{10}$/.test(accountNumber) || !/^\d{2,8}$/.test(bankCode)) throw new HttpError(400, "INVALID_BANK_DETAILS", "Provide a valid Nigerian bank account and bank code.");
    if (!confirmed) throw new HttpError(400, "ACCOUNT_CONFIRMATION_REQUIRED", "Verify and confirm the destination account name before withdrawing.");
    if (!/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey)) throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Supply an Idempotency-Key header with 8–120 safe characters.");

    const previous = await prisma.payout.findUnique({ where: { idempotencyKey } });
    if (previous) {
      if (previous.userId !== req.user!.id || previous.amountMinor !== BigInt(amountRaw) || previous.bankCode !== bankCode || previous.maskedAccountNumber !== maskAccount(accountNumber)) {
        throw new HttpError(409, "IDEMPOTENCY_KEY_CONFLICT", "This idempotency key was already used for a different payout.");
      }
      return res.status(200).json({ payout: publicPayout(previous), replayed: true });
    }

    const amountMinor = BigInt(amountRaw);
    const feeMinor = payoutFeeMinor(amountMinor, env);
    const netAmountMinor = amountMinor - feeMinor;
    if (netAmountMinor <= 0n) throw new HttpError(400, "PAYOUT_TOO_SMALL", "The withdrawal amount must be greater than its 2% fee.");
    const wallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: req.user!.id, currency: "NGN" } },
    });
    if (!wallet) throw new HttpError(404, "WALLET_NOT_FOUND", "Your NGN wallet was not found.");

    const reference = `ephinta_payout_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    // Create a processing marker before OPay account lookup. This prevents a
    // central mode switch while a payout request is in flight.
    let payout: Payout;
    try {
      payout = await prisma.$transaction(async (tx) => {
        await lockCurrentPaymentMode(tx);
        return tx.payout.create({
          data: {
            userId: req.user!.id, walletId: wallet.id, provider: "opay", reference, idempotencyKey,
            amountMinor, feeMinor, netAmountMinor, currency: "NGN",
            bankCode, bankName: null, accountName: "Pending verification",
            maskedAccountNumber: maskAccount(accountNumber), status: PayoutStatus.PROCESSING,
          },
        });
      });
    } catch (error) {
      const replay = await prisma.payout.findUnique({ where: { idempotencyKey } });
      if (replay) {
        if (replay.userId !== req.user!.id || replay.amountMinor !== amountMinor || replay.bankCode !== bankCode || replay.maskedAccountNumber !== maskAccount(accountNumber)) {
          throw new HttpError(409, "IDEMPOTENCY_KEY_CONFLICT", "This idempotency key was already used for a different payout.");
        }
        return res.status(200).json({ payout: publicPayout(replay), replayed: true });
      }
      throw error;
    }

    let accountName: string;
    let bankName: string | null;
    try {
      const resolved = await opayResolveBankAccount(accountNumber, bankCode);
      accountName = resolved.accountName;
      const bankList = await opayListBanks();
      bankName = bankList.find((bank) => bank.code === bankCode)?.name || null;
    } catch (error) {
      await prisma.payout.deleteMany({ where: { id: payout.id, status: PayoutStatus.PROCESSING } });
      throw error;
    }

    try {
      payout = await prisma.$transaction(async (tx) => {
        const debit = await tx.wallet.updateMany({
          where: { id: wallet.id, availableMinor: { gte: amountMinor } },
          data: { availableMinor: { decrement: amountMinor } },
        });
        if (debit.count !== 1) throw new HttpError(400, "INSUFFICIENT_FUNDS", "Your available wallet balance is not enough to cover the withdrawal and fee.");
        const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id, type: LedgerType.WITHDRAWAL,
            amountMinor, balanceAfterMinor: updatedWallet.availableMinor,
            refType: "BANK_PAYOUT", refId: reference,
            idempotencyKey: `payout_debit:${reference}`,
          },
        });
        return tx.payout.update({
          where: { id: payout.id },
          data: { accountName, bankName, status: PayoutStatus.PENDING },
        });
      });
    } catch (error) {
      await prisma.payout.deleteMany({ where: { id: payout.id, status: PayoutStatus.PROCESSING } });
      const replay = await prisma.payout.findUnique({ where: { idempotencyKey } });
      if (replay) return res.status(200).json({ payout: publicPayout(replay), replayed: true });
      throw error;
    }

    try {
      const transfer = await opayCreateBankTransfer({
        reference, amountMinor: netAmountMinor, accountNumber, bankCode, accountName,
        reason: "EPHINTA vendor wallet withdrawal",
      });
      const status = normalizeOpayTransferStatus(transfer.status);
      if (status === "success") await completePayout(reference, "success", undefined, String(transfer.orderNo));
      else if (status === "failed") await completePayout(reference, "failed", undefined, String(transfer.orderNo));
      else if (status === "reversed") await completePayout(reference, "reversed", undefined, String(transfer.orderNo));
      else await prisma.payout.updateMany({
        where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
        data: { status: PayoutStatus.PROCESSING, providerTransferId: String(transfer.orderNo) },
      });
    } catch (error) {
      if (error instanceof HttpError && error.code === "OPAY_PAYOUT_PROVIDER_REJECTED") {
        await completePayout(reference, "failed");
      } else {
        await prisma.payout.updateMany({
          where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
          data: { status: PayoutStatus.PROCESSING, failureReason: "OPay response pending status reconciliation." },
        });
      }
    }

    const finalPayout = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
    res.status(202).json({
      payout: publicPayout(finalPayout), replayed: false,
      feePolicy: { rateBps: env.PAYOUT_FEE_BPS ?? env.COMMISSION_BPS, chargedOn: "gross wallet debit" },
      message: "Withdrawal submitted to OPay. Funds remain reserved until OPay confirms the final bank-transfer status.",
    });
  }),
);

payoutsRouter.get(
  "/payouts",
  requireAuth,
  requireRole("VENDOR", "AFFILIATE", "ADMIN"),
  asyncHandler(async (req, res) => {
    const items = await prisma.payout.findMany({
      where: req.user!.role === "ADMIN" ? {} : { userId: req.user!.id },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    res.json({ items: items.map(publicPayout) });
  }),
);

payoutsRouter.get(
  "/payouts/:id",
  requireAuth,
  requireRole("VENDOR", "AFFILIATE", "ADMIN"),
  asyncHandler(async (req, res) => {
    const payout = await prisma.payout.findFirst({
      where: req.user!.role === "ADMIN" ? { id: req.params.id } : { id: req.params.id, userId: req.user!.id },
    });
    if (!payout) throw new HttpError(404, "PAYOUT_NOT_FOUND", "Payout not found.");
    let current = payout;
    if (payout.status === PayoutStatus.PENDING || payout.status === PayoutStatus.PROCESSING) {
      try {
        const transfer = await opayGetBankTransferStatus(payout.reference, payout.providerTransferId || undefined);
        if (transfer.orderNo && transfer.orderNo !== payout.providerTransferId) {
          await prisma.payout.updateMany({
            where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
            data: { status: PayoutStatus.PROCESSING, providerTransferId: transfer.orderNo },
          });
        }
        if (transfer.amount !== undefined && BigInt(String(transfer.amount)) !== payout.netAmountMinor) {
          throw new HttpError(502, "OPAY_PAYOUT_AMOUNT_MISMATCH", "OPay's transfer amount does not match this withdrawal.");
        }
        if (transfer.currency && transfer.currency.toUpperCase() !== payout.currency) {
          throw new HttpError(502, "OPAY_PAYOUT_CURRENCY_MISMATCH", "OPay's transfer currency does not match this withdrawal.");
        }
        const status = normalizeOpayTransferStatus(transfer.status);
        if (status === "success" || status === "failed" || status === "reversed") {
          await completePayout(payout.reference, status, undefined, payout.providerTransferId ?? undefined);
        }
        current = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
      } catch {
        // OPay merchant transfers are reconciled through provider status enquiries.
      }
    }
    res.json({ payout: publicPayout(current) });
  }),
);


export async function reconcilePendingPayouts(batchSize = 5) {
  if (env.OPAY_TRANSFERS_ENABLED !== "true") {
    return { checked: 0, succeeded: 0, failed: 0, reversed: 0, errors: 0, skipped: "OPAY_TRANSFERS_DISABLED" };
  }
  const cutoff = new Date(Date.now() - 30_000);
  const candidates = await prisma.payout.findMany({
    where: {
      status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] },
      updatedAt: { lte: cutoff },
    },
    orderBy: { updatedAt: "asc" },
    take: Math.min(Math.max(batchSize, 1), 20),
  });
  const totals = { checked: 0, succeeded: 0, failed: 0, reversed: 0, errors: 0 };
  for (const payout of candidates) {
    totals.checked += 1;
    try {
      const transfer = await opayGetBankTransferStatus(payout.reference, payout.providerTransferId ?? undefined);
      if (transfer.amount !== undefined && BigInt(String(transfer.amount)) !== payout.netAmountMinor) {
        throw new HttpError(502, "OPAY_PAYOUT_AMOUNT_MISMATCH", "OPay transfer amount did not match the reserved payout.");
      }
      if (transfer.currency && transfer.currency.toUpperCase() !== payout.currency) {
        throw new HttpError(502, "OPAY_PAYOUT_CURRENCY_MISMATCH", "OPay transfer currency did not match the reserved payout.");
      }
      if (transfer.orderNo && transfer.orderNo !== payout.providerTransferId) {
        await prisma.payout.updateMany({
          where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
          data: { status: PayoutStatus.PROCESSING, providerTransferId: transfer.orderNo },
        });
      }
      const status = normalizeOpayTransferStatus(transfer.status);
      if (status === "success" || status === "failed" || status === "reversed") {
        await completePayout(payout.reference, status, undefined, transfer.orderNo || payout.providerTransferId || undefined);
        if (status === "success") totals.succeeded += 1;
        else if (status === "failed") totals.failed += 1;
        else totals.reversed += 1;
      } else {
        await prisma.payout.updateMany({
          where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
          data: { status: PayoutStatus.PROCESSING, updatedAt: new Date() },
        });
      }
    } catch {
      totals.errors += 1;
      // Back off this item until the next reconciliation interval; never refund on an ambiguous enquiry failure.
      await prisma.payout.updateMany({
        where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
        data: { updatedAt: new Date() },
      }).catch(() => undefined);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return totals;
}
