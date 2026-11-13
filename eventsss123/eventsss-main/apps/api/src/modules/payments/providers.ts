/**
 * Live payment provider adapters.
 * When secret keys are set in env, real initialize/verify is used.
 * Otherwise demo mode returns local checkout URLs.
 */
import { createHmac } from "node:crypto";
import { env } from "../../config/env";
import { majorAmountToMinor } from "./webhookVerification";
import { HttpError } from "../../lib/errors";
import { getRuntimePaymentMode } from "./runtimePaymentMode";

export type ProviderName = "paystack" | "flutterwave" | "stripe" | "opay" | "demo";

export function getOpayWebhookSecret(): string | undefined { return opayCredentials().secretKey; }

function opayCredentials() {
  if (getRuntimePaymentMode() === "live") {
    return {
      merchantId: env.OPAY_LIVE_MERCHANT_ID,
      publicKey: env.OPAY_LIVE_PUBLIC_KEY,
      secretKey: env.OPAY_LIVE_SECRET_KEY,
    };
  }
  return {
    merchantId: env.OPAY_TEST_MERCHANT_ID || env.OPAY_MERCHANT_ID,
    publicKey: env.OPAY_TEST_PUBLIC_KEY || env.OPAY_PUBLIC_KEY,
    secretKey: env.OPAY_TEST_SECRET_KEY || env.OPAY_SECRET_KEY,
  };
}

export function canUseDemoPayments(
  options: { nodeEnv?: string; paymentMode?: string } = {},
): boolean {
  return (
    (options.nodeEnv ?? env.NODE_ENV) !== "production" &&
    (options.paymentMode ?? getRuntimePaymentMode()) === "demo"
  );
}

export function canCompleteDemoCheckout(
  provider: string,
  status: string,
  options: { nodeEnv?: string; paymentMode?: string } = {},
): boolean {
  return provider === "demo" && status === "PENDING" && canUseDemoPayments(options);
}

export function canUseProductionTestMode(
  options: { nodeEnv?: string; paymentMode?: string; allowProductionTestMode?: string } = {},
): boolean {
  return (
    (options.nodeEnv ?? env.NODE_ENV) !== "production" ||
    (options.paymentMode ?? getRuntimePaymentMode()) !== "test" ||
    (options.allowProductionTestMode ?? env.ALLOW_PRODUCTION_TEST_MODE) === "true"
  );
}

function assertPaymentMode() {
  if (getRuntimePaymentMode() === "live" && (env.EPHINTA_ENVIRONMENT !== "production" || env.OPAY_LIVE_MODE_READY !== "true" || !env.OPAY_LIVE_MERCHANT_ID || !env.OPAY_LIVE_PUBLIC_KEY || !env.OPAY_LIVE_SECRET_KEY)) {
    throw new HttpError(503, "OPAY_LIVE_NOT_READY", "OPay production credentials and readiness attestation are required before LIVE transactions.");
  }
  if (env.NODE_ENV === "production" && getRuntimePaymentMode() === "demo") {
    throw new HttpError(503, "DEMO_MODE_NOT_ALLOWED", "DEMO payment mode is disabled in production.");
  }
  if (!canUseProductionTestMode()) {
    throw new HttpError(503, "PRODUCTION_TEST_MODE_DISABLED", "TEST payments are not enabled on this production API deployment.");
  }
}

function assertProviderKeyMode(
  name: string,
  key: string | undefined,
  testPattern: RegExp,
  livePattern: RegExp,
) {
  if (!key) return;
  if (getRuntimePaymentMode() === "test" && livePattern.test(key)) {
    throw new Error(`${name} live key cannot be used while PAYMENT_MODE=test`);
  }
  if (getRuntimePaymentMode() === "live" && testPattern.test(key)) {
    throw new Error(`${name} test key cannot be used while PAYMENT_MODE=live`);
  }
}

export function getPaymentMode() {
  return getRuntimePaymentMode();
}

