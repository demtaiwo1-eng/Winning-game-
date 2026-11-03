import { Prisma } from "@prisma/client";
import { HttpError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { getOwnedEvent } from "./events.service";

const s = (n: bigint) => n.toString();

export function summarize(items: { category: string | null; plannedMinor: bigint; actualMinor: bigint }[]) {
  let planned = 0n;
  let actual = 0n;
  const cats = new Map<string, { planned: bigint; actual: bigint }>();
  for (const i of items) {
    planned += i.plannedMinor;
    actual += i.actualMinor;
    const key = i.category ?? "Uncategorised";
    const c = cats.get(key) ?? { planned: 0n, actual: 0n };
    c.planned += i.plannedMinor;
    c.actual += i.actualMinor;
    cats.set(key, c);
  }
  return {
    totals: { plannedMinor: s(planned), actualMinor: s(actual), varianceMinor: s(planned - actual) }, // + = under budget
    byCategory: [...cats.entries()].map(([category, c]) => ({
      category, plannedMinor: s(c.planned), actualMinor: s(c.actual), varianceMinor: s(c.planned - c.actual),
    })),
  };
}

export async function getBudget(ownerId: string, eventId: string) {
  const ev = await getOwnedEvent(ownerId, eventId);
  const [items, deposits, bookings] = await Promise.all([
    prisma.budgetItem.findMany({ where: { eventId }, orderBy: [{ category: "asc" }, { label: "asc" }] }),
    prisma.eventDeposit.findMany({ where: { eventId }, orderBy: { createdAt: "desc" } }),
    prisma.booking.findMany({ where: { eventId, status: { in: ["PENDING", "PAID", "CONFIRMED"] } }, select: { paidMinor: true } }),
  ]);
  const depositTotalMinor = deposits.reduce((total, deposit) => total + deposit.amountMinor, 0n);
  const bookingPaymentsHeldMinor = bookings.reduce((total, booking) => total + booking.paidMinor, 0n);
  return {
    currency: ev.currency,
    items: items.map((item) => ({ ...item, plannedMinor: s(item.plannedMinor), actualMinor: s(item.actualMinor) })),
    deposits: deposits.map((deposit) => ({ ...deposit, amountMinor: s(deposit.amountMinor) })),
    funding: {
      depositTotalMinor: s(depositTotalMinor),
      depositCount: deposits.length,
      bookingPaymentsHeldMinor: s(bookingPaymentsHeldMinor),
    },
    ...summarize(items),
  };
}

export async function createItem(ownerId: string, eventId: string, data: Prisma.BudgetItemUncheckedCreateInput) {
  await getOwnedEvent(ownerId, eventId);
  const item = await prisma.budgetItem.create({ data: { ...data, eventId } });
  return { ...item, plannedMinor: s(item.plannedMinor), actualMinor: s(item.actualMinor) };
}

async function ownedItem(ownerId: string, eventId: string, itemId: string) {
  await getOwnedEvent(ownerId, eventId);
  const i = await prisma.budgetItem.findFirst({ where: { id: itemId, eventId } });
  if (!i) throw new HttpError(404, "NOT_FOUND", "Budget item not found");
}

export async function updateItem(ownerId: string, eventId: string, itemId: string, data: Prisma.BudgetItemUncheckedUpdateInput) {
  await ownedItem(ownerId, eventId, itemId);
  const item = await prisma.budgetItem.update({ where: { id: itemId }, data });
  return { ...item, plannedMinor: s(item.plannedMinor), actualMinor: s(item.actualMinor) };
}

export async function deleteItem(ownerId: string, eventId: string, itemId: string) {
  await ownedItem(ownerId, eventId, itemId);
  await prisma.budgetItem.delete({ where: { id: itemId } });
}


function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : null;
}

/** Move a planner's available wallet balance into event-scoped escrow exactly once. */
export async function createEventDeposit(
  ownerId: string,
  eventId: string,
  amountMinor: bigint,
  idempotencyKey: string,
) {
  const event = await getOwnedEvent(ownerId, eventId);
  if (amountMinor <= 0n) throw new HttpError(400, "INVALID_AMOUNT", "Deposit amount must be positive");
  const key = `event-deposit:${ownerId}:${idempotencyKey}`;

  const existingResult = async () => {
    const existing = await prisma.eventDeposit.findUnique({ where: { idempotencyKey: key } });
    if (!existing) return null;
    if (existing.eventId !== eventId || existing.payerId !== ownerId || existing.amountMinor !== amountMinor) {
      throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "This deposit key was already used for a different payment");
    }
    return { deposit: existing, alreadyProcessed: true as const };
  };

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.eventDeposit.findUnique({ where: { idempotencyKey: key } });
      if (existing) {
        if (existing.eventId !== eventId || existing.payerId !== ownerId || existing.amountMinor !== amountMinor) {
          throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "This deposit key was already used for a different payment");
        }
        return { deposit: existing, alreadyProcessed: true };
      }
      const wallet = await tx.wallet.findUnique({
        where: { userId_currency: { userId: ownerId, currency: event.currency } },
      });
      if (!wallet) throw new HttpError(400, "WALLET_NOT_FOUND", "Fund your event currency wallet before making a deposit");
      const debit = await tx.wallet.updateMany({
        where: { id: wallet.id, availableMinor: { gte: amountMinor } },
        data: { availableMinor: { decrement: amountMinor }, escrowMinor: { increment: amountMinor } },
      });
      if (debit.count !== 1) throw new HttpError(400, "INSUFFICIENT_FUNDS", "Your available wallet balance is too low");
      const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const deposit = await tx.eventDeposit.create({
        data: { eventId, payerId: ownerId, amountMinor, currency: event.currency, idempotencyKey: key },
      });
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: "ESCROW_HOLD",
          amountMinor,
          balanceAfterMinor: updatedWallet.availableMinor,
          refType: "EVENT_DEPOSIT",
          refId: deposit.id,
          idempotencyKey: key,
        },
      });
      return { deposit, alreadyProcessed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const code = prismaErrorCode(error);
    if (code === "P2002" || code === "P2034") {
      const replay = await existingResult();
      if (replay) return replay;
      if (code === "P2034") {
        throw new HttpError(409, "DEPOSIT_CONFLICT", "Your wallet changed during this deposit. Refresh the balance and try again with the same request.");
      }
    }
    throw error;
  }
}
