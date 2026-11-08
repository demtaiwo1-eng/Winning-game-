import { useEffect, useMemo, useState } from "react";
import { formatMoney, type CurrencyCode, type LocaleCode, t } from "../lib/i18n";
import {
  api,
  checkoutApi,
  marketplaceApi,
  paymentsApi,
  type ApiCart,
  type ApiCheckoutSession,
  type ApiListing,
} from "../lib/api";

export type MarketListing = {
  id: string;
  title: string;
  category: string;
  type: "VENUE" | "GOOD" | "SERVICE";
  city: string;
  country: string;
  priceMinor: string;
  currency: CurrencyCode;
  vendorName: string;
  rating: number;
  reviews: number;
  verified: boolean;
};

function mapApi(l: ApiListing): MarketListing {
  return {
    id: l.id,
    title: l.title,
    category: l.category?.name || l.type,
    type: l.type,
    city: l.city || "—",
    country: l.country || "—",
    priceMinor: l.priceMinor,
    currency: (l.currency as CurrencyCode) || "NGN",
    vendorName: l.vendor?.businessName || "Vendor",
    rating: l.ratingAvg ?? 0,
    reviews: l.reviewCount ?? 0,
    verified: l.vendor?.verification === "VERIFIED",
  };
}

const CATEGORIES = ["All", "Venue", "Catering", "Décor", "Production", "Rentals"];

