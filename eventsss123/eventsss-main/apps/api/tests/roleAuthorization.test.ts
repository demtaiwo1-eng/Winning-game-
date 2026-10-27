import { describe, expect, it } from "vitest";
import { hasRole } from "../src/middleware/auth";

describe("organization mode authorization", () => {
  it("grants event-planning roles only to planning-mode organizations", () => {
    const user = { id: "org-user", role: "ORGANIZATION" as const, organizationMode: "EVENT_PLANNING" as const };
    expect(hasRole(user, "CLIENT")).toBe(true);
    expect(hasRole(user, "VENDOR")).toBe(false);
  });

  it("grants vendor roles only to provider-mode organizations", () => {
    const user = { id: "org-user", role: "ORGANIZATION" as const, organizationMode: "SERVICE_PROVIDER" as const };
    expect(hasRole(user, "VENDOR")).toBe(true);
    expect(hasRole(user, "CLIENT")).toBe(false);
  });
});
