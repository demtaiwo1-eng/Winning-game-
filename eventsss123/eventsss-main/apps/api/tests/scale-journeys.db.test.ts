import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { register } from "../src/modules/auth/auth.service";
import { prisma } from "../src/lib/prisma";

const app = createApp();
const enabled = process.env.RUN_SCALE_DB_TESTS === "1";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const prefix = `qa-scale-${runId}`;
const password = "Scale-QA-Only-2026!";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const eventTypes = ["PERSONAL", "CORPORATE", "SOCIAL", "SPORTS", "CULTURAL", "RELIGIOUS", "ENTERTAINMENT", "EDUCATIONAL", "VIRTUAL"] as const;

type TestUser = { id: string; token: string; email: string };

async function batches<T>(items: T[], size: number, action: (item: T, index: number) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map((item, offset) => action(item, index + offset)));
  }
}

async function createUser(index: number, role: "CLIENT" | "VENDOR" | "VERIFIER"): Promise<TestUser> {
  const email = `${prefix}-${role.toLowerCase()}-${String(index + 1).padStart(3, "0")}@example.test`;
  const result = await register({
    email,
    password,
    name: `Scale ${role} ${index + 1}`,
    role,
    country: "NG",
    currency: "NGN",
    locale: "en",
    ...(role === "VENDOR" ? { businessName: `Scale Test Vendor ${index + 1}`, businessCity: "Lagos" } : {}),
  });
  return { id: result.user.id, token: result.accessToken, email };
}