export default function MarketplaceBrowse({
  locale = "en",
  onBook,
  onOpenWallet,
}: {
  locale?: LocaleCode;
  onBook?: (listing: MarketListing) => void;
  onOpenWallet?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "VENUE" | "GOOD" | "SERVICE">("ALL");
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [source, setSource] = useState<"live" | "empty">("empty");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingMsg, setBookingMsg] = useState("");
  const [cart, setCart] = useState<ApiCart | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<ApiCheckoutSession | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; title: string; startsAt?: string | null }>>([]);
  const [eventId, setEventId] = useState("");
  const [enquiryListing, setEnquiryListing] = useState<MarketListing | null>(null);
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [enquiryNotice, setEnquiryNotice] = useState("");
  const [depositListing, setDepositListing] = useState<MarketListing | null>(null);
  const [initialDepositAmount, setInitialDepositAmount] = useState("");
  const [depositBookingKey, setDepositBookingKey] = useState("");

  useEffect(() => {
    api<{ items?: Array<{ id: string; title: string; startsAt?: string | null }> }>("/events")
      .then((r) => {
        const items = r.items || (r as unknown as { events?: typeof events }).events || [];
        setEvents(items);
        if (items[0]) setEventId(items[0].id);
      })
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkoutApi
      .cart(eventId || undefined)
      .then(({ cart: nextCart }) => {
        if (!cancelled) setCart(nextCart);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params: Record<string, string> = {};
    if (query.trim()) params.q = query.trim();
    if (typeFilter !== "ALL") params.type = typeFilter;

    marketplaceApi
      .list(params)
      .then((res) => {
        if (cancelled) return;
        setListings((res.items || []).map(mapApi));
        setSource(res.items?.length ? "live" : "empty");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setListings([]);
        setSource("empty");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, typeFilter]);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      const matchesCat =
        category === "All" ||
        l.category.toLowerCase().includes(category.toLowerCase()) ||
        (category === "Venue" && l.type === "VENUE");
      return matchesCat;
    });
  }, [listings, category]);

  const handleBook = async (listing: MarketListing) => {
    setBookingMsg("");
    setCheckoutMessage("");
    setCheckoutSession(null);
    try {
      const { cart: nextCart } = await checkoutApi.add(
        listing.id,
        1,
        eventId || undefined,
      );
      setCart(nextCart);
      setBookingMsg(`${listing.title} added to your cart. Review it and continue to secure checkout.`);
      onBook?.(listing);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to book";
      setBookingMsg(msg);
    }
  };


  const submitInitialBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!depositListing || !eventId) {
      setBookingMsg("Select an event before booking a service with an initial payment.");
      return;
    }
    const major = Number(initialDepositAmount);
    if (!Number.isFinite(major) || major <= 0 || major > Number.MAX_SAFE_INTEGER / 100) {
      setBookingMsg("Enter a valid positive initial payment amount.");
      return;
    }
    setCheckoutBusy(true); setBookingMsg("");
    try {
      const result = await paymentsApi.book({
        listingId: depositListing.id,
        quantity: 1,
        eventId,
        initialPaymentMinor: String(Math.round(major * 100)),
        idempotencyKey: depositBookingKey || `booking-${depositListing.id}-${Date.now()}`,
      }) as { booking?: { id: string; paidMinor: string; totalMinor: string } };
      const booking = result.booking;
      setBookingMsg(booking
        ? `Booking ${booking.id} created. ${formatMoney(booking.paidMinor, depositListing.currency, locale)} is protected in escrow; the remaining balance can be requested by the vendor in milestones.`
        : "Booking created with the initial payment held in escrow.");
      setDepositListing(null);
      setInitialDepositAmount("");
      setDepositBookingKey("");
    } catch (cause) {
      setBookingMsg(cause instanceof Error ? cause.message : "Unable to create booking with an initial payment.");
    } finally { setCheckoutBusy(false); }
  };
  const submitEnquiry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enquiryListing) return;
    setEnquiryNotice("");
    try {
      await api(`/listings/${enquiryListing.id}/enquiries`, { method: "POST", body: JSON.stringify({ message: enquiryMessage }) });
      setEnquiryNotice("Your enquiry has been sent to the vendor.");
      setEnquiryMessage("");
      setEnquiryListing(null);
    } catch (error) {
      setEnquiryNotice(error instanceof Error ? error.message : "Unable to send enquiry.");
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    setCheckoutMessage("");
    try {
      const { cart: nextCart } = await checkoutApi.update(itemId, quantity);
      setCart(nextCart);
      setCheckoutSession(null);
    } catch (e) {
      setCheckoutMessage(e instanceof Error ? e.message : "Unable to update cart.");
    }
  };

  const removeItem = async (itemId: string) => {
    setCheckoutMessage("");
    try {
      await checkoutApi.remove(itemId);
      setCart((current) =>
        current
          ? { ...current, items: current.items.filter((item) => item.id !== itemId) }
          : current,
      );
      setCheckoutSession(null);
    } catch (e) {
      setCheckoutMessage(e instanceof Error ? e.message : "Unable to remove item.");
    }
  };

  const createCheckout = async () => {
    if (!cart) return;
    setCheckoutBusy(true);
    setCheckoutMessage("");
    try {
      const { session } = await checkoutApi.createSession(
        cart.id,
        eventId || undefined,
      );
      setCheckoutSession(session);
    } catch (e) {
      setCheckoutMessage(e instanceof Error ? e.message : "Unable to start checkout.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  const payFromWallet = async () => {
    if (!checkoutSession) return;
    setCheckoutBusy(true);
    setCheckoutMessage("");
    try {
      const result = await checkoutApi.payWithWallet(
        checkoutSession.id,
        crypto.randomUUID(),
      );
      setCheckoutSession({ ...checkoutSession, status: "PAID" });
      setCart((current) =>
        current ? { ...current, status: "CHECKED_OUT", items: [] } : current,
      );
      setCheckoutMessage(
        `Payment secured in escrow. Booking${result.bookingIds.length === 1 ? "" : "s"}: ${result.bookingIds.join(", ") || "confirmed"}.`,
      );
    } catch (e) {
      setCheckoutMessage(e instanceof Error ? e.message : "Wallet payment was not completed.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  const restartCheckout = async () => {
    if (!checkoutSession) return;
    setCheckoutBusy(true);
    setCheckoutMessage("");
    try {
      await checkoutApi.cancelSession(checkoutSession.id);
      setCheckoutSession(null);
    } catch (e) {
      setCheckoutMessage(e instanceof Error ? e.message : "Unable to restart checkout.");
    } finally {
      setCheckoutBusy(false);
    }
  };

  return (
    <section className="ess-panel ess-marketplace">
      <section className="ess-marketplace-welcome" aria-labelledby="ess-marketplace-welcome-title">
        <div className="ess-marketplace-welcome-copy">
          <p className="ess-eyebrow">Your event, beautifully brought together</p>
          <h1 id="ess-marketplace-welcome-title">Welcome to your event marketplace.</h1>
          <p>Discover trusted event professionals, bring every detail into one plan, and keep bookings, conversations and payments connected from your first idea to event day.</p>
          <div className="ess-marketplace-welcome-actions"><a className="ess-primary" href="#ess-marketplace-catalog">Explore services <span aria-hidden="true">→</span></a><span className="ess-marketplace-welcome-note"><span aria-hidden="true">✓</span> One workspace for your whole event</span></div>
        </div>
        <div className="ess-marketplace-welcome-art" aria-label="EPHINTA event planning features">
          <div className="ess-marketplace-orbit ess-marketplace-orbit-one"></div><div className="ess-marketplace-orbit ess-marketplace-orbit-two"></div>
          <div className="ess-marketplace-feature-tile ess-marketplace-feature-main"><span>✦</span><small>YOUR EVENT, CONNECTED</small><strong>Idea to<br />celebration.</strong><em>Plan · Book · Celebrate</em></div>
          <div className="ess-marketplace-float ess-marketplace-float-top"><span>✓</span> Verified vendors</div><div className="ess-marketplace-float ess-marketplace-float-bottom"><span>◷</span> One clear timeline</div>
        </div>
      </section>
      <section className="ess-marketplace-capabilities" aria-label="What you can do with EPHINTA">
        <article className="ess-marketplace-capability"><span className="ess-marketplace-capability-icon">⌁</span><div><h3>Plan with confidence</h3><p>Build your event brief, organise tasks, manage your budget and keep important dates in view.</p></div></article>
        <article className="ess-marketplace-capability"><span className="ess-marketplace-capability-icon">◇</span><div><h3>Find the right people</h3><p>Explore venues, catering, décor, rentals and event services in one marketplace.</p></div></article>
        <article className="ess-marketplace-capability"><span className="ess-marketplace-capability-icon">↗</span><div><h3>Book with clarity</h3><p>Send enquiries, connect bookings to your event and follow payment milestones.</p></div></article>
        <article className="ess-marketplace-capability"><span className="ess-marketplace-capability-icon">◎</span><div><h3>Stay in control</h3><p>Coordinate guests, messages, checklists and service readiness from your workspace.</p></div></article>
      </section>
      <div className="ess-marketplace-journey" aria-label="Your EPHINTA journey"><span><b>01</b> Create your event</span><i aria-hidden="true">→</i><span><b>02</b> Discover providers</span><i aria-hidden="true">→</i><span><b>03</b> Manage bookings</span><i aria-hidden="true">→</i><span><b>04</b> Get event-ready</span></div>
      <div className="ess-marketplace-catalog-heading" id="ess-marketplace-catalog"><div><p className="ess-eyebrow">Make your next move</p><h2>Explore the marketplace</h2><p className="ess-muted">Browse available services or search for something specific to your event.</p></div></div>
      <div className="ess-wallet-badge" style={{ marginBottom: 12 }}>TEST MODE — bookings are for sandbox/demo verification until live payment mode is enabled.</div>
      <div className="ess-marketplace-head">
        <div>
          <p className="ess-eyebrow">{t(locale, "marketplace.title")}</p>
          <h2>Verified providers near your event</h2>
          <p className="ess-muted">
            Live catalog only — vendors you book appear on the go-live readiness board for verifier confirmation (all green by T−2h).
          </p>
          {events.length > 0 && (
            <label style={{ display: "block", marginTop: 10, maxWidth: 420 }}>
              Book against event (for verifier checklist)
              <select
                value={eventId}
                onChange={(e) => {
                  setEventId(e.target.value);
                  setCheckoutSession(null);
                  setCheckoutMessage("");
                }}
                style={{ display: "block", width: "100%", marginTop: 6 }}
              >
                <option value="">No event link</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                    {e.startsAt ? ` · ${new Date(e.startsAt).toLocaleString()}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <span className="ess-tag">{source === "live" ? "Live API" : "No listings yet"}</span>
      </div>

      <div className="ess-marketplace-controls">
        <input
          className="ess-search-input"
          type="search"
          placeholder={t(locale, "marketplace.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search marketplace"
        />
        <div className="ess-filter-row">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={category === c ? "ess-chip ess-chip-active" : "ess-chip"}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ess-filter-row">
          {(
            [
              ["ALL", "All types"],
              ["VENUE", "Venues"],
              ["SERVICE", "Services"],
              ["GOOD", "Goods"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={typeFilter === id ? "ess-chip ess-chip-active" : "ess-chip"}
              onClick={() => setTypeFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="ess-muted" style={{ marginBottom: 12 }}>
          API note: {error}
        </p>
      )}
      {bookingMsg && (
        <div
          className="ess-form-error"
          style={{
            background: "#052e16",
            borderColor: "#166534",
            color: "#86efac",
            marginBottom: 12,
          }}
        >
          {bookingMsg}
        </div>
      )}

      {cart && (
        <section className="ess-panel" aria-label="Cart and checkout">
          <div className="ess-section-title">
            <div>
              <p className="ess-eyebrow">Cart & secure checkout</p>
              <h2>Your cart ({cart.items.reduce((count, item) => count + item.quantity, 0)})</h2>
            </div>
          </div>
          {cart.items.length === 0 ? (
            <p className="ess-muted">Your cart is empty. Add a verified listing to begin.</p>
          ) : (
            <>
              <div className="ess-portal-stack">
                {cart.items.map((item) => (
                  <div className="ess-panel" key={item.id}>
                    <div className="ess-page-heading">
                      <div>
                        <strong>{item.title}</strong>
                        <p className="ess-muted">
                          {item.vendor || "Verified provider"} · {formatMoney(item.unitPriceMinor, item.currency as CurrencyCode, locale)} each
                        </p>
                      </div>
                      <div className="ess-filter-row">
                        <button
                          type="button"
                          className="ess-chip"
                          aria-label={`Decrease quantity of ${item.title}`}
                          disabled={checkoutBusy || item.quantity <= 1}
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          −
                        </button>
                        <span aria-live="polite">{item.quantity}</span>
                        <button
                          type="button"
                          className="ess-chip"
                          aria-label={`Increase quantity of ${item.title}`}
                          disabled={checkoutBusy}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="ess-quiet-button"
                          disabled={checkoutBusy}
                          onClick={() => removeItem(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <strong>{formatMoney(item.lineTotalMinor, item.currency as CurrencyCode, locale)}</strong>
                  </div>
                ))}
              </div>
              <p>
                Subtotal: <strong>{formatMoney(
                  cart.items.reduce((sum, item) => sum + BigInt(item.lineTotalMinor), 0n).toString(),
                  cart.currency as CurrencyCode,
                  locale,
                )}</strong>
              </p>
              <p className="ess-muted">
                If you pay by wallet, both parties are protected: funds remain in platform-controlled escrow until the event ends, all service checks are green, and its assigned lead verifier authorizes release.
              </p>
              {!checkoutSession && (
                <button
                  type="button"
                  className="ess-primary"
                  disabled={checkoutBusy || cart.items.length === 0}
                  onClick={createCheckout}
                >
                  {checkoutBusy ? "Preparing checkout…" : "Review secure checkout"}
                </button>
              )}
            </>
          )}

          {checkoutSession && checkoutSession.status !== "PAID" && (
            <div className="ess-panel">
              <p className="ess-eyebrow">Payment review · {checkoutSession.status}</p>
              <h3>{checkoutSession.items.length} service{checkoutSession.items.length === 1 ? "" : "s"}</h3>
              <p>Charge from ESS wallet: <strong>{formatMoney(checkoutSession.totalMinor, checkoutSession.currency as CurrencyCode, locale)}</strong></p>
              <p className="ess-muted">
                Checkout expires {new Date(checkoutSession.expiresAt).toLocaleString()}.
              </p>
              <p className="ess-muted">
                This API currently offers wallet checkout only. Card/provider checkout is not available through this checkout endpoint.
              </p>
              <button
                type="button"
                className="ess-primary"
                disabled={checkoutBusy}
                onClick={payFromWallet}
              >
                {checkoutBusy ? "Processing securely…" : "Pay from wallet · hold in escrow"}
              </button>
              <button
                type="button"
                className="ess-quiet-button"
                onClick={onOpenWallet}
              >
                Add wallet funds
              </button>
              <button
                type="button"
                className="ess-quiet-button"
                disabled={checkoutBusy}
                onClick={restartCheckout}
              >
                Cancel and review again
              </button>
            </div>
          )}
          {checkoutMessage && (
            <p className="ess-form-error" role="status">
              {checkoutMessage}
            </p>
          )}
        </section>
      )}

      {loading ? (
        <p className="ess-muted">Loading marketplace…</p>
      ) : filtered.length === 0 ? (
        <div className="ess-empty-state">
          <strong>No listings match your filters</strong>
          <p>Try a broader city or category. New verified vendors go live daily.</p>
        </div>
      ) : (
        <div className="ess-listing-grid">
          {filtered.map((l) => (
            <article key={l.id} className="ess-listing-card">
              <div className="ess-listing-art" aria-hidden>
                <span>{l.type === "VENUE" ? "◈" : l.type === "GOOD" ? "▦" : "✦"}</span>
              </div>
              <div className="ess-listing-body">
                <div className="ess-listing-meta">
                  <span className="ess-tag">{l.category}</span>
                  {l.verified && (
                    <span className="ess-verified" title="Verified business">
                      ✓ Verified
                    </span>
                  )}
                </div>
                <h3>{l.title}</h3>
                <p className="ess-listing-vendor">
                  {l.vendorName} · {l.city}, {l.country}
                </p>
                <p className="ess-muted" aria-label="Provider rating">
                  {l.reviews > 0
                    ? `★ ${l.rating.toFixed(1)} · ${l.reviews} review${l.reviews === 1 ? "" : "s"}`
                    : "No customer reviews yet"}
                </p>
                <div className="ess-listing-footer">
                  <div>
                    <strong>{formatMoney(l.priceMinor, l.currency, locale)}</strong>
                  </div>
                  <div className="ess-listing-actions">
                    <button className="ess-primary" type="button" onClick={() => handleBook(l)}>Add to cart</button>
                    <button className="ess-outline-button" type="button" disabled={!eventId} onClick={() => { setDepositListing(l); setInitialDepositAmount((Number(l.priceMinor) * 0.25 / 100).toFixed(2)); setDepositBookingKey(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `booking-${l.id}-${Date.now()}`); }}>Book with deposit</button>
                    <button className="ess-outline-button" type="button" onClick={() => { setEnquiryListing(l); setEnquiryNotice(""); }}>Enquire</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {depositListing && <div className="ess-modal-backdrop"><form className="ess-modal" onSubmit={submitInitialBooking}>
        <div className="ess-modal-header"><div><p className="ess-eyebrow">Protected booking</p><h2>{depositListing.title}</h2></div><button type="button" className="ess-close" onClick={() => setDepositListing(null)}>×</button></div>
        <p className="ess-muted">Full price: {formatMoney(depositListing.priceMinor,depositListing.currency,locale)}. Choose the initial amount to place in escrow. The vendor may request remaining milestone payments for your approval.</p>
        <label>Initial payment ({depositListing.currency})<input type="number" min="0.01" max={(Number(depositListing.priceMinor)/100).toFixed(2)} step="0.01" value={initialDepositAmount} onChange={(e) => setInitialDepositAmount(e.target.value)} required /></label>
        {bookingMsg && <p className="ess-form-error" role="alert">{bookingMsg}</p>}
        <button className="ess-primary" type="submit" disabled={checkoutBusy}>{checkoutBusy ? "Creating booking…" : "Confirm initial payment"}</button>
      </form></div>}
      {enquiryListing && <div className="ess-modal-backdrop"><form className="ess-modal" onSubmit={submitEnquiry}>
        <div className="ess-modal-header"><div><p className="ess-eyebrow">Contact vendor</p><h2>{enquiryListing.title}</h2></div><button type="button" className="ess-close" onClick={() => setEnquiryListing(null)}>×</button></div>
        <label>Your message<textarea required minLength={10} maxLength={4000} rows={5} value={enquiryMessage} onChange={event => setEnquiryMessage(event.target.value)} placeholder="Ask about availability, custom packages, or service details…" /></label>
        {enquiryNotice && <p className="ess-muted" role="status">{enquiryNotice}</p>}
        <button className="ess-primary" type="submit" disabled={enquiryMessage.trim().length < 10}>Send enquiry</button>
      </form></div>}
      {enquiryNotice && !enquiryListing && <p className="ess-muted" role="status">{enquiryNotice}</p>}
    </section>
  );
}
