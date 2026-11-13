import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("../../lib/prisma", () => ({
  prisma: { platformRuntimeSetting: { findUnique } },
}));

import { getRuntimePaymentMode, refreshPaymentMode } from "./runtimePaymentMode";

describe("central payment mode", () => {
  beforeEach(() => findUnique.mockReset());

  it("starts in test mode", () => {
    expect(getRuntimePaymentMode()).toBe("test");
  });

  it.each(["demo", "test", "live"] as const)("loads %s from the shared setting", async (mode) => {
    findUnique.mockResolvedValue({ paymentMode: mode });
    await expect(refreshPaymentMode()).resolves.toBe(mode);
    expect(getRuntimePaymentMode()).toBe(mode);
  });

  it("rejects missing or invalid central settings", async () => {
    findUnique.mockResolvedValue({ paymentMode: "unknown" });
    await expect(refreshPaymentMode()).rejects.toThrow("missing or invalid");
  });
});
