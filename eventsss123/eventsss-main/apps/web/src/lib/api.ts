/**
 * Thin authenticated API client for ESS web.
 * Tokens are stored in localStorage by EnterpriseApp auth flow.
 */

const API_BASE =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  "/api/v1";

export function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/+$/, "");
  const suffix = path.replace(/^\/+/, "");
  return base + "/" + suffix;
}

function token(): string | null {
  try {
    return localStorage.getItem("ess_access_token");
  } catch {
    return null;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(apiUrl(path), { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      body?.error?.message || body?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export type ApiListing = {
  id: string;
  title: string;
  description?: string | null;
  type: "VENUE" | "GOOD" | "SERVICE";
  priceMinor: string;
  currency: string;
  city?: string | null;
  country?: string | null;
  capacity?: number | null;
  status: string;
  ratingAvg?: number;
  reviewCount?: number;
  vendor?: { businessName: string; slug?: string; verification?: string };
  category?: { id: string; name: string };
};

export type ApiWallet = {
  id: string;
  currency: string;
  availableMinor: string;
  escrowMinor: string;
  pendingMinor?: string;
};

export type ApiPlan = {
  id: string;
  code: string;
  name: string;
  audience: string;
  priceMinor: string;
  currency: string;
  interval: string;
  features: Record<string, unknown>;
};

export const marketplaceApi = {
  list: (params?: Record<string, string>) => {
    const q = params ? `?${new URLSearchParams(params)}` : "";
    return api<{ items: ApiListing[] }>(`/marketplace${q}`);
  },
  categories: () => api<{ items: { id: string; name: string; slug: string }[] }>("/marketplace/categories"),
};

export type FeedbackBooking = {
  id: string;
  status: string;
  currency: string;
  totalMinor: string;
  completedAt: string;
  vendor: { businessName: string };
  items: Array<{ id: string; title: string; quantity: number }>;
};

export const feedbackApi = {
  eligibleBookings: () => api<{ items: FeedbackBooking[] }>("/marketplace/reviews/eligible"),
  submit: (body: { bookingId: string; rating: number; comment?: string }) =>
    api<{ review: { id: string; rating: number; comment?: string | null } }>(
      "/marketplace/reviews",
      { method: "POST", body: JSON.stringify(body) },
    ),
};

export const walletApi = {
  list: () => api<{ items: ApiWallet[] }>("/wallet"),
  ledger: (walletId: string) =>
    api<{ items: unknown[]; wallet: ApiWallet }>(`/wallet/${walletId}/ledger`),
  deposit: (body: { currency: string; amountMinor: string; idempotencyKey?: string }) =>
    api("/wallet/deposit", { method: "POST", body: JSON.stringify(body) }),
  escrowHold: (body: {
    currency: string;
    amountMinor: string;
    refId?: string;
    idempotencyKey?: string;
  }) => api("/wallet/escrow-hold", { method: "POST", body: JSON.stringify(body) }),
};

export type ApiPublicPromotion = {
  id: string;
  title: string;
  vendorName: string;
  listingTitle?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  startsAt: string;
  endsAt: string;
  currency: string;
  budgetMinor: string;
};

export const billingApi = {
  plans: (audience?: string) =>
    api<{ items: ApiPlan[] }>(
      `/billing/plans${audience ? `?audience=${audience}` : ""}`,
    ),
  mySubscriptions: () => api<{ items: unknown[] }>('/billing/subscriptions/me'),
  subscribe: (planId: string) =>
    api('/billing/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),
  cancel: (id: string) =>
    api(`/billing/subscriptions/${id}/cancel`, { method: 'POST', body: '{}' }),
  publicPromotions: () => api<{ items: ApiPublicPromotion[] }>('/billing/public-promotions'),
  promotions: () => api<{ items: unknown[] }>("/billing/promotions"),
  createPromotion: (body: Record<string, unknown>) =>
    api("/billing/promotions", { method: "POST", body: JSON.stringify(body) }),
};

export const kycApi = {
  me: () => api<{ items: unknown[] }>("/kyc/me"),
  submit: (body: {
    kind: "IDENTITY" | "BUSINESS";
    documentUrl?: string;
    documentBase64?: string;
    fileName?: string;
    notes?: string;
  }) => api("/kyc/submit", { method: "POST", body: JSON.stringify(body) }),
  queue: () => api<{ items: unknown[] }>("/kyc/queue"),
  review: (id: string, status: "VERIFIED" | "REJECTED", notes?: string) =>
    api(`/kyc/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ status, notes }),
    }),
};

export const paymentsApi = {
  createIntent: (body: { currency: string; amountMinor: string; country?: string; purpose?: string }) =>
    api<{
      intent: { id: string; provider: string };
      checkoutUrl: string;
      mode: "live" | "demo";
    }>("/payments/intents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  demoCheckout: (intentId: string) =>
    api(`/payments/demo-checkout/${intentId}`, { method: "POST", body: "{}" }),
  book: (body: { listingId: string; quantity?: number; eventId?: string; notes?: string }) =>
    api("/payments/book", { method: "POST", body: JSON.stringify(body) }),
  release: (bookingId: string) =>
    api(`/payments/bookings/${bookingId}/release`, { method: "POST", body: "{}" }),
  payout: (body: { currency: string; amountMinor: string; destination?: string }) =>
    api("/payments/payouts", { method: "POST", body: JSON.stringify(body) }),
  bookings: (asVendor?: boolean) =>
    api<{ items: unknown[] }>(`/payments/bookings${asVendor ? "?as=vendor" : ""}`),
};


export type ApiCartItem = {
  id: string;
  listingId: string;
  title: string;
  vendor?: string;
  vendorVerification?: string;
  category?: string;
  quantity: number;
  unitPriceMinor: string;
  lineTotalMinor: string;
  currency: string;
};

export type ApiCart = {
  id: string;
  eventId?: string | null;
  currency: string;
  status: string;
  items: ApiCartItem[];
};

export type ApiCheckoutSession = {
  id: string;
  status: string;
  currency: string;
  subtotalMinor: string;
  commissionMinor: string;
  totalMinor: string;
  expiresAt: string;
  items: Array<{
    id: string;
    listingId: string;
    title: string;
    quantity: number;
    unitPriceMinor: string;
    currency: string;
  }>;
  paymentMethods?: string[];
};

export const checkoutApi = {
  cart: (eventId?: string) =>
    api<{ cart: ApiCart }>(`/checkout/cart${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`),
  add: (listingId: string, quantity = 1, eventId?: string) =>
    api<{ cart: ApiCart }>(`/checkout/cart/items`, {
      method: "POST",
      body: JSON.stringify({ listingId, quantity, ...(eventId ? { eventId } : {}) }),
    }),
  update: (itemId: string, quantity: number) =>
    api<{ cart: ApiCart }>(`/checkout/cart/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    }),
  remove: (itemId: string) =>
    api<{ ok: boolean }>(`/checkout/cart/items/${itemId}`, {
      method: "DELETE",
      body: "{}",
    }),
  createSession: (cartId?: string, eventId?: string) =>
    api<{ session: ApiCheckoutSession }>("/checkout/checkout-sessions", {
      method: "POST",
      body: JSON.stringify({ ...(cartId ? { cartId } : {}), ...(eventId ? { eventId } : {}) }),
    }),
  getSession: (id: string) =>
    api<{ session: ApiCheckoutSession }>(`/checkout/checkout-sessions/${id}`),
  payWithWallet: (id: string, idempotencyKey?: string) =>
    api<{ status: string; sessionId: string; bookingIds: string[]; totalMinor: string; currency: string }>(
      `/checkout/checkout-sessions/${id}/pay-with-wallet`,
      { method: "POST", body: JSON.stringify({ ...(idempotencyKey ? { idempotencyKey } : {}) }) },
    ),
  cancelSession: (id: string) =>
    api<{ session: { id: string; status: string } }>(`/checkout/checkout-sessions/${id}/cancel`, {
      method: "POST",
      body: "{}",
    }),
};

export const kycCountriesApi = {
  list: (region?: string) =>
    api<{ count: number; items: Array<{ code: string; name: string; region: string; currency: string; identityDocs: string[]; businessDocs: string[]; nationalIdLabel?: string; notes?: string }> }>(
      `/kyc/countries${region ? `?region=${region}` : ""}`,
    ),
  profile: (code: string) => api<{ profile: Record<string, unknown> }>(`/kyc/countries/${code}`),
};


/** Download an authenticated CSV or other file response from the API. */
export async function downloadApiFile(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {};
  const accessToken = token();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(apiUrl(path), { method: "GET", headers, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.message || `Request failed (${response.status})`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