export function selectProvider(currency: string, country?: string): ProviderName {
  assertPaymentMode();

  if (getRuntimePaymentMode() === "demo") return "demo";

  const c = currency.toUpperCase();
  const countryCode = country?.toUpperCase();
  if (countryCode === "NG" && c !== "NGN") {
    throw new HttpError(400, "OPAY_CURRENCY_UNSUPPORTED", "OPay payments in Nigeria require NGN.");
  }
  if (c !== "NGN") {
    throw new HttpError(400, "OPAY_CURRENCY_UNSUPPORTED", "OPay is the configured payment rail. Only NGN transactions are enabled until additional OPay markets are verified.");
  }
  // EPHINTA's Nigerian payment rail is OPay only. Never silently route an
  // NGN deposit through another processor or a simulated checkout.
  if (c === "NGN" || countryCode === "NG") {
    if (c !== "NGN") {
      throw new HttpError(400, "OPAY_CURRENCY_UNSUPPORTED", "OPay payments in Nigeria require NGN.");
    }
    const credentials = opayCredentials();
    if (!credentials.merchantId || !credentials.publicKey || !credentials.secretKey) {
      throw new HttpError(503, "OPAY_NOT_CONFIGURED", "OPay is the required provider for NGN payments, but its merchant credentials are not configured.");
    }
    return "opay";
  }

  // OPay's current merchant checkout integration is enabled for NGN. Keep
  // other supported markets on their own configured local payment rails.
  if (c === "GHS" || countryCode === "GH") {
    if (env.FLUTTERWAVE_SECRET_KEY) return "flutterwave";
    if (env.PAYSTACK_SECRET_KEY) return "paystack";
  }
  if (countryCode && ["KE", "UG", "TZ", "ZA", "RW"].includes(countryCode)) {
    if (env.FLUTTERWAVE_SECRET_KEY) return "flutterwave";
  }
  if (env.FLUTTERWAVE_SECRET_KEY) return "flutterwave";
  if (env.PAYSTACK_SECRET_KEY) return "paystack";
  if (env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is configured, but its checkout adapter is not enabled");
  }
  if (canUseDemoPayments()) return "demo";
  throw new Error("No payment provider is configured; demo payments are disabled in live/production mode");
}

/** Create an OPay cashier checkout. Keys are server-only; never expose them to the client. */
export async function initializeOpay(input: {
  amountMinor: bigint;
  currency: string;
  reference: string;
  callbackUrl: string;
  notifyUrl?: string;
}): Promise<InitResult> {
  assertPaymentMode();
  const credentials = opayCredentials();
  if (!credentials.merchantId || !credentials.publicKey || !credentials.secretKey) {
    throw new Error("OPay credentials for the selected central mode are not configured");
  }
  if (input.currency.toUpperCase() !== "NGN") {
    throw new Error("OPay checkout currently supports NGN only");
  }
  const total = Number(input.amountMinor);
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new Error("OPay amount must be a positive safe integer in minor units");
  }
  if (!input.reference.trim()) {
    throw new Error("OPay payment reference is required");
  }

  const apiHost = getRuntimePaymentMode() === "test" ? "testapi.opaycheckout.com" : "liveapi.opaycheckout.com";
  const cashierHost = getRuntimePaymentMode() === "test" ? "sandboxcashier.opaycheckout.com" : "cashier.opaycheckout.com";
  const res = await fetch(`https://${apiHost}/api/v1/international/cashier/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.publicKey}`,
      MerchantId: credentials.merchantId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country: "NG",
      reference: input.reference,
      amount: { total, currency: "NGN" },
      returnUrl: input.callbackUrl,
      ...(input.notifyUrl ? { callbackUrl: input.notifyUrl } : {}),
      product: { name: "EPHINTA Wallet Deposit", description: "Wallet funding" },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as {
    code?: string;
    message?: string;
    data?: { cashierUrl?: string; reference?: string };
  };
  if (!res.ok || data.code !== "00000" || !data.data?.cashierUrl) {
    throw new Error(data.message || "OPay checkout initialization failed");
  }
  if (data.data.reference !== input.reference) {
    throw new Error("OPay checkout response reference does not match the requested payment");
  }

  let cashierUrl: URL;
  try {
    cashierUrl = new URL(data.data.cashierUrl);
  } catch {
    throw new Error("OPay returned an invalid cashier URL");
  }
  if (
    cashierUrl.protocol !== "https:" ||
    cashierUrl.hostname.toLowerCase() !== cashierHost ||
    cashierUrl.username ||
    cashierUrl.password ||
    cashierUrl.port
  ) {
    throw new Error("OPay returned a cashier URL outside the approved sandbox host or production host for the selected mode");
  }

  return {
    provider: "opay",
    providerRef: data.data.reference || input.reference,
    authorizationUrl: cashierUrl.toString(),
    mode: getRuntimePaymentMode() === "test" ? "sandbox" : "live",
  };
}

