import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";
import { HttpError } from "./errors";

type BytidEnvelope<T> = { success: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } };

function configuredKey() {
  const apiKey = env.BYTID_API_KEY?.trim();
  if (!apiKey) throw new HttpError(503, "KYC_PROVIDER_NOT_CONFIGURED", "Identity verification is not configured yet.");
  if (!apiKey.startsWith("uvk_test_") && !apiKey.startsWith("uvk_live_")) {
    throw new HttpError(503, "KYC_PROVIDER_MISCONFIGURED", "Identity verification is temporarily unavailable.");
  }
  if (apiKey.startsWith("uvk_live_") && env.BYTID_ALLOW_LIVE !== "true") {
    throw new HttpError(503, "KYC_LIVE_DISABLED", "Live identity checks are disabled until the owner explicitly enables paid verification.");
  }
  return apiKey;
}

function apiUrl(path: string) {
  const base = new URL(env.BYTID_API_URL);
  if (base.protocol !== "https:" && base.hostname !== "localhost") {
    throw new HttpError(503, "KYC_PROVIDER_MISCONFIGURED", "Identity verification endpoint must use HTTPS.");
  }
  base.pathname = base.pathname.replace(new RegExp("/+$"), "") + "/" + path.replace(new RegExp("^/+"), "");
  base.search = "";
  return base;
}

export async function bytidRequest<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const apiKey = configuredKey();
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError(502, "KYC_PROVIDER_UNAVAILABLE", "Identity verification is temporarily unavailable. Please try again.");
  }
  let envelope: BytidEnvelope<T>;
  try {
    envelope = await response.json() as BytidEnvelope<T>;
  } catch {
    throw new HttpError(502, "KYC_PROVIDER_INVALID_RESPONSE", "Identity verification returned an invalid response.");
  }
  if (!response.ok || envelope.success !== true || envelope.data === undefined) {
    const code = envelope.error?.code || "provider_error";
    const message = envelope.error?.message || "The identity provider could not complete this request.";
    throw new HttpError(response.status >= 400 && response.status < 500 ? 400 : 502, "KYC_PROVIDER_REJECTED", `${message} (${code})`);
  }
  return envelope.data;
}

export function verifyBytidWebhook(rawBody: Buffer | undefined, signatureHeader: string | undefined) {
  const secret = env.BYTID_WEBHOOK_SECRET?.trim();
  if (!secret || !rawBody || !signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator > 0 ? [part.slice(0, separator).trim(), part.slice(separator + 1).trim()] : ["", ""];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !Number.isSafeInteger(Number(timestamp)) || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

export function bytidLiveIsAllowed() {
  return Boolean(env.BYTID_API_KEY?.startsWith("uvk_live_") && env.BYTID_ALLOW_LIVE === "true");
}
