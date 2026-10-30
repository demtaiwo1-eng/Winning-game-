/**
 * Live payment provider adapters.
 * When secret keys are set in env, real initialize/verify is used.
 * Otherwise demo mode returns local checkout URLs.
 */
import { createHmac } from "node:crypto";
import { env } from "../../config/env";
import { majorAmountToMinor } from "./webhookVerification";

export type ProviderName = "opay" | "paystack" | "flutterwave" | "stripe" | "demo";

export function canUseDemoPayments(
  options: { nodeEnv?: string; paymentMode?: string } = {},
): boolean {
  return (
    (options.nodeEnv ?? env.NODE_ENV) !== "production" &&
    (options.paymentMode ?? env.PAYMENT_MODE) === "test"
  );
}

export function canCompleteDemoCheckout(
  provider: string,
  status: string,
  options: { nodeEnv?: string; paymentMode?: string } = {},
): boolean {
  return provider === "demo" && status === "PENDING" && canUseDemoPayments(options);
}

function assertPaymentMode() {
  const keys: Array<[string, string | undefined, RegExp, RegExp]> = [
    ["Paystack", env.PAYSTACK_SECRET_KEY, /^sk_test_/, /^sk_live_/],
    ["Flutterwave", env.FLUTTERWAVE_SECRET_KEY, /^FLWSECK_TEST/, /^FLWSECK-/],
    ["Stripe", env.STRIPE_SECRET_KEY, /^sk_test_/, /^sk_live_/],
  ];

  for (const [name, key, testPattern, livePattern] of keys) {
    if (!key) continue;

    if (env.PAYMENT_MODE === "test" && livePattern.test(key)) {
      throw new Error(`${name} live key cannot be used while PAYMENT_MODE=test`);
    }

    if (env.PAYMENT_MODE === "live" && testPattern.test(key)) {
      throw new Error(`${name} test key cannot be used while PAYMENT_MODE=live`);
    }
  }

  if (env.NODE_ENV === "production" && env.PAYMENT_MODE === "test") {
    throw new Error("PAYMENT_MODE=test is forbidden in production");
  }
}

export function getPaymentMode() {
  assertPaymentMode();
  return env.PAYMENT_MODE;
}

export function selectProvider(currency: string, country?: string): ProviderName {
  assertPaymentMode();

  const c = currency.toUpperCase();

  if (c === "NGN" && env.OPAY_ENABLED === "true" && env.OPAY_MERCHANT_ID && env.OPAY_PUBLIC_KEY && env.OPAY_SECRET_KEY) return "opay";

  if (["NGN", "GHS"].includes(c)) {
    if (env.PAYSTACK_SECRET_KEY) return "paystack";
    if (env.FLUTTERWAVE_SECRET_KEY) return "flutterwave";
  }

  if (country && ["NG", "GH"].includes(country.toUpperCase())) {
    if (env.PAYSTACK_SECRET_KEY) return "paystack";
    if (env.FLUTTERWAVE_SECRET_KEY) return "flutterwave";
  }

  if (country && ["KE", "UG", "TZ", "ZA", "RW"].includes(country.toUpperCase())) {
    if (env.FLUTTERWAVE_SECRET_KEY) return "flutterwave";
  }

  if (env.PAYSTACK_SECRET_KEY) return "paystack";
  if (env.FLUTTERWAVE_SECRET_KEY) return "flutterwave";

  if (env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is configured, but its checkout adapter is not enabled");
  }

  if (canUseDemoPayments()) return "demo";

  throw new Error(
    "No payment provider is configured; demo payments are disabled in live/production mode",
  );
}

