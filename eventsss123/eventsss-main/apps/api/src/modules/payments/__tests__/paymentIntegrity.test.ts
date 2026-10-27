import { describe, expect, it } from "vitest";
import { HttpError } from "../../../lib/errors";
import {
  assertVerifiedPayment,
  majorAmountToMinor,
} from "../webhookVerification";

describe("payment integrity regression tests", () => {
  const intent = { amountMinor: 125050n, currency: "NGN" };
  const payment = {
    success: true,
    amountMinor: 125050n,
    currency: "NGN",
    reference: "pay_ref_123",
  };

  it("converts supported two-decimal provider amounts exactly", () => {
    expect(majorAmountToMinor("1250.50")).toBe(125050n);
    expect(majorAmountToMinor("1250.5")).toBe(125050n);
    expect(majorAmountToMinor("1250")).toBe(125000n);
    expect(majorAmountToMinor("0.01")).toBe(1n);
  });

  it.each(["", "-1", "1.001", "1e3", "NaN", " 12.00"])(
    "rejects invalid provider amount %j",
    (amount) => {
      expect(() => majorAmountToMinor(amount)).toThrow(HttpError);
    },
  );

  it("accepts an exact verified payment", () => {
    expect(() =>
      assertVerifiedPayment(payment, intent, "pay_ref_123"),
    ).not.toThrow();
  });

  it("rejects a provider that has not confirmed success", () => {
    expect(() =>
      assertVerifiedPayment(
        { ...payment, success: false },
        intent,
        "pay_ref_123",
      ),
    ).toThrow(HttpError);
  });

  it("rejects a mismatched or missing payment reference", () => {
    expect(() =>
      assertVerifiedPayment(
        { ...payment, reference: "another_reference" },
        intent,
        "pay_ref_123",
      ),
    ).toThrow(HttpError);

    expect(() =>
      assertVerifiedPayment(
        { ...payment, reference: undefined },
        intent,
        "pay_ref_123",
      ),
    ).toThrow(HttpError);
  });

  it("rejects an underpayment or overpayment", () => {
    expect(() =>
      assertVerifiedPayment(
        { ...payment, amountMinor: 125049n },
        intent,
        "pay_ref_123",
      ),
    ).toThrow(HttpError);

    expect(() =>
      assertVerifiedPayment(
        { ...payment, amountMinor: 125051n },
        intent,
        "pay_ref_123",
      ),
    ).toThrow(HttpError);
  });

  it("rejects a currency mismatch", () => {
    expect(() =>
      assertVerifiedPayment(
        { ...payment, currency: "USD" },
        intent,
        "pay_ref_123",
      ),
    ).toThrow(HttpError);
  });

  it("compares currency codes without case sensitivity", () => {
    expect(() =>
      assertVerifiedPayment(
        { ...payment, currency: "ngn" },
        intent,
        "pay_ref_123",
      ),
    ).not.toThrow();
  });
});
