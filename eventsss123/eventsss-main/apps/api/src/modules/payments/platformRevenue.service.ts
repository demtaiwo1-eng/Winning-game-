import type { Prisma } from "@prisma/client";

/**
 * Append revenue to the platform-owned, currency-scoped ledger.
 * The balance increment and journal row must run in the caller's transaction.
 */
export async function recordPlatformRevenue(
  tx: Prisma.TransactionClient,
  input: {
    amountMinor: bigint;
    currency: string;
    idempotencyKey: string;
    refType: string;
    refId: string;
  },
) {
  if (input.amountMinor <= 0n) return;
  const existing = await tx.platformRevenueEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return;

  const account = await tx.platformRevenueAccount.upsert({
    where: { currency: input.currency },
    create: { currency: input.currency, balanceMinor: 0n },
    update: {},
  });
  const updatedAccount = await tx.platformRevenueAccount.update({
    where: { id: account.id },
    data: { balanceMinor: { increment: input.amountMinor } },
  });
  await tx.platformRevenueEntry.create({
    data: {
      accountId: account.id,
      amountMinor: input.amountMinor,
      balanceAfterMinor: updatedAccount.balanceMinor,
      refType: input.refType,
      refId: input.refId,
      idempotencyKey: input.idempotencyKey,
    },
  });
}
