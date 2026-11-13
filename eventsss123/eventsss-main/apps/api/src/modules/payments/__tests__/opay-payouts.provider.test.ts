import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../config/env";
import {
  normalizeOpayTransferStatus,
  opayCreateBankTransfer,
  opayGetBankTransferStatus,
  opayListBanks,
  opayResolveBankAccount,
} from "../opay-payouts.provider";

const originals = {
  merchant: env.OPAY_MERCHANT_ID,
  publicKey: env.OPAY_PUBLIC_KEY,
  secret: env.OPAY_SECRET_KEY,
  enabled: env.OPAY_TRANSFERS_ENABLED,
  base: env.OPAY_TRANSFER_BASE_URL,
  mode: env.PAYMENT_MODE,
  node: env.NODE_ENV,
  allowTest: env.ALLOW_PRODUCTION_TEST_MODE,
};

beforeEach(() => {
  env.OPAY_MERCHANT_ID = "sandbox-merchant";
  env.OPAY_PUBLIC_KEY = "sandbox-public";
  env.OPAY_SECRET_KEY = "sandbox-private";
  env.OPAY_TRANSFERS_ENABLED = "true";
  env.OPAY_TRANSFER_BASE_URL = "https://sandbox-cashierapi.opayweb.com";
  env.PAYMENT_MODE = "test";
  env.NODE_ENV = "test";
  env.ALLOW_PRODUCTION_TEST_MODE = "false";
});

afterEach(() => {
  env.OPAY_MERCHANT_ID = originals.merchant;
  env.OPAY_PUBLIC_KEY = originals.publicKey;
  env.OPAY_SECRET_KEY = originals.secret;
  env.OPAY_TRANSFERS_ENABLED = originals.enabled;
  env.OPAY_TRANSFER_BASE_URL = originals.base;
  env.PAYMENT_MODE = originals.mode;
  env.NODE_ENV = originals.node;
  env.ALLOW_PRODUCTION_TEST_MODE = originals.allowTest;
  vi.unstubAllGlobals();
});

describe("OPay merchant bank transfers", () => {
  it("lists Nigerian banks using the merchant public key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "00000", data: [{ name: "Example Bank", code: "058" }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(opayListBanks()).resolves.toEqual([{ name: "Example Bank", code: "058", currency: "NGN" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox-cashierapi.opayweb.com/api/v3/banks",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer sandbox-public", MerchantId: "sandbox-merchant" }),
        body: JSON.stringify({ countryCode: "NG" }),
      }),
    );
  });

  it("resolves bank account names using OPay's account verification endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "00000", data: { accountNo: "0123456789", accountName: "Verified Vendor" },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(opayResolveBankAccount("0123456789", "058")).resolves.toEqual({
      accountName: "Verified Vendor", accountNumber: "******6789", bankCode: "058",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v3/verification/accountNumber/resolve");
  });

  it("signs the exact sorted OPay bank transfer body with HMAC-SHA512", async () => {
    const response = { code: "00000", data: {
      reference: "ephinta-withdrawal-1", orderNo: "opay-order-1",
      amount: "98000", currency: "NGN", status: "PENDING",
    } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const transfer = await opayCreateBankTransfer({
      reference: "ephinta-withdrawal-1", amountMinor: 98000n,
      accountNumber: "0123456789", bankCode: "058", accountName: "Verified Vendor",
      reason: "EPHINTA vendor wallet withdrawal",
    });
    const body = JSON.stringify({
      amount: "98000", country: "NG", currency: "NGN",
      reason: "EPHINTA vendor wallet withdrawal",
      receiver: { bankAccountNumber: "0123456789", bankCode: "058", name: "Verified Vendor" },
      reference: "ephinta-withdrawal-1",
    });
    const signature = createHmac("sha512", "sandbox-private").update(body).digest("hex");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox-cashierapi.opayweb.com/api/v3/transfer/toBank",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${signature}`, MerchantId: "sandbox-merchant" }),
        body,
      }),
    );
    expect(transfer.orderNo).toBe("opay-order-1");
  });

  it("queries transfer status by OPay order number and merchant reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: "00000", data: { reference: "ref-1", orderNo: "order-1", status: "SUCCESS" },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(opayGetBankTransferStatus("ref-1", "order-1")).resolves.toMatchObject({ status: "SUCCESS" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v3/transfer/status/toBank");
  });

  it("refuses transfers unless merchant transfer access is explicitly enabled", async () => {
    env.OPAY_TRANSFERS_ENABLED = "false";
    await expect(opayListBanks()).rejects.toMatchObject({ code: "PAYOUTS_DISABLED" });
  });

  it("rejects non-OPay transfer hosts before sending credentials", async () => {
    env.OPAY_TRANSFER_BASE_URL = "https://sandbox-cashierapi.opayweb.com.attacker.example";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(opayListBanks()).rejects.toMatchObject({ code: "OPAY_TRANSFER_URL_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("classifies duplicate OPay references as ambiguous, not safe-to-refund failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "02004", message: "Duplicate reference" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(opayCreateBankTransfer({
      reference: "already-submitted", amountMinor: 10000n, accountNumber: "0123456789",
      bankCode: "058", accountName: "Verified Vendor", reason: "EPHINTA vendor wallet withdrawal",
    })).rejects.toMatchObject({ code: "OPAY_PAYOUT_DUPLICATE_REFERENCE" });
  });

  it("treats OPay CLOSE and CANCEL as final failed transfers", () => {
    expect(normalizeOpayTransferStatus("CLOSE")).toBe("failed");
    expect(normalizeOpayTransferStatus("CANCEL")).toBe("failed");
  });

  it("classifies explicit OPay request rejection separately from transient errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "00004", message: "Invalid request parameters" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(opayCreateBankTransfer({
      reference: "invalid-request", amountMinor: 10000n, accountNumber: "0123456789",
      bankCode: "058", accountName: "Verified Vendor", reason: "EPHINTA vendor wallet withdrawal",
    })).rejects.toMatchObject({ code: "OPAY_PAYOUT_PROVIDER_REJECTED" });
  });
});
