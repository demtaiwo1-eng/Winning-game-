import { describe, expect, it } from "vitest";
import { commissionMinor, splitPayment, toMinor } from "../src/lib/money";

describe("money", () => {
  it("computes commission with half-up rounding", () => {
    expect(commissionMinor(10000n, 500)).toBe(500n);
    expect(commissionMinor(10000n, 1000)).toBe(1000n);
    expect(commissionMinor(1n, 1000)).toBe(0n);
    expect(commissionMinor(5n, 1000)).toBe(1n);
  });
  it("split always sums to the amount", () => {
    for (const a of [1n, 99n, 12345n, 987654321n]) {
      const { fee, vendorNet } = splitPayment(a, 500);
      expect(fee + vendorNet).toBe(a);
    }
  });
  it("parses decimal strings without floats", () => {
    expect(toMinor("12.5")).toBe(1250n);
    expect(toMinor("100")).toBe(10000n);
    expect(() => toMinor("1.234")).toThrow();
    expect(() => toMinor("-5")).toThrow();
  });
});
