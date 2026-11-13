import { createHmac } from "node:crypto";
import { env } from "../../config/env";
import { HttpError } from "../../lib/errors";
import { getRuntimePaymentMode } from "./runtimePaymentMode";

type OpayEnvelope<T> = { code?: string; message?: string; data?: T };

function opayCredentials() {
  if (getRuntimePaymentMode() === "live") {
    return { merchantId: env.OPAY_LIVE_MERCHANT_ID, publicKey: env.OPAY_LIVE_PUBLIC_KEY, secretKey: env.OPAY_LIVE_SECRET_KEY };
  }
  return {
    merchantId: env.OPAY_TEST_MERCHANT_ID || env.OPAY_MERCHANT_ID,
    publicKey: env.OPAY_TEST_PUBLIC_KEY || env.OPAY_PUBLIC_KEY,
    secretKey: env.OPAY_TEST_SECRET_KEY || env.OPAY_SECRET_KEY,
  };
}
export type OpayBank = { name?: string; code?: string };
export type OpayTransfer = {
  reference?: string;
  orderNo?: string;
  amount?: string | number;
  currency?: string;
  status?: string;
  failureReason?: string;
  bankCode?: string;
  bankAccountNumber?: string;
};

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, sortKeys(item)]));
}

export function assertOpayTransfersEnabled() {
  const credentials = opayCredentials();
  if (getRuntimePaymentMode() === "demo") throw new HttpError(409, "PAYOUTS_DISABLED_IN_DEMO", "External bank withdrawals are disabled in DEMO mode.");
  if (getRuntimePaymentMode() === "live" && (env.EPHINTA_ENVIRONMENT !== "production" || env.OPAY_LIVE_MODE_READY !== "true")) throw new HttpError(503, "OPAY_LIVE_NOT_ATTESTED", "OPay live credentials and merchant access have not been verified.");
  if (env.OPAY_TRANSFERS_ENABLED !== "true") {
    throw new HttpError(503, "PAYOUTS_DISABLED", "OPay bank transfers are not enabled for this merchant account yet.");
  }
  if (!credentials.merchantId || !credentials.publicKey || !credentials.secretKey) {
    throw new HttpError(503, "PAYOUT_PROVIDER_NOT_CONFIGURED", "OPay merchant transfer credentials are not configured.");
  }
  if (env.NODE_ENV === "production" && getRuntimePaymentMode() === "test" && env.ALLOW_PRODUCTION_TEST_MODE !== "true") {
    throw new HttpError(503, "PRODUCTION_TEST_MODE_DISABLED", "Sandbox withdrawals on the production API require ALLOW_PRODUCTION_TEST_MODE=true.");
  }
}

function baseUrl() {
  const expectedHost = getRuntimePaymentMode() === "test"
    ? "sandbox-cashierapi.opayweb.com"
    : "cashierapi.opayweb.com";
  const configured = getRuntimePaymentMode() === "live"
    ? env.OPAY_LIVE_TRANSFER_BASE_URL
    : env.OPAY_TEST_TRANSFER_BASE_URL || env.OPAY_TRANSFER_BASE_URL;
  const endpoint = configured || `https://${expectedHost}`;
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new HttpError(503, "OPAY_TRANSFER_URL_INVALID", "The OPay transfer endpoint URL is invalid.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== expectedHost ||
    parsed.username || parsed.password || parsed.port ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new HttpError(503, "OPAY_TRANSFER_URL_INVALID", "The OPay transfer endpoint must use the official HTTPS host for the selected payment mode.");
  }
  return `https://${expectedHost}`;
}

