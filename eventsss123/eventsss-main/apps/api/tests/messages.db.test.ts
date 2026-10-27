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
    const outsider = await signup("message-outsider");
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
    const eventResponse = await request(app).post("/api/v1/events").set(auth(owner.token))
      .send({ title: "Message access event", type: "SOCIAL" });
    expect(eventResponse.status).toBe(201);
    const eventId = eventResponse.body.event.id as string;

    try {
      await prisma.eventVerifierAssignment.create({
        data: { eventId, verifierId: verifier.id, zone: "GENERAL", isLead: true },
      });

      const thread = await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(owner.token));
      expect(thread.status).toBe(200);
      expect(thread.body.participants.map((entry: { id: string }) => entry.id)).toContain(verifier.id);

      const personal = await request(app).post(`/api/v1/events/${eventId}/messages`).set(auth(owner.token))
        .send({ recipientIds: [verifier.id], body: "Please confirm your zone." });
      expect(personal.status).toBe(201);
      expect(personal.body.items).toHaveLength(1);

      const received = await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(verifier.token));
      expect(received.body.items[0].body).toBe("Please confirm your zone.");
      const read = await request(app).patch(`/api/v1/events/${eventId}/messages/read`).set(auth(verifier.token));
      expect(read.body.updated).toBe(1);

      const broadcast = await request(app).post(`/api/v1/events/${eventId}/messages`).set(auth(owner.token))
        .send({ broadcast: true, body: "Team update." });
      expect(broadcast.status).toBe(201);
      expect(broadcast.body.items).toHaveLength(1);

      expect((await request(app).get(`/api/v1/events/${eventId}/messages`).set(auth(outsider.token))).status).toBe(403);
      expect((await request(app).post(`/api/v1/events/${eventId}/messages`).set(auth(owner.token))
        .send({ recipientIds: [outsider.id], body: "Not a participant." })).status).toBe(403);
    } finally {
      await prisma.message.deleteMany({ where: { eventId } });
      await request(app).delete(`/api/v1/events/${eventId}`).set(auth(owner.token));
    }
  }, 30_000);
});
