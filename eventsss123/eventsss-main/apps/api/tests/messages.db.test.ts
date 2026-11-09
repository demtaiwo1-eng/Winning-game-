import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

const app = createApp();
const run = process.env.RUN_DB_TESTS === "1";

async function signup(tag: string, role: "CLIENT" | "VERIFIER" = "CLIENT") {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
  const response = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "correct-horse-1",
    name: `User ${tag}`,
    role,
  });
  expect(response.status).toBe(201);
  return { token: response.body.accessToken as string, id: response.body.user.id as string };
}

describe.skipIf(!run)("event messages (DB)", () => {
  it("restricts conversations to event participants and supports personal, broadcast, and read flows", async () => {
    const owner = await signup("message-owner");
    const verifier = await signup("message-verifier", "VERIFIER");
    const verifierTwo = await signup("message-verifier-two", "VERIFIER");
    const outsider = await signup("message-outsider");
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
    const eventResponse = await request(app).post("/api/v1/events").set(auth(owner.token))
      .send({ title: "Message access event", type: "SOCIAL" });
    expect(eventResponse.status).toBe(201);
    const eventId = eventResponse.body.event.id as string;

    try {
      await prisma.eventVerifierAssignment.createMany({
        data: [
          { eventId, verifierId: verifier.id, zone: "GENERAL", isLead: true },
          { eventId, verifierId: verifierTwo.id, zone: "ACCESS", isLead: false },
        ],
      });

      const thread = await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(owner.token));
      expect(thread.status).toBe(200);
      expect(thread.body.participants.map((entry: { id: string }) => entry.id)).toContain(verifier.id);
      expect(thread.body.participants.map((entry: { id: string }) => entry.id)).toContain(verifierTwo.id);

      const verifierPrefs = await request(app).get("/api/v1/notifications/preferences").set(auth(verifier.token));
      expect(verifierPrefs.status).toBe(200);
      await request(app).patch("/api/v1/notifications/preferences").set(auth(verifier.token))
        .send({ pushEnabled: true });

      const personal = await request(app).post(`/api/v1/events/${eventId}/messages`).set(auth(owner.token))
        .send({ recipientIds: [verifier.id], body: "Please confirm your zone." });
      expect(personal.status).toBe(201);
      expect(personal.body.items).toHaveLength(1);

      const carbonCopy = await request(app).post(`/api/v1/events/${eventId}/messages`).set(auth(owner.token))
        .send({ toIds: [verifier.id], ccIds: [verifierTwo.id], bccIds: [], body: "Run-of-show update." });
      expect(carbonCopy.status).toBe(201);
      expect(carbonCopy.body.items).toHaveLength(2);
      expect(carbonCopy.body.items.map((item: { recipientKind: string }) => item.recipientKind).sort()).toEqual(["CC", "TO"]);
      const sentArchive = await request(app).patch(`/api/v1/events/${eventId}/messages/${carbonCopy.body.items[0].id}/archive`).set(auth(owner.token));
      expect(sentArchive.status).toBe(200);
      const sentArchivedFolder = await request(app).get(`/api/v1/events/${eventId}/messages?folder=ARCHIVED`).set(auth(owner.token));
      expect(sentArchivedFolder.body.items.filter((item: { groupId: string }) => item.groupId === carbonCopy.body.items[0].groupId)).toHaveLength(2);
      expect((await request(app).patch(`/api/v1/events/${eventId}/messages/${carbonCopy.body.items[0].id}/unarchive`).set(auth(owner.token))).status).toBe(200);
      expect((await request(app).delete(`/api/v1/events/${eventId}/messages/${carbonCopy.body.items[0].id}`).set(auth(owner.token))).status).toBe(200);
      const sentAfterDelete = await request(app).get(`/api/v1/events/${eventId}/messages?folder=ALL`).set(auth(owner.token));
      expect(sentAfterDelete.body.items.some((item: { groupId: string }) => item.groupId === carbonCopy.body.items[0].groupId)).toBe(false);
      const verifierCopy = carbonCopy.body.items.find((item: { recipientId: string }) => item.recipientId === verifier.id);
      expect(verifierCopy.toRecipientIds).toEqual([verifier.id]);
      expect(verifierCopy.ccRecipientIds).toEqual([verifierTwo.id]);
      const copyRead = await request(app).patch(`/api/v1/events/${eventId}/messages/${verifierCopy.id}/read`).set(auth(verifier.token));
      expect(copyRead.status).toBe(200);
      const copyUnread = await request(app).patch(`/api/v1/events/${eventId}/messages/${verifierCopy.id}/unread`).set(auth(verifier.token));
      expect(copyUnread.status).toBe(200);
      const copyArchive = await request(app).patch(`/api/v1/events/${eventId}/messages/${verifierCopy.id}/archive`).set(auth(verifier.token));
      expect(copyArchive.status).toBe(200);
      const archivedCopy = await request(app).get(`/api/v1/events/${eventId}/messages?folder=ARCHIVED`).set(auth(verifier.token));
      expect(archivedCopy.body.items.some((item: { id: string }) => item.id === verifierCopy.id)).toBe(true);
      expect((await request(app).patch(`/api/v1/events/${eventId}/messages/${verifierCopy.id}/unarchive`).set(auth(verifier.token))).status).toBe(200);
      const restoredCopy = await request(app).get(`/api/v1/events/${eventId}/messages?folder=ALL`).set(auth(verifier.token));
      expect(restoredCopy.body.items.some((item: { id: string }) => item.id === verifierCopy.id)).toBe(true);
      expect((await request(app).patch(`/api/v1/events/${eventId}/messages/${verifierCopy.id}/archive`).set(auth(verifier.token))).status).toBe(200);
      const copyDelete = await request(app).delete(`/api/v1/events/${eventId}/messages/${verifierCopy.id}`).set(auth(verifier.token));
      expect(copyDelete.status).toBe(200);

      const received = await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(verifier.token));
      expect(received.body.items[0].body).toBe("Please confirm your zone.");
      const verifierNotifications = await request(app).get("/api/v1/notifications").set(auth(verifier.token));
      expect(verifierNotifications.body.items).toHaveLength(2);
      expect(verifierNotifications.body.items[0].type).toBe("MESSAGE");
      expect(verifierNotifications.body.items[0].deliveryStatus).toBe("NOT_CONFIGURED");
      const notificationId = verifierNotifications.body.items[0].id as string;
      expect((await request(app).patch(`/api/v1/notifications/${notificationId}/unread`).set(auth(verifier.token)).send({})).status).toBe(200);
      expect((await request(app).patch(`/api/v1/notifications/${notificationId}/archive`).set(auth(verifier.token)).send({})).status).toBe(200);
      const archivedNotifications = await request(app).get("/api/v1/notifications?folder=ARCHIVED").set(auth(verifier.token));
      expect(archivedNotifications.body.items.some((item: { id: string }) => item.id === notificationId)).toBe(true);
      expect((await request(app).patch(`/api/v1/notifications/${notificationId}/unarchive`).set(auth(verifier.token)).send({})).status).toBe(200);
      expect((await request(app).delete(`/api/v1/notifications/${notificationId}`).set(auth(verifier.token))).status).toBe(200);
      const outsiderNotifications = await request(app).get("/api/v1/notifications").set(auth(outsider.token));
      expect(outsiderNotifications.body.items).toHaveLength(0);

      const pushToken = "fcm-device-token-for-phase6-test-0001";
      const device = await request(app).post("/api/v1/notifications/push-token").set(auth(verifier.token))
        .send({ token: pushToken, platform: "android" });
      expect(device.status).toBe(201);
      const storedDevice = await prisma.pushDevice.findFirst({ where: { userId: verifier.id } });
      expect(storedDevice?.tokenHash).toHaveLength(64);
      expect(storedDevice?.tokenHash).not.toBe(pushToken);
      expect(await prisma.auditLog.count({ where: { actorId: verifier.id, action: "PUSH_TOKEN_REGISTER" } })).toBe(0);

      const securityHistory = await request(app).get("/api/v1/auth/security-history").set(auth(owner.token));
      expect(securityHistory.body.items.some((entry: { action: string }) => entry.action === "ACCOUNT_REGISTERED")).toBe(true);

      const read = await request(app).patch(`/api/v1/events/${eventId}/messages/read`).set(auth(verifier.token));
      expect(read.body.updated).toBe(1);

      await request(app).patch("/api/v1/notifications/preferences").set(auth(verifier.token))
        .send({ messages: false });
      const secondVerifierBeforeBroadcast = await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(verifierTwo.token));
      expect(secondVerifierBeforeBroadcast.body.items).toHaveLength(1);
      const beforeBroadcast = await prisma.notification.count({ where: { userId: verifier.id } });
      const broadcast = await request(app).post(`/api/v1/events/${eventId}/messages`).set(auth(owner.token))
        .send({ broadcast: true, body: "Team update." });
      expect(broadcast.status).toBe(201);
      expect(broadcast.body.items).toHaveLength(2);
      expect(await prisma.notification.count({ where: { userId: verifier.id } })).toBe(beforeBroadcast);
      const secondVerifierReceived = await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(verifierTwo.token));
      expect(secondVerifierReceived.body.items).toHaveLength(2);
      expect(secondVerifierReceived.body.items.some((item: { body: string }) => item.body === "Team update.")).toBe(true);
      expect(secondVerifierReceived.body.items.some((item: { body: string }) => item.body === "Run-of-show update.")).toBe(true);
      const secondVerifierNotifications = await request(app).get("/api/v1/notifications").set(auth(verifierTwo.token));
      expect(secondVerifierNotifications.body.items).toHaveLength(2);
      expect(secondVerifierNotifications.body.items[0].type).toBe("MESSAGE");

      expect((await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(outsider.token))).status).toBe(403);
      expect((await request(app).post(`/api/v1/events/${eventId}/messages`).set(auth(owner.token))
        .send({ recipientIds: [outsider.id], body: "Not a participant." })).status).toBe(403);
    } finally {
      await prisma.message.deleteMany({ where: { eventId } });
      await request(app).delete(`/api/v1/events/${eventId}`).set(auth(owner.token));
    }
  }, 30_000);
});
