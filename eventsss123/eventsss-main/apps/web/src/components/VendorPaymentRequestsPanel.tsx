import { useCallback, useEffect, useState } from "react";
import { api, paymentsApi } from "../lib/api";

type Booking = {
  id: string;
  status: string;
  currency: string;
  totalMinor: string;
  paidMinor: string;
  event?: { id: string; title: string } | null;
  buyer?: { name: string };
  items?: Array<{ listing?: { title: string } }>;
};
type RequestItem = { id: string; amountMinor: string; reason: string; status: string; createdAt: string };

const money = (minor: string, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(minor) / 100);

export default function VendorPaymentRequestsPanel() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<Record<string, RequestItem[]>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [requestKeys, setRequestKeys] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const result = await api<{ items: Booking[] }>("/payments/bookings?as=vendor");
      setBookings(result.items || []);
      const pages = await Promise.all((result.items || []).map(async (booking) => {
        try {
          const page = await paymentsApi.bookingPaymentRequests(booking.id);
          return [booking.id, page.items] as const;
        } catch { return [booking.id, []] as const; }
      }));
      setRequests(Object.fromEntries(pages));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your bookings.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async (booking: Booking) => {
    const major = Number(amounts[booking.id] || "");
    const reason = (reasons[booking.id] || "").trim();
    if (!Number.isFinite(major) || major <= 0 || major > Number.MAX_SAFE_INTEGER / 100) {
      setError("Enter a valid positive amount."); return;
    }
    if (reason.length < 8) { setError("Explain which essential item or milestone needs payment (at least 8 characters)."); return; }
    const idempotencyKey = requestKeys[booking.id] || (
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `vendor-request-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    setRequestKeys((current) => ({ ...current, [booking.id]: idempotencyKey }));
    setBusyId(booking.id); setError(""); setNotice("");
    try {
      await paymentsApi.requestBookingPayment(booking.id, {
        amountMinor: String(Math.round(major * 100)), reason, idempotencyKey,
      });
      setAmounts((current) => ({ ...current, [booking.id]: "" }));
      setReasons((current) => ({ ...current, [booking.id]: "" }));
      setRequestKeys((current) => ({ ...current, [booking.id]: "" }));
      setNotice("Payment request sent to the event planner for approval. No money has moved yet.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send payment request.");
    } finally { setBusyId(""); }
  };

  return <section className="ess-panel" aria-labelledby="vendor-payment-requests-title">
    <p className="ess-eyebrow">Vendor finance</p>
    <h2 id="vendor-payment-requests-title">Booking milestones & essential payments</h2>
    <p className="ess-muted">Request a payment for an essential item or agreed milestone. The event planner must approve it; approval moves funds from their wallet into protected escrow, not directly to your bank.</p>
    {error && <p className="ess-form-error" role="alert">{error}</p>}
    {notice && <p className="ess-muted" role="status">{notice}</p>}
    <button className="ess-outline-button" type="button" onClick={() => void refresh()} disabled={!!busyId}>Refresh bookings</button>
    {bookings.length === 0 ? <p className="ess-muted">No event bookings are linked to your vendor account yet.</p> :
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {bookings.map((booking) => {
          const bookingRequests = requests[booking.id] || [];
          const pendingRequestedMinor = bookingRequests
            .filter((request) => request.status === "PENDING" || request.status === "PROCESSING")
            .reduce((total, request) => total + Number(request.amountMinor || "0"), 0);
          const remaining = Math.max(0, Number(booking.totalMinor) - Number(booking.paidMinor || "0") - pendingRequestedMinor);
          return <article className="ess-card" key={booking.id}>
            <strong>{booking.items?.map((item) => item.listing?.title).filter(Boolean).join(", ") || "Vendor service"}</strong>
            <p className="ess-muted">{booking.event?.title || "Event"} · {booking.status}</p>
            <p>Paid into escrow: {money(booking.paidMinor || "0", booking.currency)} / {money(booking.totalMinor, booking.currency)}</p>
            <p>Awaiting planner approval: {money(String(pendingRequestedMinor), booking.currency)}</p>
            <p>Available to request: <strong>{money(String(remaining), booking.currency)}</strong></p>
            <form className="ess-form-grid" onSubmit={(event) => { event.preventDefault(); void submit(booking); }}>
              <label>Requested amount ({booking.currency})<input type="number" min="0.01" step="0.01" max={(remaining / 100).toFixed(2)} value={amounts[booking.id] || ""} onChange={(event) => { setAmounts((current) => ({ ...current, [booking.id]: event.target.value })); setRequestKeys((current) => ({ ...current, [booking.id]: "" })); }} required disabled={remaining <= 0} /></label>
              <label>Essential item / milestone reason<textarea rows={2} minLength={8} maxLength={500} value={reasons[booking.id] || ""} onChange={(event) => { setReasons((current) => ({ ...current, [booking.id]: event.target.value })); setRequestKeys((current) => ({ ...current, [booking.id]: "" })); }} required disabled={remaining <= 0} placeholder="e.g. 50% deposit for catering ingredients and venue setup" /></label>
              <button className="ess-primary" type="submit" disabled={!!busyId || remaining <= 0}>{busyId === booking.id ? "Sending…" : "Request planner approval"}</button>
            </form>
            <div style={{ marginTop: 10 }}>
              <strong>Payment request history</strong>
              {(requests[booking.id] || []).length === 0 ? <p className="ess-muted">No requests yet.</p> :
                bookingRequests.map((request) => <p className="ess-muted" key={request.id}>{money(request.amountMinor, booking.currency)} · {request.reason} · {request.status}</p>)}
            </div>
          </article>;
        })}
      </div>}
  </section>;
}
