import { describe, expect, it } from "vitest";
import {
  assertEventFinalizationAllowed,
  assertEscrowReleaseAllowed,
} from "../src/modules/payments/escrowPolicy";

const endedAt = new Date("2025-01-01T12:00:00.000Z");
const now = new Date("2025-01-01T13:00:00.000Z");
const validGate = {
  actorUserId: "lead-verifier",
  assignedVerifierId: "lead-verifier",
  eventStatus: "PLANNING",
  eventEndsAt: endedAt,
  checkCount: 2,
  greenCount: 2,
};

describe("verifier escrow policy", () => {
  it("allows the assigned lead to complete an ended event with every check green", () => {
    expect(() => assertEventFinalizationAllowed(validGate, now)).not.toThrow();
  });

  it("rejects completion by anyone other than the assigned lead verifier", () => {
    expect(() =>
      assertEventFinalizationAllowed({ ...validGate, actorUserId: "another-verifier" }, now),
    ).toThrow(/assigned lead verifier/);
  });

  it("rejects completion before the event end time or without an end time", () => {
    expect(() =>
      assertEventFinalizationAllowed({ ...validGate, eventEndsAt: new Date(now.getTime() + 1) }, now),
    ).toThrow(/until the event has ended/);
    expect(() =>
      assertEventFinalizationAllowed({ ...validGate, eventEndsAt: null }, now),
    ).toThrow(/end time/);
  });

  it("rejects completion when there are no checks or any check is not green", () => {
    expect(() =>
      assertEventFinalizationAllowed({ ...validGate, checkCount: 0, greenCount: 0 }, now),
    ).toThrow(/Every event service check/);
    expect(() =>
      assertEventFinalizationAllowed({ ...validGate, greenCount: 1 }, now),
    ).toThrow(/Every event service check/);
  });

  it("requires verifier completion before releasing escrow", () => {
    expect(() => assertEscrowReleaseAllowed(validGate, now)).toThrow(/complete the event/);
    expect(() =>
      assertEscrowReleaseAllowed({ ...validGate, eventStatus: "COMPLETED" }, now),
    ).not.toThrow();
  });

  it("does not let an administrator bypass the verifier, event-end, or readiness gates", () => {
    expect(() =>
      assertEscrowReleaseAllowed(
        { ...validGate, eventStatus: "COMPLETED", actorUserId: "admin", assignedVerifierId: "lead-verifier" },
        now,
      ),
    ).toThrow(/assigned lead verifier/);
    expect(() =>
      assertEscrowReleaseAllowed(
        { ...validGate, eventStatus: "COMPLETED", greenCount: 1 },
        now,
      ),
    ).toThrow(/Every event service check/);
  });
});
