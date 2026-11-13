import { Router } from "express";
import { LedgerType, PayoutStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { payoutFeeMinor } from "./feePolicy";
import { recordPlatformRevenue } from "./platformRevenue.service";

export const payoutsRouter = Router();

import { maskAccount, normalizeOpayTransferStatus, opayCreateBankTransfer, opayGetBankTransferStatus, opayListBanks, opayResolveBankAccount } from "./opay-payouts.provider";

function publicPayout(p: {
  id: string; reference: string; amountMinor: bigint; feeMinor: bigint;
  netAmountMinor: bigint; currency: string; bankName: string | null;
  accountName: string; maskedAccountNumber: string; status: PayoutStatus;
  failureReason: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: p.id, reference: p.reference, amountMinor: p.amountMinor.toString(),
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
    // before the success webhook if Paystack's events are delivered out of order.
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

    const resolved = await opayResolveBankAccount(accountNumber, bankCode);
    const accountName = resolved.accountName;
    const bankList = await opayListBanks();
    const bankName = bankList.find((bank) => bank.code === bankCode)?.name || null;

    const reference = `ephinta_payout_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    let payout;
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
        return tx.payout.create({
          data: {
            userId: req.user!.id, walletId: wallet.id, reference, idempotencyKey,
            amountMinor, feeMinor, netAmountMinor, currency: "NGN",
            bankCode, bankName, accountName, maskedAccountNumber: maskAccount(accountNumber),
            status: PayoutStatus.PENDING,
          },
        });
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      const replay = await prisma.payout.findUnique({ where: { idempotencyKey } });
      if (replay) return res.status(200).json({ payout: publicPayout(replay), replayed: true });
      throw error;
    }

    // The provider is funded from the merchant's Paystack balance. The
    // customer wallet debit remains reserved until a signed final status arrives.
    try {
      const transfer = await paystack<TransferData>("/transfer", {
        method: "POST",
        body: JSON.stringify({
          source: "balance", amount: Number(netAmountMinor), recipient: recipient.data.recipient_code,
          reference, currency: "NGN", reason: "EPHINTA vendor wallet withdrawal",
        }),
      });
      const data = transfer.data || {};
      if (data.reference !== reference || data.currency?.toUpperCase() !== "NGN" ||
          data.amount === undefined || BigInt(String(data.amount)) !== netAmountMinor) {
        throw new Error("Paystack transfer amount, currency, or reference did not match the submitted payout.");
      }
      if (data.status === "success") {
        await completePayout(reference, "success", data.transfer_code, data.id === undefined ? undefined : String(data.id));
      } else if (data.status === "failed") {
        await completePayout(reference, "failed", data.transfer_code, data.id === undefined ? undefined : String(data.id));
      } else {
        await prisma.payout.updateMany({
          where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
          data: {
            status: PayoutStatus.PROCESSING,
            providerTransferCode: data.transfer_code,
            providerTransferId: data.id === undefined ? undefined : String(data.id),
          },
        });
      }
    } catch (error) {
      if (error instanceof HttpError && error.code === "PAYOUT_PROVIDER_ERROR") {
        // A definite provider rejection means no transfer was queued.
        await completePayout(reference, "failed");
      } else {
        // Do not refund on network/ambiguous errors: Paystack may have accepted
        // the transfer. Keep the amount reserved and reconcile by reference.
        await prisma.payout.updateMany({
          where: { id: payout.id, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
          data: { status: PayoutStatus.PROCESSING, failureReason: "Provider response pending reconciliation." },
        });
      }
    }

    const finalPayout = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
    res.status(202).json({
      payout: publicPayout(finalPayout), replayed: false,
      feePolicy: { rateBps: env.PAYOUT_FEE_BPS ?? env.COMMISSION_BPS, chargedOn: "gross wallet debit" },
      message: "Withdrawal submitted. Funds remain reserved until Paystack confirms the final bank-transfer status.",
    });
  }),
);

payoutsRouter.post(
  "/payouts/:id/finalize",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
const otp = String(req.body.otp || "");
    if (!/^\d{4,8}$/.test(otp)) throw new HttpError(400, "INVALID_OTP", "Enter the 4–8 digit Paystack transfer OTP.");
    const payout = await prisma.payout.findFirst({ where: { id: req.params.id } });
    if (!payout || payout.userId !== req.user!.id && req.user!.role !== "ADMIN") throw new HttpError(404, "PAYOUT_NOT_FOUND", "Payout not found.");
    if (!payout.providerTransferCode) throw new HttpError(409, "TRANSFER_NOT_READY", "The transfer is not awaiting OTP approval.");
    const result = await paystack<TransferData>("/transfer/finalize_transfer", {
      method: "POST", body: JSON.stringify({ transfer_code: payout.providerTransferCode, otp }),
    });
    const data = result.data || {};
    const transferMatches = data.reference === payout.reference &&
      data.currency?.toUpperCase() === payout.currency &&
      data.amount !== undefined && BigInt(String(data.amount)) === payout.netAmountMinor;
    if (!transferMatches) throw new HttpError(502, "PAYOUT_TRANSFER_MISMATCH", "Paystack's finalized transfer details do not match this payout.");
    if (data.status === "success") await completePayout(payout.reference, "success", data.transfer_code, data.id === undefined ? undefined : String(data.id));
    else if (data.status === "failed") await completePayout(payout.reference, "failed", data.transfer_code, data.id === undefined ? undefined : String(data.id));
    const updated = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
    res.json({ payout: publicPayout(updated) });
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
        const verified = await paystack<TransferData>(`/transfer/verify/${encodeURIComponent(payout.reference)}`);
        const transfer = verified.data || {};
        const verifiedMatches = transfer.reference === payout.reference &&
          transfer.currency?.toUpperCase() === payout.currency &&
          transfer.amount !== undefined && BigInt(String(transfer.amount)) === payout.netAmountMinor;
        if (verifiedMatches && transfer.status === "success") {
          await completePayout(payout.reference, "success", transfer.transfer_code, transfer.id === undefined ? undefined : String(transfer.id));
        } else if (verifiedMatches && (transfer.status === "failed" || transfer.status === "reversed")) {
          await completePayout(payout.reference, transfer.status, transfer.transfer_code, transfer.id === undefined ? undefined : String(transfer.id));
        } else if (verifiedMatches && transfer.transfer_code && transfer.transfer_code !== payout.providerTransferCode) {
          await prisma.payout.update({
            where: { id: payout.id },
            data: { status: PayoutStatus.PROCESSING, providerTransferCode: transfer.transfer_code, providerTransferId: transfer.id === undefined ? undefined : String(transfer.id) },
          });
        }
        current = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
      } catch {
        // Status polling is best-effort; the signed webhook remains authoritative.
      }
    }
    res.json({ payout: publicPayout(current) });
  }),
);
