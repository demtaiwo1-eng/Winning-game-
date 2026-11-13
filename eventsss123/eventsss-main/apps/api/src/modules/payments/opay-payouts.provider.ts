import { createHmac } from "node:crypto";
import { env } from "../../config/env";
import { HttpError } from "../../lib/errors";

type OpayEnvelope<T> = { code?: string; message?: string; data?: T };
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

function assertOpayTransfers() {
  if (env.OPAY_TRANSFERS_ENABLED !== "true") {
    throw new HttpError(503, "PAYOUTS_DISABLED", "OPay bank transfers are not enabled for this merchant account yet.");
  }
  if (!env.OPAY_MERCHANT_ID || !env.OPAY_PUBLIC_KEY || !env.OPAY_SECRET_KEY) {
    throw new HttpError(503, "PAYOUT_PROVIDER_NOT_CONFIGURED", "OPay merchant transfer credentials are not configured.");
  }
  if (env.PAYMENT_MODE === "test" && !env.OPAY_TRANSFER_BASE_URL?.includes("sandbox-cashierapi.opayweb.com") && env.OPAY_TRANSFER_BASE_URL) {
    throw new HttpError(503, "PAYOUT_KEY_MODE_MISMATCH", "OPay test mode must use the OPay sandbox transfer endpoint.");
  }
  if (env.PAYMENT_MODE === "live" && env.OPAY_TRANSFER_BASE_URL?.includes("sandbox-cashierapi.opayweb.com")) {
    throw new HttpError(503, "PAYOUT_KEY_MODE_MISMATCH", "OPay live mode cannot use the sandbox transfer endpoint.");
  }
  if (env.NODE_ENV === "production" && env.PAYMENT_MODE === "test" && env.ALLOW_PRODUCTION_TEST_MODE !== "true") {
    throw new HttpError(503, "PRODUCTION_TEST_MODE_DISABLED", "Sandbox withdrawals on the production API require ALLOW_PRODUCTION_TEST_MODE=true.");
  }
}

function baseUrl() {
  return (env.OPAY_TRANSFER_BASE_URL || (env.PAYMENT_MODE === "test"
    ? "https://sandbox-cashierapi.opayweb.com"
    : "https://cashierapi.opayweb.com")).replace(/\/$/, "");
}

async function request<T>(path: string, payload: Record<string, unknown>, auth: "public" | "signature"): Promise<OpayEnvelope<T>> {
  assertOpayTransfers();
  const body = JSON.stringify(sortKeys(payload));
  const token = auth === "public"
    ? env.OPAY_PUBLIC_KEY!
    : createHmac("sha512", env.OPAY_SECRET_KEY!).update(body).digest("hex");
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      MerchantId: env.OPAY_MERCHANT_ID!,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => ({})) as OpayEnvelope<T>;
  if (!response.ok || result.code !== "00000") {
    throw new HttpError(502, "OPAY_PAYOUT_PROVIDER_ERROR", result.message || `OPay transfer request failed (${response.status}).`);
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

export async function opayGetBankTransferStatus(reference: string, orderNo: string) {
  const result = await request<OpayTransfer>("/api/v3/transfer/status/toBank", {
    orderNo,
    reference,
  }, "signature");
  const transfer = result.data;
  if (!transfer || (transfer.reference && transfer.reference !== reference) ||
      (transfer.orderNo && transfer.orderNo !== orderNo)) {
    throw new HttpError(502, "OPAY_PAYOUT_STATUS_MISMATCH", "OPay's transfer status did not match this withdrawal.");
  }
  return transfer;
}

export function normalizeOpayTransferStatus(status: string | undefined): "success" | "failed" | "reversed" | "processing" {
  const normalized = String(status || "").toUpperCase();
  if (["SUCCESS", "SUCCEEDED", "COMPLETED"].includes(normalized)) return "success";
  if (["FAIL", "FAILED", "REJECTED", "CANCELLED"].includes(normalized)) return "failed";
  if (["REVERSED", "REVERSAL"].includes(normalized)) return "reversed";
  return "processing";
}

export function maskAccount(accountNumber: string) {
  return `${"*".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}
