import { describe, expect, it } from "vitest";
import {
  reconciliationBackoffMs,
  reconciliationErrorCode,
  RECONCILIATION_MAX_ATTEMPTS,
} from "../reconciliationPolicy";

describe("durable reconciliation retry policy", () => {
  it("uses bounded exponential backoff", () => {
    expect(reconciliationBackoffMs(1)).toBe(60_000);
    expect(reconciliationBackoffMs(2)).toBe(120_000);
    expect(reconciliationBackoffMs(3)).toBe(240_000);
    expect(reconciliationBackoffMs(8)).toBe(128 * 60_000);
    expect(reconciliationBackoffMs(10)).toBe(6 * 60 * 60_000); // capped at six hours
    expect(reconciliationBackoffMs(99)).toBe(6 * 60 * 60_000);
  });

  it("uses a finite positive attempt ceiling", () => {
    expect(RECONCILIATION_MAX_ATTEMPTS).toBe(8);
  });

  it("stores only error categories, never raw provider messages", () => {
    const error = new Error("Authorization: Bearer very-secret-provider-token");
    expect(reconciliationErrorCode(error)).toBe("Error");
    expect(reconciliationErrorCode("provider payload")).toBe("UnknownError");
  });
});