/** Verify OPay status server-to-server; never trust the browser return URL. */
export async function verifyOpay(reference: string): Promise<{
  success: boolean;
  amountMinor: bigint;
  currency: string;
  reference?: string;
  raw: unknown;
}> {
  const credentials = opayCredentials();
  if (!credentials.merchantId || !credentials.secretKey) {
    throw new Error("OPay verification credentials for the selected central mode are not configured");
  }
  const requestBody = { country: "NG", reference };
  const body = JSON.stringify(requestBody);
  const signature = createHmac("sha512", credentials.secretKey).update(body).digest("hex");
  const apiHost = getRuntimePaymentMode() === "test" ? "testapi.opaycheckout.com" : "liveapi.opaycheckout.com";
  const res = await fetch(`https://${apiHost}/api/v1/international/cashier/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${signature}`,
      MerchantId: credentials.merchantId,
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as {
    code?: string;
    message?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: { total?: number | string; currency?: string };
      isVoided?: boolean;
    };
  };
  if (!res.ok) throw new Error(`OPay status verification failed (${res.status})`);
  if (data.code !== "00000" || !data.data) {
    throw new Error(data.message || "OPay status response was unsuccessful");
  }
  const amount = data.data.amount?.total;
  if (amount === undefined || amount === null || !/^\d+$/.test(String(amount))) {
    throw new Error("OPay status response is missing a valid amount");
  }
  const responseReference = data.data.reference;
  return {
    success: data.data.status === "SUCCESS" && data.data.isVoided !== true,
    amountMinor: BigInt(String(amount)),
    currency: String(data.data.amount?.currency || "").toUpperCase(),
    reference: responseReference,
    raw: data,
  };
}

export type InitResult = {
  provider: ProviderName;
  providerRef: string;
  authorizationUrl?: string;
  accessCode?: string;
  mode: "live" | "sandbox" | "demo";
};

/** Amount for Paystack is in major subunit already as kobo/pesewas (minor units). */
export async function initializePaystack(input: {
  email: string;
  amountMinor: bigint;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitResult> {
  assertPaymentMode();

  assertProviderKeyMode("Paystack", env.PAYSTACK_SECRET_KEY, /^sk_test_/, /^sk_live_/);
  if (!env.PAYSTACK_SECRET_KEY) {
    return { provider: "demo", providerRef: input.reference, mode: "demo" };
  }

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Number(input.amountMinor),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  const data = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      authorization_url?: string;
      access_code?: string;
      reference?: string;
    };
  };

  if (!res.ok || !data.status) {
    throw new Error(data.message || "Paystack initialize failed");
  }

  return {
    provider: "paystack",
    providerRef: data.data?.reference || input.reference,
    authorizationUrl: data.data?.authorization_url,
    accessCode: data.data?.access_code,
    mode: "live",
  };
}

export async function verifyPaystack(reference: string): Promise<{
  success: boolean;
  amountMinor: bigint;
  currency: string;
  reference?: string;
  raw: unknown;
}> {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error("Paystack verification is not configured");
  }

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  const data = (await res.json()) as {
    status?: boolean;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      reference?: string;
    };
  };

  if (!res.ok) {
    throw new Error(`Paystack transaction verification failed (${res.status})`);
  }

  const ok = Boolean(
    data.status &&
      data.data?.status === "success" &&
      data.data.reference === reference,
  );

  return {
    success: ok,
    amountMinor: BigInt(data.data?.amount ?? 0),
    currency: (data.data?.currency || "NGN").toUpperCase(),
    reference: data.data?.reference,
    raw: data,
  };
}