describe.skipIf(!enabled)("EPHINTA 300-persona isolated scale journey", () => {
  it("runs 100 distinct client, 100 vendor and 100 verifier journeys", async () => {
    // This suite must run only against a disposable QA database. It creates
    // 300 real database users and 100 distinct event drafts; it never touches
    // payment, payout, refund, live provider or production data.
    const clients: TestUser[] = [];
    const vendors: TestUser[] = [];
    const verifiers: TestUser[] = [];

    await batches(Array.from({ length: 100 }, (_, i) => i), 10, async (i) => {
      clients.push(await createUser(i, "CLIENT"));
    });
    await batches(Array.from({ length: 100 }, (_, i) => i), 10, async (i) => {
      vendors.push(await createUser(i, "VENDOR"));
    });
    await batches(Array.from({ length: 100 }, (_, i) => i), 10, async (i) => {
      verifiers.push(await createUser(i, "VERIFIER"));
    });

    expect(new Set([...clients, ...vendors, ...verifiers].map((user) => user.email)).size).toBe(300);
    expect(new Set([...clients, ...vendors, ...verifiers].map((user) => user.id)).size).toBe(300);

    const eventIds: string[] = Array(100).fill("");
    const createdAt = Date.now();
    const eventStartBase = Date.now() + 24 * 60 * 60 * 1000;
    await batches(clients, 10, async (client, index) => {
      const startsAt = new Date(eventStartBase + index * 60_000);
      const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
      const response = await request(app)
        .post("/api/v1/events")
        .set(auth(client.token))
        .set("X-Forwarded-For", `198.51.100.${index + 1}`)
        .send({
          title: `Scale journey ${index + 1} ${createdAt}`,
          type: eventTypes[index % eventTypes.length],
          currency: "NGN",
          country: "NG",
          city: ["Lagos", "Abuja", "Ibadan", "Port Harcourt", "Kano"][index % 5],
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          expectedGuests: 30 + ((index * 17) % 970),
          budgetMinor: String(500000 + index * 12500),
        });
      expect(response.status, `client event creation: ${client.email}`).toBe(201);
      expect(response.body.event?.id).toBeTruthy();
      eventIds[index] = response.body.event.id as string;
    });

    // Each vendor creates one distinct unpublished service listing through the
    // real API; the category is isolated to this run and never promoted live.
    const category = await prisma.category.create({
      data: { name: `Scale QA ${runId}`, slug: `${prefix}-services` },
    });
    await batches(vendors, 10, async (vendor, index) => {
      const profile = await request(app).get("/api/v1/vendor/profile").set(auth(vendor.token)).set("X-Forwarded-For", `203.0.113.${index + 1}`);
      expect(profile.status, `vendor profile access: ${vendor.email}`).toBe(200);
      expect(profile.body.profile?.businessName).toContain("Scale Test Vendor");
      const listing = await request(app).post("/api/v1/vendor/listings").set(auth(vendor.token)).set("X-Forwarded-For", `203.0.113.${index + 1}`).send({
        title: `QA Service Package ${index + 1}`,
        description: `Synthetic unpublished listing for vendor ${index + 1}`,
        priceMinor: String(250000 + index * 1000),
        categoryId: category.id,
        type: "SERVICE",
        status: "DRAFT",
        currency: "NGN",
        city: "Lagos",
        capacity: 50 + index,
      });
      expect(listing.status, `vendor draft listing: ${vendor.email}`).toBe(201);
      expect(listing.body.listing?.status).toBe("DRAFT");
    });

    // Assign one event to each distinct verifier, claim it, and read its
    // readiness board. This exercises the real role boundary and assignment.
    await batches(verifiers, 10, async (verifier, index) => {
      const eventId = eventIds[index];
      await prisma.eventVerifierAssignment.create({
        data: { eventId, verifierId: verifier.id, zone: "GENERAL", isLead: true },
      });
      const claim = await request(app).post(`/api/v1/readiness/events/${eventId}/claim`).set(auth(verifier.token)).set("X-Forwarded-For", `192.0.2.${index + 1}`).send({});
      expect(claim.status, `verifier claims assigned event: ${verifier.email}`).toBe(200);
      const board = await request(app).get(`/api/v1/readiness/events/${eventId}`).set(auth(verifier.token)).set("X-Forwarded-For", `192.0.2.${index + 1}`);
      expect(board.status, `verifier readiness board: ${verifier.email}`).toBe(200);
      expect(board.body.canFinalize).toBe(true);
      const queue = await request(app).get("/api/v1/readiness/queue").set(auth(verifier.token)).set("X-Forwarded-For", `192.0.2.${index + 1}`);
      expect(queue.status, `verifier queue access: ${verifier.email}`).toBe(200);
      expect(Array.isArray(queue.body.items)).toBe(true);
    });
    const forbidden = await request(app).get("/api/v1/readiness/queue").set(auth(clients[0].token)).set("X-Forwarded-For", "198.51.100.203");
    expect(forbidden.status).toBe(403);

    // Exercise event ownership boundaries using a different client identity.
    const ownEvent = await request(app).get(`/api/v1/events/${eventIds[0]}`).set(auth(clients[0].token)).set("X-Forwarded-For", "198.51.100.201");
    expect(ownEvent.status).toBe(200);
    const foreignEvent = await request(app).get(`/api/v1/events/${eventIds[0]}`).set(auth(clients[1].token)).set("X-Forwarded-For", "198.51.100.202");
    expect([403, 404]).toContain(foreignEvent.status);

    // Concurrent read burst: 100 independent verifier sessions, bounded to
    // batches of 10 to avoid turning a functional test into a DB connection
    // exhaustion test. The separate load-test phase increases concurrency.
    let successfulQueueReads = 0;
    await batches(verifiers, 10, async (verifier, index) => {
      const response = await request(app).get("/api/v1/readiness/queue").set(auth(verifier.token)).set("X-Forwarded-For", `192.0.2.${index + 1}`);
      if (response.status === 200) successfulQueueReads += 1;
    });
    expect(successfulQueueReads).toBe(100);
    expect(eventIds).toHaveLength(100);
  }, 240_000);
});

afterAll(async () => {
  if (!enabled) return;
  // Keep the disposable QA database tidy after the run. Related rows are
  // removed by the User foreign-key cascade rules in the Prisma schema.
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await prisma.category.deleteMany({ where: { slug: `${prefix}-services` } });
});
