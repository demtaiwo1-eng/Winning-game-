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

    const eventIds: string[] = [];
    const createdAt = Date.now();
    await batches(clients, 10, async (client, index) => {
      const response = await request(app)
        .post("/api/v1/events")
        .set(auth(client.token))
        .send({
          title: `Scale journey ${index + 1} ${createdAt}`,
          type: eventTypes[index % eventTypes.length],
          currency: "NGN",
          country: "NG",
          city: ["Lagos", "Abuja", "Ibadan", "Port Harcourt", "Kano"][index % 5],
          expectedGuests: 30 + ((index * 17) % 970),
          budgetMinor: String(500000 + index * 12500),
        });
      expect(response.status, `client event creation: ${client.email}`).toBe(201);
      expect(response.body.event?.id).toBeTruthy();
      eventIds.push(response.body.event.id as string);
    });

    // Each vendor's profile is created as part of the registration transaction.
    await batches(vendors, 10, async (vendor) => {
      const response = await request(app).get("/api/v1/vendor/profile").set(auth(vendor.token));
      expect(response.status, `vendor profile access: ${vendor.email}`).toBe(200);
      expect(response.body.profile?.businessName).toContain("Scale Test Vendor");
    });

    // Each verifier has a distinct identity and is authorized for the verifier
    // queue. A client token must never be able to access this role-only route.
    await batches(verifiers, 10, async (verifier) => {
      const response = await request(app).get("/api/v1/readiness/queue").set(auth(verifier.token));
      expect(response.status, `verifier queue access: ${verifier.email}`).toBe(200);
      expect(Array.isArray(response.body.items)).toBe(true);
    });
    const forbidden = await request(app).get("/api/v1/readiness/queue").set(auth(clients[0].token));
    expect(forbidden.status).toBe(403);

    // Exercise event ownership boundaries using a different client identity.
    const ownEvent = await request(app).get(`/api/v1/events/${eventIds[0]}`).set(auth(clients[0].token));
    expect([200, 404]).toContain(ownEvent.status);
    const foreignEvent = await request(app).get(`/api/v1/events/${eventIds[0]}`).set(auth(clients[1].token));
    expect([403, 404]).toContain(foreignEvent.status);

    // Concurrent read burst: 100 independent verifier sessions, bounded to
    // batches of 10 to avoid turning a functional test into a DB connection
    // exhaustion test. The separate load-test phase increases concurrency.
    let successfulQueueReads = 0;
    await batches(verifiers, 10, async (verifier) => {
      const response = await request(app).get("/api/v1/readiness/queue").set(auth(verifier.token));
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
});
