import { describe, expect, it } from "vitest";
import {
  canAssignReadinessVerifier,
  canManageReadinessZones,
  canReadReadinessEvent,
} from "../src/modules/readiness/accessPolicy";

describe("readiness event access policy", () => {
  it("allows the event owner, admins, and consultants to read event readiness", () => {
    expect(canReadReadinessEvent({
      ownerId: "owner", userId: "owner", role: "CLIENT", assignedVerifier: false,
    })).toBe(true);
    for (const role of ["ADMIN", "CONSULTANT"]) {
      expect(canReadReadinessEvent({
        ownerId: "owner", userId: "staff", role, assignedVerifier: false,
      })).toBe(true);
    }
  });

  it("allows only verifiers assigned to the event to read verifier-scoped event data", () => {
    expect(canReadReadinessEvent({
      ownerId: "owner", userId: "verifier-1", role: "VERIFIER", assignedVerifier: true,
    })).toBe(true);
    expect(canReadReadinessEvent({
      ownerId: "owner", userId: "verifier-2", role: "VERIFIER", assignedVerifier: false,
    })).toBe(false);
    expect(canReadReadinessEvent({
      ownerId: "owner", userId: "other-client", role: "CLIENT", assignedVerifier: false,
    })).toBe(false);
  });

  it("restricts check-zone changes to the event owner, admin, or consultant", () => {
    expect(canManageReadinessZones({ ownerId: "owner", userId: "owner", role: "CLIENT" })).toBe(true);
    expect(canManageReadinessZones({ ownerId: "owner", userId: "admin", role: "ADMIN" })).toBe(true);
    expect(canManageReadinessZones({ ownerId: "owner", userId: "consultant", role: "CONSULTANT" })).toBe(true);
    expect(canManageReadinessZones({ ownerId: "owner", userId: "verifier", role: "VERIFIER" })).toBe(false);
    expect(canManageReadinessZones({ ownerId: "owner", userId: "other", role: "CLIENT" })).toBe(false);
  });

  it("allows verifier self-assignment but prevents a verifier assigning another account", () => {
    expect(canAssignReadinessVerifier({
      ownerId: "owner", userId: "verifier", targetVerifierId: "verifier", role: "VERIFIER",
    })).toBe(true);
    expect(canAssignReadinessVerifier({
      ownerId: "owner", userId: "verifier", targetVerifierId: "other-verifier", role: "VERIFIER",
    })).toBe(false);
    expect(canAssignReadinessVerifier({
      ownerId: "owner", userId: "owner", targetVerifierId: "verifier", role: "CLIENT",
    })).toBe(true);
    expect(canAssignReadinessVerifier({
      ownerId: "owner", userId: "other", targetVerifierId: "other", role: "CLIENT",
    })).toBe(false);
  });
});
