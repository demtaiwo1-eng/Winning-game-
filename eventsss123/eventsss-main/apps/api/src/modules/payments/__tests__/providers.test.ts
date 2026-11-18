import { createHmac } from "node:crypto";
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("../../../lib/prisma", () => ({ prisma: { platformRuntimeSetting: { findUnique } } }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../config/env";
import { createOpayRefund, initializeOpay, queryOpayRefund, selectProvider, verifyOpay } from "../providers";
import { refreshPaymentMode } from "../runtimePaymentMode";

const originalMerchantId = env.OPAY_MERCHANT_ID;
const originalPublicKey = env.OPAY_PUBLIC_KEY;
const originalSecretKey = env.OPAY_SECRET_KEY;
const originalPaymentMode = env.PAYMENT_MODE;
const originalNodeEnv = env.NODE_ENV;
const originalEphintaEnvironment = env.EPHINTA_ENVIRONMENT;
const originalLiveMerchantId = env.OPAY_LIVE_MERCHANT_ID;
const originalLivePublicKey = env.OPAY_LIVE_PUBLIC_KEY;
const originalLiveSecretKey = env.OPAY_LIVE_SECRET_KEY;
const originalLiveReady = env.OPAY_LIVE_MODE_READY;


describe("Nigerian provider selection", () => {
  const originalPaystack = env.PAYSTACK_SECRET_KEY;
  const originalFlutterwave = env.FLUTTERWAVE_SECRET_KEY;

  beforeEach(async () => {
    env.OPAY_MERCHANT_ID = "merchant";
    env.OPAY_PUBLIC_KEY = "public";
    env.OPAY_SECRET_KEY = "secret";
    env.PAYSTACK_SECRET_KEY = "sk_test_should_not_be_used_for_ngn";
    env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST_should_not_be_used_for_ngn";
    env.PAYMENT_MODE = "test";
    env.NODE_ENV = "test";
    findUnique.mockResolvedValue({ paymentMode: "test" });
    await refreshPaymentMode();
  });

  afterEach(async () => {
    env.PAYSTACK_SECRET_KEY = originalPaystack;
    env.FLUTTERWAVE_SECRET_KEY = originalFlutterwave;
    env.OPAY_MERCHANT_ID = originalMerchantId;
    env.OPAY_PUBLIC_KEY = originalPublicKey;
    env.OPAY_SECRET_KEY = originalSecretKey;
    env.PAYMENT_MODE = originalPaymentMode;
    env.NODE_ENV = originalNodeEnv;
    env.EPHINTA_ENVIRONMENT = originalEphintaEnvironment;
    env.OPAY_LIVE_MERCHANT_ID = originalLiveMerchantId;
    env.OPAY_LIVE_PUBLIC_KEY = originalLivePublicKey;
    env.OPAY_LIVE_SECRET_KEY = originalLiveSecretKey;
    env.OPAY_LIVE_MODE_READY = originalLiveReady;
    findUnique.mockResolvedValue({ paymentMode: "test" });
    await refreshPaymentMode();
  });

  it("selects OPay for every NGN transaction even when other providers are configured", () => {
    expect(selectProvider("NGN", "NG")).toBe("opay");
    expect(selectProvider("NGN", "GH")).toBe("opay");
  });

  it("does not let a legacy Paystack test key block OPay live-mode selection", async () => {
    env.PAYMENT_MODE = "live";
    env.EPHINTA_ENVIRONMENT = "production";
    env.OPAY_LIVE_MERCHANT_ID = "live-merchant";
    env.OPAY_LIVE_PUBLIC_KEY = "live-public";
    env.OPAY_LIVE_SECRET_KEY = "live-secret";
    env.OPAY_LIVE_MODE_READY = "true";
    findUnique.mockResolvedValue({ paymentMode: "live" });
    await refreshPaymentMode();
    env.PAYSTACK_SECRET_KEY = "sk_test_legacy_key";
    expect(selectProvider("NGN", "NG")).toBe("opay");
  });

  it("fails closed instead of falling back to Paystack, Flutterwave or demo when OPay is missing", () => {
    env.OPAY_MERCHANT_ID = undefined;
    expect(() => selectProvider("NGN", "NG")).toThrow(/OPay is the required provider/);
  });

  it("does not silently accept non-NGN currency for a Nigerian customer", () => {
    expect(() => selectProvider("GHS", "NG")).toThrow(/require NGN/);
  });
});

describe("verifyOpay", () => {
  beforeEach(async () => {
    env.PAYMENT_MODE = "test";
    findUnique.mockResolvedValue({ paymentMode: "test" });
    await refreshPaymentMode();
    env.OPAY_MERCHANT_ID = "sandbox-merchant";
    env.OPAY_SECRET_KEY = "sandbox-secret";
    findUnique.mockResolvedValue({ paymentMode: "test" });
    await refreshPaymentMode();
  });

  afterEach(async () => {
    env.OPAY_MERCHANT_ID = originalMerchantId;
    env.OPAY_PUBLIC_KEY = originalPublicKey;
    env.OPAY_SECRET_KEY = originalSecretKey;
    env.PAYMENT_MODE = originalPaymentMode;
    env.NODE_ENV = originalNodeEnv;
    env.EPHINTA_ENVIRONMENT = originalEphintaEnvironment;
    env.OPAY_LIVE_MERCHANT_ID = originalLiveMerchantId;
    env.OPAY_LIVE_PUBLIC_KEY = originalLivePublicKey;
    env.OPAY_LIVE_SECRET_KEY = originalLiveSecretKey;
    env.OPAY_LIVE_MODE_READY = originalLiveReady;
    vi.unstubAllGlobals();
    findUnique.mockResolvedValue({ paymentMode: "test" });
    await refreshPaymentMode();
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
  beforeEach(async () => {
    env.NODE_ENV = "test";
    env.EPHINTA_ENVIRONMENT = "development";
    env.PAYMENT_MODE = "test";
    env.OPAY_MERCHANT_ID = "sandbox-merchant";
    env.OPAY_PUBLIC_KEY = "sandbox-public-key";
    env.OPAY_SECRET_KEY = "sandbox-secret";
    findUnique.mockResolvedValue({ paymentMode: "test" });
    await refreshPaymentMode();
  });

  afterEach(async () => {
    env.OPAY_MERCHANT_ID = originalMerchantId;
    env.OPAY_PUBLIC_KEY = originalPublicKey;
    env.OPAY_SECRET_KEY = originalSecretKey;
    env.PAYMENT_MODE = originalPaymentMode;
    env.NODE_ENV = originalNodeEnv;
    env.EPHINTA_ENVIRONMENT = originalEphintaEnvironment;
    env.OPAY_LIVE_MERCHANT_ID = originalLiveMerchantId;
    env.OPAY_LIVE_PUBLIC_KEY = originalLivePublicKey;
    env.OPAY_LIVE_SECRET_KEY = originalLiveSecretKey;
    env.OPAY_LIVE_MODE_READY = originalLiveReady;
    vi.unstubAllGlobals();
    findUnique.mockResolvedValue({ paymentMode: "test" });
    await refreshPaymentMode();
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

  it("uses the OPay production endpoint only in live mode and validates the production cashier host", async () => {
    env.EPHINTA_ENVIRONMENT = "production";
    env.PAYMENT_MODE = "live";
    env.OPAY_LIVE_MODE_READY = "true";
    env.OPAY_LIVE_MERCHANT_ID = "live-merchant";
    env.OPAY_LIVE_PUBLIC_KEY = "live-public";
    env.OPAY_LIVE_SECRET_KEY = "live-secret";
    findUnique.mockResolvedValue({ paymentMode: "live" });
    await refreshPaymentMode();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "00000",
      data: {
        reference: "ephinta-live-reference",
        cashierUrl: "https://cashier.opaycheckout.com/apiCashier/redirect/payment/checkout?orderToken=live-token",
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await initializeOpay({
      amountMinor: 12500n,
      currency: "NGN",
      reference: "ephinta-live-reference",
      callbackUrl: "https://ephinta.example.test/payment/return",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://liveapi.opaycheckout.com/api/v1/international/cashier/create",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toMatchObject({ provider: "opay", mode: "live" });
  });
});


describe("OPay cashier refunds", () => {
  beforeEach(async () => {
    env.NODE_ENV = "test";
    env.PAYMENT_MODE = "test";
    env.OPAY_MERCHANT_ID = "sandbox-merchant";
    env.OPAY_SECRET_KEY = "sandbox-secret";
    findUnique.mockResolvedValue({ paymentMode: "test" });
    await refreshPaymentMode();
  });

  afterEach(async () => {
    env.OPAY_MERCHANT_ID = originalMerchantId;
    env.OPAY_SECRET_KEY = originalSecretKey;
    env.PAYMENT_MODE = originalPaymentMode;
    env.NODE_ENV = originalNodeEnv;
    vi.unstubAllGlobals();
    findUnique.mockResolvedValue({ paymentMode: "test" });
    await refreshPaymentMode();
  });

  it("creates a refund with the documented sandbox endpoint and exact HMAC-signed body", async () => {
    const responseBody = {
      code: "00000",
      message: "SUCCESSFUL",
      data: {
        reference: "refund-001",
        originalReference: "payment-001",
        orderNo: "opay-refund-order-001",
        originalOrderNo: "opay-payment-order-001",
        refundAmount: { total: 2500, currency: "NGN" },
        orderStatus: "PENDING",
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpayRefund({
      amountMinor: 2500n,
      originalReference: "payment-001",
      reference: "refund-001",
      callbackUrl: "https://api.ephinta.example.test/api/v1/payments/webhooks/opay-refund",
      refundWay: "Original",
      refundReason: "Customer cancellation",
    });

    const requestBody = JSON.stringify({
      amount: { currency: "NGN", total: 2500 },
      callbackUrl: "https://api.ephinta.example.test/api/v1/payments/webhooks/opay-refund",
      country: "NG",
      originalReference: "payment-001",
      reference: "refund-001",
      refundWay: "Original",
      refundReason: "Customer cancellation",
    });
    const signature = createHmac("sha512", "sandbox-secret").update(requestBody).digest("hex");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://testapi.opaycheckout.com/api/v1/international/payment/refund/create",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer " + signature,
          MerchantId: "sandbox-merchant",
        }),
        body: requestBody,
      }),
    );
    expect(result).toMatchObject({
      reference: "refund-001",
      originalReference: "payment-001",
      status: "PENDING",
      amountMinor: 2500n,
      currency: "NGN",
    });
  });

  it("queries refund status using the documented endpoint and validates original payment and amount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "00000",
      data: {
        reference: "refund-002",
        originalReference: "payment-002",
        refundAmount: { total: 4000, currency: "NGN" },
        orderStatus: "SUCCESS",
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await queryOpayRefund({
      reference: "refund-002",
      originalReference: "payment-002",
      amountMinor: 4000n,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://testapi.opaycheckout.com/api/v1/international/payment/refund/query",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.status).toBe("SUCCESS");
    expect(result.amountMinor).toBe(4000n);
  });

  it("rejects a refund response for a different original payment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "00000",
      data: {
        reference: "refund-003",
        originalReference: "some-other-payment",
        refundAmount: { total: 1000, currency: "NGN" },
        orderStatus: "SUCCESS",
      },
    }), { status: 200 })));

    await expect(createOpayRefund({
      amountMinor: 1000n,
      originalReference: "payment-003",
      reference: "refund-003",
      callbackUrl: "https://api.ephinta.example.test/refunds/callback",
      refundWay: "Original",
    })).rejects.toThrow("original reference does not match");
  });

  it("rejects bank-account refund requests without receiver details before contacting OPay", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createOpayRefund({
      amountMinor: 1000n,
      originalReference: "payment-004",
      reference: "refund-004",
      callbackUrl: "https://api.ephinta.example.test/refunds/callback",
      refundWay: "BankAccount",
    })).rejects.toThrow("require receiver bank code and account number");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
