import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/env", () => ({
  env: {
    NODE_ENV: "test",
    PAYMENT_MODE: "test",
    FLUTTERWAVE_SECRET_KEY: "FLWSECK_TEST_audit_only",
    PAYSTACK_SECRET_KEY: undefined,
    STRIPE_SECRET_KEY: undefined,
  },
}));

import { verifyFlutterwave } from "../src/modules/payments/providers";

function mockResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function successfulTransaction(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      status: "successful",
      amount: "1250.00",
      currency: "NGN",
      tx_ref: "EPHINTA-AUDIT-REF-123",
      ...overrides,
    },
  };
}

describe("Flutterwave transaction verification hardening", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts a successful provider response with complete details", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(successfulTransaction()),
    );

    const result = await verifyFlutterwave("987654321");

    expect(result.success).toBe(true);
    expect(result.amountMinor).toBe(125000n);
    expect(result.currency).toBe("NGN");
    expect(result.txRef).toBe("EPHINTA-AUDIT-REF-123");
  });

  it("sends the transaction ID to the provider verification endpoint", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      mockResponse(successfulTransaction()),
    );

    await verifyFlutterwave("987654321");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/v3/transactions/987654321/verify",
    );

    const init = fetchMock.mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(
      "Bearer FLWSECK_TEST_audit_only",
    );
  });

  it("never marks a pending transaction as successful", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({
        status: "success",
        data: {
          status: "pending",
          amount: "1250.00",
          currency: "NGN",
          tx_ref: "EPHINTA-AUDIT-REF-123",
        },
      }),
    );

    const result = await verifyFlutterwave("987654321");

    expect(result.success).toBe(false);
    expect(result.amountMinor).toBe(0n);
  });

  it("rejects an unsuccessful provider response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({
        status: "error",
        data: { status: "failed" },
      }),
    );

    const result = await verifyFlutterwave("987654321");

    expect(result.success).toBe(false);
    expect(result.amountMinor).toBe(0n);
  });

  it("rejects a response missing its currency", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(successfulTransaction({ currency: undefined })),
    );

    await expect(verifyFlutterwave("987654321")).rejects.toThrow(
      /missing currency/i,
    );
  });

  it("rejects a response missing its transaction reference", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(successfulTransaction({ tx_ref: undefined })),
    );

    await expect(verifyFlutterwave("987654321")).rejects.toThrow(
      /missing transaction reference/i,
    );
  });

  it("rejects a response missing its amount", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(successfulTransaction({ amount: undefined })),
    );

    await expect(verifyFlutterwave("987654321")).rejects.toThrow(
      /missing amount/i,
    );
  });

  it("rejects an invalid transaction ID without making a request", async () => {
    const fetchMock = vi.mocked(fetch);

    await expect(verifyFlutterwave("../invalid")).rejects.toThrow(
      /transaction id is invalid/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-success HTTP responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({ message: "Unavailable" }, 503),
    );

    await expect(verifyFlutterwave("987654321")).rejects.toThrow(
      /verification failed \(503\)/i,
    );
  });
});
