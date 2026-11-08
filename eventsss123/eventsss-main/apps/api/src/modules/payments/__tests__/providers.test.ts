import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../config/env";
import { initializeOpay, verifyOpay } from "../providers";

const originalMerchantId = env.OPAY_MERCHANT_ID;
const originalPublicKey = env.OPAY_PUBLIC_KEY;
const originalSecretKey = env.OPAY_SECRET_KEY;
const originalPaymentMode = env.PAYMENT_MODE;
const originalNodeEnv = env.NODE_ENV;

describe("verifyOpay", () => {
  beforeEach(() => {
    env.OPAY_MERCHANT_ID = "sandbox-merchant";
    env.OPAY_SECRET_KEY = "sandbox-secret";
  });

  afterEach(() => {
    env.OPAY_MERCHANT_ID = originalMerchantId;
    env.OPAY_PUBLIC_KEY = originalPublicKey;
    env.OPAY_SECRET_KEY = originalSecretKey;
    env.PAYMENT_MODE = originalPaymentMode;
    env.NODE_ENV = originalNodeEnv;
    vi.unstubAllGlobals();
  });

  it("uses the documented Nigeria test endpoint and signs the exact request body", async () => {
    const responseBody = {
      code: "00000",
      message: "SUCCESSFUL",
      data: {
        reference: "ephinta-test-reference",
        status: "SUCCESS",
        isVoided: false,
        amount: { total: 12500, currency: "NGN" },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const requestBody = JSON.stringify({
      country: "NG",
      reference: "ephinta-test-reference",
    });
    const signature = createHmac("sha512", "sandbox-secret")
      .update(requestBody)
      .digest("hex");

    const verified = await verifyOpay("ephinta-test-reference");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://testapi.opaycheckout.com/api/v1/international/cashier/status",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${signature}`,
          MerchantId: "sandbox-merchant",
        }),
        body: requestBody,
      }),
    );
    expect(verified).toMatchObject({
      success: true,
      amountMinor: 12500n,
      currency: "NGN",
      reference: "ephinta-test-reference",
    });
  });
});


describe("initializeOpay", () => {
  beforeEach(() => {
    env.NODE_ENV = "test";
    env.PAYMENT_MODE = "test";
    env.OPAY_MERCHANT_ID = "sandbox-merchant";
    env.OPAY_PUBLIC_KEY = "sandbox-public-key";
    env.OPAY_SECRET_KEY = "sandbox-secret";
  });

  afterEach(() => {
    env.OPAY_MERCHANT_ID = originalMerchantId;
    env.OPAY_PUBLIC_KEY = originalPublicKey;
    env.OPAY_SECRET_KEY = originalSecretKey;
    env.PAYMENT_MODE = originalPaymentMode;
    env.NODE_ENV = originalNodeEnv;
    vi.unstubAllGlobals();
  });

  it("creates a Nigeria cashier payment only against OPay's documented test endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: "00000",
        message: "SUCCESSFUL",
        data: {
          reference: "ephinta-create-reference",
          cashierUrl: "https://sandboxcashier.opaycheckout.com/apiCashier/redirect/payment/checkout?orderToken=test-token",
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await initializeOpay({
      amountMinor: 12500n,
      currency: "NGN",
      reference: "ephinta-create-reference",
      callbackUrl: "https://ephinta.example.test/payment/return",
      notifyUrl: "https://api.ephinta.example.test/api/v1/payments/webhooks/opay",
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://testapi.opaycheckout.com/api/v1/international/cashier/create",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sandbox-public-key",
          MerchantId: "sandbox-merchant",
        }),
      }),
    );
    expect(body).toMatchObject({
      country: "NG",
      reference: "ephinta-create-reference",
      amount: { total: 12500, currency: "NGN" },
      returnUrl: "https://ephinta.example.test/payment/return",
      callbackUrl: "https://api.ephinta.example.test/api/v1/payments/webhooks/opay",
      product: { name: "EPHINTA Wallet Deposit", description: "Wallet funding" },
    });
    expect(result).toMatchObject({
      provider: "opay",
      providerRef: "ephinta-create-reference",
      authorizationUrl: "https://sandboxcashier.opaycheckout.com/apiCashier/redirect/payment/checkout?orderToken=test-token",
      mode: "sandbox",
    });
  });

  it("rejects a cashier redirect outside the approved OPay sandbox host", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: "00000",
        data: {
          reference: "ephinta-create-reference",
          cashierUrl: "https://attacker.example/checkout",
        },
      }), { status: 200 }),
    ));

    await expect(initializeOpay({
      amountMinor: 12500n,
      currency: "NGN",
      reference: "ephinta-create-reference",
      callbackUrl: "https://ephinta.example.test/payment/return",
    })).rejects.toThrow("outside the approved sandbox host");
  });

  it("rejects a response whose reference does not match the requested payment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: "00000",
        data: {
          reference: "another-payment",
          cashierUrl: "https://sandboxcashier.opaycheckout.com/checkout",
        },
      }), { status: 200 }),
    ));

    await expect(initializeOpay({
      amountMinor: 12500n,
      currency: "NGN",
      reference: "ephinta-create-reference",
      callbackUrl: "https://ephinta.example.test/payment/return",
    })).rejects.toThrow("reference does not match");
  });

  it("does not initialize OPay when live payments are selected", async () => {
    env.PAYMENT_MODE = "live";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(initializeOpay({
      amountMinor: 12500n,
      currency: "NGN",
      reference: "ephinta-create-reference",
      callbackUrl: "https://ephinta.example.test/payment/return",
    })).rejects.toThrow("sandbox-only");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
