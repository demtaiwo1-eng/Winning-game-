import { describe, expect, it } from "vitest";
import { checkPassword, PASSWORD_HELPER } from "./passwordRule";

describe("password rule", () => {
  it("matches the exact registration requirement", () => {
    expect(PASSWORD_HELPER).toBe("At least 8 characters, including a special character.");
    expect(checkPassword("1234567!").ok).toBe(true);
    expect(checkPassword("abcdefgh!").ok).toBe(true);
  });

  it("fails until both required checks pass", () => {
    expect(checkPassword("123456!").ok).toBe(false);
    expect(checkPassword("12345678").ok).toBe(false);
  });
});
