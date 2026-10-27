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
  const items = await prisma.budgetItem.findMany({ where: { eventId }, orderBy: [{ category: "asc" }, { label: "asc" }] });
  return { currency: ev.currency, items, ...summarize(items) };
}

export async function createItem(ownerId: string, eventId: string, data: Prisma.BudgetItemUncheckedCreateInput) {
  await getOwnedEvent(ownerId, eventId);
  return prisma.budgetItem.create({ data: { ...data, eventId } });
}

async function ownedItem(ownerId: string, eventId: string, itemId: string) {
  await getOwnedEvent(ownerId, eventId);
  const i = await prisma.budgetItem.findFirst({ where: { id: itemId, eventId } });
  if (!i) throw new HttpError(404, "NOT_FOUND", "Budget item not found");
}

export async function updateItem(ownerId: string, eventId: string, itemId: string, data: Prisma.BudgetItemUncheckedUpdateInput) {
  await ownedItem(ownerId, eventId, itemId);
  return prisma.budgetItem.update({ where: { id: itemId }, data });
}

export async function deleteItem(ownerId: string, eventId: string, itemId: string) {
  await ownedItem(ownerId, eventId, itemId);
  await prisma.budgetItem.delete({ where: { id: itemId } });
}
