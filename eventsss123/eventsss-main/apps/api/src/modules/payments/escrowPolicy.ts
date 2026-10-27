import { HttpError } from "../../lib/errors";

type VerifierGate = {
  actorUserId: string;
  assignedVerifierId: string | null;
  eventStatus: string;
  eventEndsAt: Date | null;
  checkCount: number;
  greenCount: number;
};

function assertAssignedVerifier(input: VerifierGate) {
  if (!input.assignedVerifierId || input.assignedVerifierId !== input.actorUserId) {
    throw new HttpError(403, "FORBIDDEN", "Only the event's assigned lead verifier may authorize escrow release");
  }
}

function assertEventEnded(input: VerifierGate, now: Date) {
  if (!input.eventEndsAt) {
    throw new HttpError(409, "EVENT_END_REQUIRED", "Set the event end time before confirming completion");
  }
  if (input.eventEndsAt.getTime() > now.getTime()) {
    throw new HttpError(409, "EVENT_IN_PROGRESS", "Escrow remains protected until the event has ended");
  }
}

function assertAllChecksGreen(input: VerifierGate) {
  if (input.checkCount === 0 || input.greenCount !== input.checkCount) {
    throw new HttpError(409, "READINESS_INCOMPLETE", "Every event service check must be GREEN before completion");
  }
}

export function assertEventFinalizationAllowed(input: VerifierGate, now = new Date()) {
  assertAssignedVerifier(input);
  if (input.eventStatus === "CANCELLED") {
    throw new HttpError(409, "INVALID_STATE", "A cancelled event cannot be completed");
  }
  assertEventEnded(input, now);
  assertAllChecksGreen(input);
}

export function assertEscrowReleaseAllowed(input: VerifierGate, now = new Date()) {
  assertAssignedVerifier(input);
  if (input.eventStatus !== "COMPLETED") {
    throw new HttpError(409, "EVENT_NOT_COMPLETED", "The assigned verifier must complete the event before escrow release");
  }
  assertEventEnded(input, now);
  assertAllChecksGreen(input);
}