export async function initializeStripe(input: {
  email: string;
  amountMinor: bigint;
  currency: string;
  reference: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<InitResult> {
  assertPaymentMode();

  assertProviderKeyMode("Stripe", env.STRIPE_SECRET_KEY, /^sk_test_/, /^sk_live_/);
  if (!env.STRIPE_SECRET_KEY) {
    return { provider: "demo", providerRef: input.reference, mode: "demo" };
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("customer_email", input.email);
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("client_reference_id", input.reference);
  params.set("metadata[essReference]", input.reference);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", input.amountMinor.toString());
  params.set("line_items[0][price_data][product_data][name]", "ESS Wallet Deposit");

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.STRIPE_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = (await res.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.id || !data.url) {
    throw new Error(data.error?.message || "Stripe checkout initialization failed");
  }

  return {
    provider: "stripe",
    providerRef: data.id,
    authorizationUrl: data.url,
    mode: "live",
  };
}

export async function verifyStripe(sessionId: string): Promise<{
  success: boolean;
  amountMinor: bigint;
  currency: string;
  sessionId?: string;
  raw: unknown;
}> {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe verification is not configured");
  }

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.STRIPE_SECRET_KEY}:`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(15_000),
    },
  );

  const data = (await res.json()) as {
    id?: string;
    payment_status?: string;
    amount_total?: number;
    currency?: string;
  };

  if (!res.ok) {
    throw new Error(`Stripe checkout verification failed (${res.status})`);
  }

  return {
    success: data.payment_status === "paid",
    amountMinor: BigInt(data.amount_total ?? 0),
    currency: (data.currency || "NGN").toUpperCase(),
    sessionId: data.id,
    raw: data,
  };
}

export async function initializeFlutterwave(input: {
  email: string;
  name: string;
  amountMinor: bigint;
  currency: string;
  reference: string;
  redirectUrl: string;
}): Promise<InitResult> {
  assertPaymentMode();

  assertProviderKeyMode("Flutterwave", env.FLUTTERWAVE_SECRET_KEY, /^FLWSECK_TEST/, /^FLWSECK-/);
  if (!env.FLUTTERWAVE_SECRET_KEY) {
    return { provider: "demo", providerRef: input.reference, mode: "demo" };
  }

  // Flutterwave expects major units for amount in many APIs — convert from minor.
  const major = Number(input.amountMinor) / 100;

  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: input.reference,
      amount: major,
      currency: input.currency,
      redirect_url: input.redirectUrl,
      customer: { email: input.email, name: input.name },
      customizations: {
        title: "ESS Wallet Deposit",
        description: "EPHINTA",
      },
    }),
  });

  const data = (await res.json()) as {
    status?: string;
    message?: string;
    data?: { link?: string };
  };

  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Flutterwave initialize failed");
  }

  return {
    provider: "flutterwave",
    providerRef: input.reference,
    authorizationUrl: data.data?.link,
    mode: "live",
  };
}

/**
 * Verify Flutterwave using its transaction ID.
 * Fail closed when the provider response is unsuccessful or missing
 * required transaction details. The webhook must still independently
 * compare the returned reference, amount, and currency with the intent.
 */
export async function verifyFlutterwave(transactionId: string): Promise<{
  success: boolean;
  amountMinor: bigint;
  currency: string;
  txRef?: string;
  raw: unknown;
}> {
  if (!env.FLUTTERWAVE_SECRET_KEY) {
    throw new Error("Flutterwave verification is not configured");
  }

  if (!/^\d+$/.test(transactionId)) {
    throw new Error("Flutterwave transaction id is invalid");
  }

  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
    {
      headers: {
        Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    throw new Error(`Flutterwave transaction verification failed (${res.status})`);
  }

  const data = (await res.json()) as {
    status?: string;
    data?: {
      status?: string;
      amount?: number | string;
      currency?: string;
      tx_ref?: string;
    };
  };

  const successful =
    data.status === "success" && data.data?.status === "successful";

  // An unsuccessful transaction must never be treated as verified.
  if (!successful) {
    return {
      success: false,
      amountMinor: 0n,
      currency: data.data?.currency?.toUpperCase() ?? "",
      txRef: data.data?.tx_ref,
      raw: data,
    };
  }

  if (!data.data?.currency?.trim()) {
    throw new Error("Flutterwave verification response is missing currency");
  }

  if (!data.data?.tx_ref?.trim()) {
    throw new Error(
      "Flutterwave verification response is missing transaction reference",
    );
  }

  if (data.data.amount === undefined || data.data.amount === null) {
    throw new Error("Flutterwave verification response is missing amount");
  }

  return {
    success: true,
    amountMinor: majorAmountToMinor(data.data.amount),
    currency: data.data.currency.toUpperCase(),
    txRef: data.data.tx_ref,
    raw: data,
  };
}