async function request<T>(path: string, payload: Record<string, unknown>, auth: "public" | "signature"): Promise<OpayEnvelope<T>> {
  assertOpayTransfersEnabled();
  const body = JSON.stringify(sortKeys(payload));
  const credentials = opayCredentials();
  const token = auth === "public"
    ? credentials.publicKey!
    : createHmac("sha512", credentials.secretKey!).update(body).digest("hex");
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      MerchantId: credentials.merchantId!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => ({})) as OpayEnvelope<T>;
  if (!response.ok || result.code !== "00000") {
    const providerCode = String(result.code || "");
    const errorCode = ["00005", "02004", "20000"].includes(providerCode)
      ? "OPAY_PAYOUT_DUPLICATE_REFERENCE"
      : ["00004", "02000", "02001", "02002", "02003", "02007", "C1004", "C1009", "C_1111"].includes(providerCode)
        ? "OPAY_PAYOUT_PROVIDER_REJECTED"
        : "OPAY_PAYOUT_PROVIDER_ERROR";
    throw new HttpError(502, errorCode, result.message || "OPay transfer request failed.");
  }
  return result;
}

export async function opayListBanks() {
  const result = await request<OpayBank[]>("/api/v3/banks", { countryCode: "NG" }, "public");
  return (Array.isArray(result.data) ? result.data : [])
    .filter((bank) => bank.name && bank.code)
    .map((bank) => ({ name: String(bank.name), code: String(bank.code), currency: "NGN" as const }));
}

export async function opayResolveBankAccount(accountNumber: string, bankCode: string) {
  const result = await request<{ accountNo?: string; accountName?: string }>(
    "/api/v3/verification/accountNumber/resolve",
    { countryCode: "NG", bankCode, bankAccountNo: accountNumber },
    "public",
  );
  const accountName = String(result.data?.accountName || "").trim();
  const resolvedNumber = String(result.data?.accountNo || "");
  if (!accountName || (resolvedNumber && resolvedNumber !== accountNumber)) {
    throw new HttpError(422, "ACCOUNT_NOT_RESOLVED", "OPay could not verify this bank account.");
  }
  return { accountName, accountNumber: maskAccount(accountNumber), bankCode };
}

export async function opayCreateBankTransfer(input: {
  reference: string;
  amountMinor: bigint;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  reason: string;
}) {
  const amount = input.amountMinor.toString();
  const result = await request<OpayTransfer>("/api/v3/transfer/toBank", {
    amount,
    country: "NG",
    currency: "NGN",
    reason: input.reason,
    receiver: {
      bankCode: input.bankCode,
      bankAccountNumber: input.accountNumber,
      name: input.accountName,
    },
    reference: input.reference,
  }, "signature");
  const transfer = result.data;
  if (!transfer?.orderNo || transfer.reference !== input.reference ||
      (transfer.currency && transfer.currency.toUpperCase() !== "NGN") ||
      (transfer.amount !== undefined && BigInt(String(transfer.amount)) !== input.amountMinor)) {
    throw new HttpError(502, "OPAY_PAYOUT_RESPONSE_MISMATCH", "OPay's transfer response did not match the submitted withdrawal.");
  }
  return transfer;
}

export async function opayGetBankTransferStatus(reference: string, orderNo?: string) {
  const result = await request<OpayTransfer>("/api/v3/transfer/status/toBank", {
    orderNo: orderNo || "",
    reference,
  }, "signature");
  const transfer = result.data;
  if (!transfer || (transfer.reference && transfer.reference !== reference) ||
      (orderNo && transfer.orderNo && transfer.orderNo !== orderNo)) {
    throw new HttpError(502, "OPAY_PAYOUT_STATUS_MISMATCH", "OPay's transfer status did not match this withdrawal.");
  }
  return transfer;
}

export function normalizeOpayTransferStatus(status: string | undefined): "success" | "failed" | "reversed" | "processing" {
  const normalized = String(status || "").toUpperCase();
  if (["SUCCESS", "SUCCEEDED", "COMPLETED"].includes(normalized)) return "success";
  if (["FAIL", "FAILED", "REJECTED", "CANCELLED", "CANCEL", "CLOSE"].includes(normalized)) return "failed";
  if (["REVERSED", "REVERSAL"].includes(normalized)) return "reversed";
  return "processing";
}

export function maskAccount(accountNumber: string) {
  return `${"*".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}
