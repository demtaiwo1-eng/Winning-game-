import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/errors";
import { createNotification } from "../notifications/notifications.service";
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

export async function listEventMessages(userId: string, eventId: string, query: EventMessagesQuery) {
  const { participants } = await assertEventParticipant(userId, eventId);
  const visibleToUser = query.folder === "INBOX"
    ? { recipientId: userId, recipientDeletedAt: null, recipientArchivedAt: null }
    : query.folder === "SENT"
      ? { senderId: userId, senderDeletedAt: null, senderArchivedAt: null }
      : query.folder === "ARCHIVED"
        ? {
            OR: [
              { senderId: userId, senderDeletedAt: null, senderArchivedAt: { not: null } },
              { recipientId: userId, recipientDeletedAt: null, recipientArchivedAt: { not: null } },
            ],
          }
        : {
            OR: [
              { senderId: userId, senderDeletedAt: null },
              { recipientId: userId, recipientDeletedAt: null },
            ],
          };
  const rows = await prisma.message.findMany({
    where: {
      eventId,
      ...visibleToUser,
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
    ? participants.filter((participant) => participant.id !== userId).map((participant) => ({ id: participant.id, kind: "TO" }))
    : input.recipientIds
      ? input.recipientIds.map((id) => ({ id, kind: "TO" }))
      : [
          ...(input.toIds ?? []).map((id) => ({ id, kind: "TO" })),
          ...(input.ccIds ?? []).map((id) => ({ id, kind: "CC" })),
          ...(input.bccIds ?? []).map((id) => ({ id, kind: "BCC" })),
        ];
  if (recipients.length === 0) {
    throw new HttpError(409, "NO_EVENT_RECIPIENTS", "There are no other event participants to message");
  }
  if (recipients.some(({ id }) => id === userId || !participantIds.has(id))) {
    throw new HttpError(403, "FORBIDDEN", "Messages can only be sent to other event participants");
  }
  const groupId = randomUUID();
  const items = await prisma.$transaction(
    recipients.map(({ id, kind }) =>
      prisma.message.create({
        data: {
          groupId,
          senderId: userId,
          recipientId: id,
          recipientKind: kind,
          toRecipientIds: input.broadcast
            ? recipients.map((recipient) => recipient.id)
            : input.recipientIds ?? input.toIds ?? [],
          ccRecipientIds: input.broadcast || input.recipientIds ? [] : input.ccIds ?? [],
          eventId,
          body: input.body,
        },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          recipient: { select: { id: true, name: true, role: true } },
        },
      }),
    ),
  );
  const senderName = participants.find((participant) => participant.id === userId)?.name ?? "An event participant";
  await Promise.allSettled(recipients.map(({ id }) => createNotification({
    userId: id,
    type: "MESSAGE",
    category: "MESSAGE",
    title: "New event message",
    body: `${senderName}: ${input.body.slice(0, 220)}`,
    data: { eventId, senderId: userId, groupId },
  })));
  return { items };
}

export async function markEventMessagesRead(userId: string, eventId: string) {
  await assertEventParticipant(userId, eventId);
  const result = await prisma.message.updateMany({
    where: { eventId, recipientId: userId, recipientDeletedAt: null, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

export async function updateEventMessageState(
  userId: string,
  eventId: string,
  messageId: string,
  action: "READ" | "UNREAD" | "ARCHIVE" | "UNARCHIVE" | "DELETE",
) {
  await assertEventParticipant(userId, eventId);
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      eventId,
      OR: [{ senderId: userId }, { recipientId: userId }],
    },
    select: { id: true, groupId: true, senderId: true, recipientId: true },
  });
  if (!message) throw new HttpError(404, "NOT_FOUND", "Message not found");
  const now = new Date();
  if (action === "READ" || action === "UNREAD") {
    if (message.recipientId !== userId) {
      throw new HttpError(403, "FORBIDDEN", "Only the recipient can change a message's read status");
    }
    await prisma.message.update({
      where: { id: message.id },
      data: { readAt: action === "READ" ? now : null },
    });
  } else if (action === "ARCHIVE" || action === "UNARCHIVE") {
    const archiveValue = action === "ARCHIVE" ? now : null;
    if (message.senderId === userId) {
      await prisma.message.updateMany({
        where: { groupId: message.groupId, senderId: userId, senderDeletedAt: null },
        data: { senderArchivedAt: archiveValue },
      });
    } else {
      await prisma.message.update({
        where: { id: message.id },
        data: { recipientArchivedAt: archiveValue },
      });
    }
  } else if (message.senderId === userId) {
    await prisma.message.updateMany({
      where: { groupId: message.groupId, senderId: userId, senderDeletedAt: null },
      data: { senderDeletedAt: now },
    });
  } else {
    await prisma.message.update({
      where: { id: message.id },
      data: { recipientDeletedAt: now },
    });
  }
  return { ok: true };
}
