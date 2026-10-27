import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/errors";
import type { EventMessagesQuery, SendEventMessageInput } from "./messages.schemas";

async function getEventParticipants(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      ownerId: true,
      bookings: {
        where: { status: { notIn: ["CANCELLED", "REFUNDED"] } },
        select: { buyerId: true, vendor: { select: { userId: true } } },
      },
      verifierAssignments: { select: { verifierId: true } },
      readiness: { select: { assignedVerifierId: true } },
    },
  });
  if (!event) throw new HttpError(404, "NOT_FOUND", "Event not found");

  const participantIds = new Set<string>([event.ownerId]);
  for (const booking of event.bookings) {
    participantIds.add(booking.buyerId);
    participantIds.add(booking.vendor.userId);
  }
  for (const assignment of event.verifierAssignments) participantIds.add(assignment.verifierId);
  if (event.readiness?.assignedVerifierId) participantIds.add(event.readiness.assignedVerifierId);

  const participants = await prisma.user.findMany({
    where: { id: { in: [...participantIds] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return { participants, participantIds };
}

async function assertEventParticipant(userId: string, eventId: string) {
  const result = await getEventParticipants(eventId);
  if (!result.participantIds.has(userId)) {
    throw new HttpError(403, "FORBIDDEN", "You are not a participant in this event");
  }
  return result;
}

export async function listEventMessages(
  userId: string,
  eventId: string,
  query: EventMessagesQuery,
) {
  const { participants } = await assertEventParticipant(userId, eventId);
  const rows = await prisma.message.findMany({
    where: {
      eventId,
      OR: [{ senderId: userId }, { recipientId: userId }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, name: true, role: true } },
      recipient: { select: { id: true, name: true, role: true } },
    },
  });
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit).reverse();
  return {
    items: page,
    participants,
    viewerId: userId,
    nextBefore: hasMore ? page[0]?.id ?? null : null,
  };
}

export async function sendEventMessage(userId: string, eventId: string, input: SendEventMessageInput) {
  const { participants, participantIds } = await assertEventParticipant(userId, eventId);
  const recipients = input.broadcast
    ? participants.filter((participant) => participant.id !== userId).map((participant) => participant.id)
    : input.recipientIds ?? [];
  if (recipients.length === 0) {
    throw new HttpError(409, "NO_EVENT_RECIPIENTS", "There are no other event participants to message");
  }
  if (recipients.some((recipientId) => recipientId === userId || !participantIds.has(recipientId))) {
    throw new HttpError(403, "FORBIDDEN", "Messages can only be sent to other event participants");
  }
  const items = await prisma.$transaction(
    recipients.map((recipientId) =>
      prisma.message.create({
        data: { senderId: userId, recipientId, eventId, body: input.body },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          recipient: { select: { id: true, name: true, role: true } },
        },
      }),
    ),
  );
  return { items };
}

export async function markEventMessagesRead(userId: string, eventId: string) {
  await assertEventParticipant(userId, eventId);
  const result = await prisma.message.updateMany({
    where: { eventId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}
