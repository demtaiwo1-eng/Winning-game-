import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    event: { findFirst: vi.fn() },
    eventPlanAnswer: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

import { getOwnedEvent, getPlanAnswers, savePlanAnswers } from "../src/modules/events/events.service";

describe("event ownership isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks up an event using both its ID and authenticated owner ID", async () => {
    const event = { id: "event-1", ownerId: "owner-1" };
    prismaMock.event.findFirst.mockResolvedValue(event);
    await expect(getOwnedEvent("owner-1", "event-1")).resolves.toBe(event);
    expect(prismaMock.event.findFirst).toHaveBeenCalledWith({
      where: { id: "event-1", ownerId: "owner-1" },
    });
  });

  it("returns not-found when the caller does not own the event", async () => {
    prismaMock.event.findFirst.mockResolvedValue(null);
    await expect(getOwnedEvent("owner-2", "event-1")).rejects.toThrow("Event not found");
    expect(prismaMock.event.findFirst).toHaveBeenCalledWith({
      where: { id: "event-1", ownerId: "owner-2" },
    });
  });

  it("does not read planning answers when the event is not owned", async () => {
    prismaMock.event.findFirst.mockResolvedValue(null);
    await expect(getPlanAnswers("owner-2", "event-1")).rejects.toThrow("Event not found");
    expect(prismaMock.eventPlanAnswer.findMany).not.toHaveBeenCalled();
  });

  it("does not write planning answers when the event is not owned", async () => {
    prismaMock.event.findFirst.mockResolvedValue(null);
    await expect(savePlanAnswers("owner-2", "event-1", {
      desiredOutcome: "Private answer",
    })).rejects.toThrow("Event not found");
    expect(prismaMock.eventPlanAnswer.upsert).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
