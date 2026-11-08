import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../config/env";
import { verifyOpay } from "../providers";

const originalMerchantId = env.OPAY_MERCHANT_ID;
const originalSecretKey = env.OPAY_SECRET_KEY;

describe("verifyOpay", () => {
  beforeEach(() => {
    env.OPAY_MERCHANT_ID = "sandbox-merchant";
    env.OPAY_SECRET_KEY = "sandbox-secret";
  });

  afterEach(() => {
    env.OPAY_MERCHANT_ID = originalMerchantId;
    env.OPAY_SECRET_KEY = originalSecretKey;
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
