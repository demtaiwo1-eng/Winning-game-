import { describe, expect, it } from "vitest";
import { registrationFieldError } from "./registrationValidation";

const signup = { role: "VENDOR", mode: "signup" as const, organizationMode: "" };

describe("registration field validation", () => {
  it("validates required identity fields and the shared password rule", () => {
    expect(registrationFieldError("name", " ", signup)).toContain("at least 2");
    expect(registrationFieldError("name", "Jordan", signup)).toBeNull();
    expect(registrationFieldError("email", "nope", signup)).toContain("valid email");
    expect(registrationFieldError("email", "jordan@example.com", signup)).toBeNull();
    expect(registrationFieldError("password", "abcdefgh", signup)).toBeTruthy();
    expect(registrationFieldError("password", "correct-horse-1!", signup)).toBeNull();
  });

  it("applies vendor fields only where required and validates optional details when entered", () => {
    expect(registrationFieldError("business", "", signup)).toContain("business name");
    expect(registrationFieldError("business", "Northstar", signup)).toBeNull();
    expect(registrationFieldError("business", "", { ...signup, role: "CLIENT" })).toBeNull();
    expect(registrationFieldError("vendorPhone", "123", signup)).toContain("phone number");
    expect(registrationFieldError("vendorKycUrl", "javascript:alert(1)", signup)).toContain("HTTPS");
    expect(registrationFieldError("vendorKycUrl", "https://docs.example.com/id", signup)).toBeNull();
  });

  it("does not require passwords for forgot-password requests", () => {
    expect(registrationFieldError("password", "", { ...signup, mode: "forgot" })).toBeNull();
  });
});
