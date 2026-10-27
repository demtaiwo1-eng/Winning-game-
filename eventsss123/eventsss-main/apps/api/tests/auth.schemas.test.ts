import { describe, expect, it } from "vitest";
import { registerSchema, resetPasswordSchema } from "../src/modules/auth/auth.schemas";

const validRegistration = {
  email: "planner@example.com",
  password: "1234567!",
  name: "Event Planner",
};

describe("shared password policy", () => {
  it("accepts eight characters with a special character without imposing other character classes", () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
    expect(registerSchema.safeParse({ ...validRegistration, password: "abcdefgh!" }).success).toBe(true);
  });

  it("rejects passwords that are too short or lack a special character", () => {
    expect(registerSchema.safeParse({ ...validRegistration, password: "123456!" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegistration, password: "12345678" }).success).toBe(false);
  });

  it("applies the same rule when resetting a password", () => {
    const input = { token: "a".repeat(32), password: "1234567!" };
    expect(resetPasswordSchema.safeParse(input).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ ...input, password: "12345678" }).success).toBe(false);
  });
});

describe("organization registration modes", () => {
  it("requires a selected mode for organization accounts", () => {
    expect(registerSchema.safeParse({ ...validRegistration, role: "ORGANIZATION" }).success).toBe(false);
    expect(
      registerSchema.safeParse({
        ...validRegistration,
        role: "ORGANIZATION",
        organizationMode: "EVENT_PLANNING",
      }).success,
    ).toBe(true);
  });

  it("requires business details for provider-mode organizations", () => {
    const registration = {
      ...validRegistration,
      role: "ORGANIZATION",
      organizationMode: "SERVICE_PROVIDER",
    };
    expect(registerSchema.safeParse(registration).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, businessName: "Northstar Events" }).success).toBe(true);
  });

  it("rejects organization mode on other account types", () => {
    expect(
      registerSchema.safeParse({
        ...validRegistration,
        organizationMode: "EVENT_PLANNING",
      }).success,
    ).toBe(false);
  });
});
