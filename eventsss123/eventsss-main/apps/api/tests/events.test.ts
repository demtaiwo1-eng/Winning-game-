import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { generateChecklist } from "../src/modules/events/checklist.templates";
import { summarize } from "../src/modules/events/budget.service";
import {
  budgetCreateSchema, createEventSchema, guestBulkSchema, guestCheckInSchema, updateEventSchema,
  planAnswersSchema,
} from "../src/modules/events/events.schemas";
import { EventType } from "@prisma/client";

const app = createApp();

describe("checklist templates", () => {
  it("every event type produces common + specific tasks, earliest first", () => {
    for (const type of Object.values(EventType)) {
      const start = new Date("2027-06-01T10:00:00Z");
      const tasks = generateChecklist(type, start);
      expect(tasks.length).toBeGreaterThan(12);
      expect(tasks.some((task) => task.tier === "ESSENTIAL")).toBe(true);
      expect(tasks.every((task) => ["ESSENTIAL", "RECOMMENDED", "OPTIONAL"].includes(task.tier))).toBe(true);
      const due = tasks.map((t) => t.dueAt!.getTime());
      expect([...due].sort((a, b) => a - b)).toEqual(due);
      expect(tasks.map((t) => t.sortOrder)).toEqual(tasks.map((_, i) => i));
    }
  });
  it("has null due dates without a start date and a post-event task", () => {
    const tasks = generateChecklist("VIRTUAL", null);
    expect(tasks.every((t) => t.dueAt === null)).toBe(true);
    const start = new Date("2027-06-01T10:00:00Z");
    const last = generateChecklist("VIRTUAL", start).at(-1)!;
    expect(last.dueAt!.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("schemas", () => {
  it("rejects endsAt before startsAt", () => {
    const r = createEventSchema.safeParse({ title: "Party", startsAt: "2027-01-02", endsAt: "2027-01-01" });
    expect(r.success).toBe(false);
  });
  it("create defaults autoChecklist true; update allows partial", () => {
    expect(createEventSchema.parse({ title: "Party" }).autoChecklist).toBe(true);
    expect(updateEventSchema.parse({ city: "Abuja" })).toEqual({ city: "Abuja" });
  });
  it("validates creation idempotency keys and excludes them from event updates", () => {
    const clientRequestId = "c12a950d-56eb-42ba-8eaa-3d28f777f731";
    expect(createEventSchema.parse({ title: "Party", clientRequestId }).clientRequestId).toBe(clientRequestId);
    expect(createEventSchema.safeParse({ title: "Party", clientRequestId: "invalid" }).success).toBe(false);
    expect(updateEventSchema.parse({ clientRequestId })).toEqual({});
  });
  it("accepts partial planning answers and rejects unknown or oversized answers", () => {
    expect(planAnswersSchema.parse({ answers: { desiredOutcome: "Bring the community together" } }).answers.desiredOutcome)
      .toBe("Bring the community together");
    expect(planAnswersSchema.safeParse({ answers: { unexpected: "value" } }).success).toBe(false);
    expect(planAnswersSchema.safeParse({ answers: { desiredOutcome: "x".repeat(2001) } }).success).toBe(false);
  });
  it("caps bulk guests at 500", () => {
    const guests = Array.from({ length: 501 }, (_, i) => ({ name: `G${i}` }));
    expect(guestBulkSchema.safeParse({ guests }).success).toBe(false);
  });
  it("accepts a single guest identifier and supported check-in method", () => {
    expect(guestCheckInSchema.parse({ guestId: "c12a950d-56eb-42ba-8eaa-3d28f777f731", method: "NFC" }).method).toBe("NFC");
    expect(guestCheckInSchema.parse({ token: "c12a950d-56eb-42ba-8eaa-3d28f777f731" }).method).toBe("MANUAL");
    expect(guestCheckInSchema.safeParse({}).success).toBe(false);
    expect(guestCheckInSchema.safeParse({ guestId: "c12a950d-56eb-42ba-8eaa-3d28f777f731", token: "c12a950d-56eb-42ba-8eaa-3d28f777f731" }).success).toBe(false);
  });
  it("budget accepts digit strings/ints as bigint, rejects decimals and negatives", () => {
    expect(budgetCreateSchema.parse({ label: "Cake", plannedMinor: "150000" }).plannedMinor).toBe(150000n);
    expect(budgetCreateSchema.parse({ label: "Cake", plannedMinor: 500 }).plannedMinor).toBe(500n);
    expect(budgetCreateSchema.safeParse({ label: "Cake", plannedMinor: "12.5" }).success).toBe(false);
    expect(budgetCreateSchema.safeParse({ label: "Cake", plannedMinor: -1 }).success).toBe(false);
  });
});

describe("budget summary", () => {
  it("sums totals, variance and categories", () => {
    const s = summarize([
      { category: "Food", plannedMinor: 1000n, actualMinor: 1200n },
      { category: "Food", plannedMinor: 500n, actualMinor: 0n },
      { category: null, plannedMinor: 300n, actualMinor: 100n },
    ]);
    expect(s.totals).toEqual({ plannedMinor: "1800", actualMinor: "1300", varianceMinor: "500" });
    expect(s.byCategory.find((c) => c.category === "Food")!.varianceMinor).toBe("300");
    expect(s.byCategory.some((c) => c.category === "Uncategorised")).toBe(true);
  });
});

describe("routes (DB-free)", () => {
  it("events require auth", async () => {
    expect((await request(app).get("/api/v1/events")).status).toBe(401);
    expect((await request(app).post("/api/v1/events").send({ title: "x" })).status).toBe(401);
    expect((await request(app).get("/api/v1/events/6f1c1b0e-8f5e-4c5e-9d8a-1a2b3c4d5e6f/plan-answers")).status).toBe(401);
    expect((await request(app).put("/api/v1/events/6f1c1b0e-8f5e-4c5e-9d8a-1a2b3c4d5e6f/plan-answers").send({ answers: {} })).status).toBe(401);
  });
  it("public RSVP validates token format before touching the DB", async () => {
    expect((await request(app).get("/api/v1/rsvp/not-a-uuid")).status).toBe(400);
    const r = await request(app).post("/api/v1/rsvp/6f1c1b0e-8f5e-4c5e-9d8a-1a2b3c4d5e6f").send({ rsvp: "NOPE" });
    expect(r.status).toBe(400);
  });
});
