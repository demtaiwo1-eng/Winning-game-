import { describe, expect, it } from "vitest";
import { isCompatibleWalletReplay } from "../currencyPolicy";

describe("wallet currency isolation and idempotency", () => {
  const wallet = { userId: "user-1", currency: "NGN" };
  const entry = {
    amountMinor: 12500n,
    type: "DEPOSIT",
    refType: "PAYMENT_INTENT",
    refId: "intent-1",
  };
  const input = {
    userId: "user-1",
    currency: "NGN",
    amountMinor: 12500n,
    type: "DEPOSIT",
    refType: "PAYMENT_INTENT",
    refId: "intent-1",
  };

  it("accepts an exact replay", () => {
    expect(isCompatibleWalletReplay(wallet, entry, input)).toBe(true);
  });

  it.each([
    [{ ...wallet, currency: "GHS" }, entry, input],
    [{ ...wallet, userId: "user-2" }, entry, input],
    [wallet, { ...entry, amountMinor: 12501n }, input],
    [wallet, { ...entry, refId: "intent-2" }, input],
    [wallet, { ...entry, type: "ESCROW_HOLD" }, input],
    [wallet, entry, { ...input, currency: "GHS" }],
    [wallet, entry, { ...input, amountMinor: 12501n }],
  ])("rejects a replay with mismatched wallet or ledger dimensions", (actualWallet, actualEntry, actualInput) => {
    expect(isCompatibleWalletReplay(actualWallet, actualEntry, actualInput)).toBe(false);
  });
});
