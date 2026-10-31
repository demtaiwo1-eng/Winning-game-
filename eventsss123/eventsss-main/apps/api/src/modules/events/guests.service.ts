import { GuestCheckInMethod, Prisma } from "@prisma/client";
import { HttpError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { getOwnedEvent, MAX_GUESTS_PER_EVENT } from "./events.service";

type GuestIn = { name: string; email?: string | null; phone?: string | null; plusOnes?: number };

async function assertCapacity(eventId: string, adding: number) {
  const n = await prisma.guest.count({ where: { eventId } });
  if (n + adding > MAX_GUESTS_PER_EVENT) throw new HttpError(422, "GUEST_LIMIT", `Max ${MAX_GUESTS_PER_EVENT} guests per event`);
}

export async function addGuest(ownerId: string, eventId: string, input: GuestIn) {
  await getOwnedEvent(ownerId, eventId);
  await assertCapacity(eventId, 1);
  return prisma.guest.create({ data: { ...input, eventId } });
}

export async function addGuestsBulk(ownerId: string, eventId: string, guests: GuestIn[]) {
  await getOwnedEvent(ownerId, eventId);
  await assertCapacity(eventId, guests.length);
  return prisma.guest.createManyAndReturn({ data: guests.map((g) => ({ ...g, eventId })) });
}

export async function listGuests(
  ownerId: string, eventId: string, q: { rsvp?: string; q?: string; page: number; limit: number },
) {
  await getOwnedEvent(ownerId, eventId);
  const where: Prisma.GuestWhereInput = {
    eventId,
    ...(q.rsvp ? { rsvp: q.rsvp as Prisma.GuestWhereInput["rsvp"] } : {}),
    ...(q.q ? { name: { contains: q.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.guest.findMany({ where, orderBy: { name: "asc" }, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.guest.count({ where }),
  ]);
  return { items, page: q.page, limit: q.limit, total };
}

async function ownedGuest(ownerId: string, eventId: string, guestId: string) {
  await getOwnedEvent(ownerId, eventId);
  const g = await prisma.guest.findFirst({ where: { id: guestId, eventId } });
  if (!g) throw new HttpError(404, "NOT_FOUND", "Guest not found");
  return g;
}

export async function updateGuest(ownerId: string, eventId: string, guestId: string, data: Prisma.GuestUncheckedUpdateInput) {
  await ownedGuest(ownerId, eventId, guestId);
  return prisma.guest.update({ where: { id: guestId }, data });
}

export async function deleteGuest(ownerId: string, eventId: string, guestId: string) {
  await ownedGuest(ownerId, eventId, guestId);
  await prisma.guest.delete({ where: { id: guestId } });
}

/**
 * Check-in is idempotent: retries from an offline outbox or two gate devices
 * cannot overwrite the first accepted check-in timestamp/method.
 */
export async function checkInGuest(
  ownerId: string,
  eventId: string,
  input: { guestId?: string; token?: string; method: GuestCheckInMethod },
) {
  await getOwnedEvent(ownerId, eventId);
  const guest = await prisma.guest.findFirst({
    where: { eventId, ...(input.guestId ? { id: input.guestId } : { token: input.token }) },
  });
  if (!guest) throw new HttpError(404, "NOT_FOUND", "Guest not found for this event");
  if (guest.checkedInAt) return { guest, alreadyCheckedIn: true };

  return prisma.$transaction(async (tx) => {
    const checkedInAt = new Date();
    const result = await tx.guest.updateMany({
      where: { id: guest.id, checkedInAt: null },
      data: { checkedInAt, checkInMethod: input.method },
    });
    if (result.count === 1) {
      await tx.eventGuestCheckIn.create({
        data: { eventId, guestId: guest.id, checkedInById: ownerId, method: input.method, checkedInAt },
      });
    }
    const updated = await tx.guest.findUniqueOrThrow({ where: { id: guest.id } });
    return { guest: updated, alreadyCheckedIn: result.count === 0 };
  });
}

export async function listGuestCheckIns(ownerId: string, eventId: string) {
  await getOwnedEvent(ownerId, eventId);
  return prisma.eventGuestCheckIn.findMany({
    where: { eventId },
    orderBy: { checkedInAt: "desc" },
    take: 500,
    select: {
      id: true,
      method: true,
      checkedInAt: true,
      guest: { select: { id: true, name: true } },
    },
  });
}

// ---- public RSVP (guest holds a secret token)
const eventPublicSelect = { title: true, type: true, startsAt: true, endsAt: true, city: true, country: true, status: true } as const;

export async function rsvpView(token: string) {
  const g = await prisma.guest.findUnique({
    where: { token },
    select: { name: true, rsvp: true, plusOnes: true, respondedAt: true, event: { select: eventPublicSelect } },
  });
  if (!g) throw new HttpError(404, "NOT_FOUND", "Invitation not found");
  return g;
}

export async function rsvpRespond(token: string, input: { rsvp: "ACCEPTED" | "DECLINED" | "MAYBE"; plusOnes?: number }) {
  const g = await prisma.guest.findUnique({ where: { token }, include: { event: { select: { status: true } } } });
  if (!g) throw new HttpError(404, "NOT_FOUND", "Invitation not found");
  if (g.event.status === "CANCELLED" || g.event.status === "COMPLETED") {
    throw new HttpError(409, "EVENT_CLOSED", "This event is no longer accepting responses");
  }
  return prisma.guest.update({
    where: { token },
    data: { rsvp: input.rsvp, plusOnes: input.plusOnes ?? g.plusOnes, respondedAt: new Date() },
    select: { name: true, rsvp: true, plusOnes: true, respondedAt: true },
  });
}
