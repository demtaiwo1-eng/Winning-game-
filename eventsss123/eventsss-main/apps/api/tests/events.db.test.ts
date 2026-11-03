// Full-flow integration test. Needs a migrated DB: run `npm run test:db`
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

const app = createApp();
const run = process.env.RUN_DB_TESTS === "1";

async function signup(tag: string) {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.dev`;
  const res = await request(app).post("/api/v1/auth/register").send({ email, password: "correct-horse-1", name: `User ${tag}` });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

describe.skipIf(!run)("events flow (DB)", () => {
  it("owner can plan an event end to end; others cannot see it", async () => {
    const owner = await signup("owner");
    const other = await signup("other");
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

    const created = await request(app).post("/api/v1/events").set(auth(owner))
      .send({
        title: "Ada & Tunde Wedding",
        type: "PERSONAL",
        startsAt: "2027-06-01T10:00:00Z",
        city: "Abuja",
        country: "ng",
        clientRequestId: "c12a950d-56eb-42ba-8eaa-3d28f777f731",
      });
    expect(created.status).toBe(201);
    const id = created.body.event.id as string;
    expect(created.body.event.country).toBe("NG");
    const retried = await request(app).post("/api/v1/events").set(auth(owner)).send({
      title: "Ada & Tunde Wedding",
      type: "PERSONAL",
      startsAt: "2027-06-01T10:00:00Z",
      city: "Abuja",
      country: "ng",
      clientRequestId: "c12a950d-56eb-42ba-8eaa-3d28f777f731",
    });
    expect(retried.status).toBe(201);
    expect(retried.body.event.id).toBe(id);

    const tasks = await request(app).get(`/api/v1/events/${id}/tasks`).set(auth(owner));
    expect(tasks.body.tasks.length).toBeGreaterThan(12);
    expect((await request(app).post(`/api/v1/events/${id}/tasks/generate-checklist`).set(auth(owner))).status).toBe(409);

    const g = await request(app).post(`/api/v1/events/${id}/guests`).set(auth(owner)).send({ name: "Chidi", plusOnes: 1 });
    expect(g.status).toBe(201);
    const token = g.body.guest.token as string;

    const view = await request(app).get(`/api/v1/rsvp/${token}`);
    expect(view.status).toBe(200);
    expect(view.body.event.title).toBe("Ada & Tunde Wedding");
    expect(view.body.event.id).toBeUndefined();

    const resp = await request(app).post(`/api/v1/rsvp/${token}`).send({ rsvp: "ACCEPTED", plusOnes: 2 });
    expect(resp.status).toBe(200);

    await request(app).post(`/api/v1/events/${id}/budget/items`).set(auth(owner))
      .send({ label: "Catering", category: "Food", plannedMinor: "50000000", actualMinor: "45000000" });
    const b = await request(app).get(`/api/v1/events/${id}/budget`).set(auth(owner));
    expect(b.body.totals.varianceMinor).toBe("5000000");

    const detail = await request(app).get(`/api/v1/events/${id}`).set(auth(owner));
    expect(detail.body.summary.guests.expectedHeadcount).toBe(3);

    expect((await request(app).get(`/api/v1/events/${id}`).set(auth(other))).status).toBe(404);
    expect((await request(app).get(`/api/v1/events/${id}/guests`).set(auth(other))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/events/${id}`).set(auth(other))).status).toBe(404);
    expect((await request(app).delete(`/api/v1/events/${id}`).set(auth(owner))).status).toBe(204);
  }, 30_000);

  it("records an event deposit once and reconciles wallet escrow with the event budget", async () => {
    const email = `deposit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;
    const registered = await request(app).post("/api/v1/auth/register").send({
      email, password: "correct-horse-1", name: "Deposit Planner",
    });
    expect(registered.status).toBe(201);
    const token = registered.body.accessToken as string;
    const userId = registered.body.user.id as string;
    const auth = { Authorization: `Bearer ${token}` };
    const eventResponse = await request(app).post("/api/v1/events").set(auth)
      .send({ title: "Funded event deposit", type: "PERSONAL", currency: "NGN" });
    expect(eventResponse.status).toBe(201);
    const eventId = eventResponse.body.event.id as string;
    const wallet = await prisma.wallet.upsert({
      where: { userId_currency: { userId, currency: "NGN" } },
      update: { availableMinor: 100000n, escrowMinor: 0n },
      create: { userId, currency: "NGN", availableMinor: 100000n, escrowMinor: 0n },
    });
    try {
      const payload = { amountMinor: "25000", idempotencyKey: "event-deposit-test-0001" };
      const concurrent = await Promise.all([
        request(app).post(`/api/v1/events/${eventId}/deposits`).set(auth).send(payload),
        request(app).post(`/api/v1/events/${eventId}/deposits`).set(auth).send(payload),
      ]);
      expect(concurrent.map((response) => response.status).sort()).toEqual([200, 201]);
      expect(concurrent.every((response) => response.body.deposit.amountMinor === "25000")).toBe(true);
      expect(concurrent.some((response) => response.body.alreadyProcessed === true)).toBe(true);
      const updatedWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      expect(updatedWallet.availableMinor).toBe(75000n);
      expect(updatedWallet.escrowMinor).toBe(25000n);
      expect(await prisma.ledgerEntry.count({ where: { walletId: wallet.id, refType: "EVENT_DEPOSIT" } })).toBe(1);
      const budget = await request(app).get(`/api/v1/events/${eventId}/budget`).set(auth);
      expect(budget.body.funding.depositTotalMinor).toBe("25000");
      expect(budget.body.deposits).toHaveLength(1);
      const insufficient = await request(app).post(`/api/v1/events/${eventId}/deposits`).set(auth)
        .send({ amountMinor: "80000", idempotencyKey: "event-deposit-test-0002" });
      expect(insufficient.status).toBe(400);
    } finally {
      await prisma.event.delete({ where: { id: eventId } });
      await prisma.ledgerEntry.deleteMany({ where: { walletId: wallet.id } });
      await prisma.wallet.delete({ where: { id: wallet.id } });
    }
  }, 30_000);
});