export type InitResult = {
  provider: ProviderName;
  providerRef: string;
  authorizationUrl?: string;
  accessCode?: string;
  mode: "live" | "demo";
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

function opayBaseUrl() {
  const url = new URL(env.OPAY_API_BASE_URL);
  if (url.protocol !== "https:") throw new Error("OPay API base URL must use HTTPS");
  if (env.OPAY_MODE === "sandbox" && !url.hostname.includes("sandbox")) {
    throw new Error("OPay sandbox mode requires the OPay sandbox API host");
  }
  if (env.OPAY_MODE === "live" && url.hostname.includes("sandbox")) {
    throw new Error("OPay live mode cannot use the sandbox API host");
  }
  return url.toString().replace(/\/$/, "");
}

function opayHeaders(payload: Record<string, unknown>, signed: boolean) {
  if (!env.OPAY_MERCHANT_ID || !env.OPAY_PUBLIC_KEY || !env.OPAY_SECRET_KEY) {
    throw new Error("OPay merchant credentials are incomplete");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    MerchantId: env.OPAY_MERCHANT_ID,
  };
  if (signed) {
    const canonical = JSON.stringify(sortObjectKeys(payload));
    const signature = createHmac("sha512", env.OPAY_SECRET_KEY).update(canonical).digest("hex");
    headers.Authorization = `Bearer ${signature}`;
  } else {
    headers.Authorization = `Bearer ${env.OPAY_PUBLIC_KEY}`;
  }
  return headers;
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortObjectKeys(child)]),
    );
  }
  return value;
}

async function opayPost(path: string, payload: Record<string, unknown>, signed: boolean) {
  const response = await fetch(`${opayBaseUrl()}${path}`, {
    method: "POST",
    headers: opayHeaders(payload, signed),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json() as {
    code?: string;
    message?: string;
    data?: Record<string, any>;
  };
  if (!response.ok || data.code !== "00000") {
    throw new Error(data.message || `OPay request failed (${response.status})`);
  }
  return data.data ?? {};
}

export async function initializeOpay(input: {
  email: string;
  name: string;
  amountMinor: bigint;
  currency: string;
  reference: string;
  returnUrl: string;
  callbackUrl: string;
}): Promise<InitResult> {
  if (input.currency !== "NGN") throw new Error("OPay sandbox adapter currently supports NGN only");
  if (env.OPAY_ENABLED !== "true" || env.OPAY_MODE !== "sandbox") {
    throw new Error("OPay is not enabled for sandbox testing");
  }
  const payload = {
    country: "NG",
    reference: input.reference,
    amount: { total: Number(input.amountMinor), currency: input.currency },
    returnUrl: input.returnUrl,
    callbackUrl: input.callbackUrl,
    cancelUrl: input.returnUrl,
    expireAt: 30,
    userInfo: { userEmail: input.email, userName: input.name },
    productList: [{
      productId: "ephinta-wallet-deposit",
      name: "EPHINTA Wallet Deposit",
      description: "EPHINTA wallet funding",
      price: Number(input.amountMinor),
      quantity: 1,
    }],
  };
  const data = await opayPost("/api/v1/international/cashier/create", payload, false);
  const cashierUrl = typeof data.cashierUrl === "string" ? data.cashierUrl : "";
  const parsed = new URL(cashierUrl);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("opaycheckout.com")) {
    throw new Error("OPay returned an invalid cashier URL");
  }
  if (data.reference !== input.reference) throw new Error("OPay returned a mismatched payment reference");
  return { provider: "opay", providerRef: input.reference, authorizationUrl: cashierUrl, mode: "live" };
}

export async function verifyOpay(reference: string): Promise<{
  success: boolean;
  amountMinor: bigint;
  currency: string;
  reference?: string;
  raw: unknown;
}> {
  const payload = { country: "NG", reference };
  const data = await opayPost("/api/v1/international/cashier/status", payload, true);
  const amount = data.amount?.total;
  const currency = typeof data.amount?.currency === "string" ? data.amount.currency.toUpperCase() : "";
  return {
    success: data.status === "SUCCESS",
    amountMinor: typeof amount === "number" || typeof amount === "string" ? BigInt(amount) : 0n,
    currency,
    reference: typeof data.reference === "string" ? data.reference : undefined,
    raw: data,
  };
}
