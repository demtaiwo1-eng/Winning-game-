import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type PublicListing = {
  id: string; title: string; description?: string | null; type: "VENUE" | "GOOD" | "SERVICE";
  priceMinor: string; currency: string; city?: string | null; country?: string | null;
  capacity?: number | null; mediaUrls: string[]; vendorName: string; vendorSlug: string;
  category: string; categorySlug: string;
};
type CatalogueResponse = { items: PublicListing[]; pagination: { page: number; take: number; total: number; totalPages: number } };
const money = (minor: string, currency: string) => {
  const amount = Number(minor) / 100;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
};

export default function PublicMarketplaceCatalogue() {
  const [items, setItems] = useState<PublicListing[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), take: "24" });
    if (query.trim()) params.set("q", query.trim());
    if (city.trim()) params.set("city", city.trim());
    if (type) params.set("type", type);
    api<CatalogueResponse>(`/marketplace/public?${params.toString()}`)
      .then((result) => {
        if (!active) return;
        setItems(result.items || []);
        setTotal(result.pagination?.total ?? 0);
        setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1));
      })
      .catch((reason: Error) => { if (active) setError(reason.message || "Unable to load the marketplace."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query, city, type]);

  const updateFilter = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(event.target.value); setPage(1);
  };

  return (
    <main className="ess-content ess-public-marketplace"><section className="ess-shell">
      <div className="ess-page-heading"><div><p className="ess-eyebrow">EPHINTA marketplace</p>
        <h1>Discover trusted event services</h1>
        <p className="ess-muted">Explore active listings from verified providers. Sign in when you are ready to enquire or book.</p></div>
        <div className="ess-filter-row"><Link className="ess-outline-button" to="/auth/signin?role=CLIENT&returnTo=%2Fmarketplace">Sign in to book</Link>
          <Link className="ess-primary" to="/auth/signup?role=CLIENT">Create account</Link></div>
      </div>
      <div className="ess-filter-row" role="search" aria-label="Filter marketplace">
        <label>Search listings<input value={query} onChange={updateFilter(setQuery)} placeholder="Venue, catering, photography…" /></label>
        <label>City<input value={city} onChange={updateFilter(setCity)} placeholder="e.g. Ibadan" /></label>
        <label>Type<select value={type} onChange={updateFilter(setType)}><option value="">All types</option><option value="VENUE">Venues</option><option value="SERVICE">Services</option><option value="GOOD">Goods</option></select></label>
      </div>
      <p className="ess-muted" aria-live="polite">{total.toLocaleString()} verified active listing{total === 1 ? "" : "s"}</p>
      {loading ? <p className="ess-muted">Loading marketplace…</p> : error ? <p className="ess-form-error" role="alert">{error}</p> : items.length === 0 ? (
        <div className="ess-empty-state"><strong>No listings found</strong><p>Try a different search or city.</p></div>
      ) : <div className="ess-listing-grid">{items.map((item) => <article className="ess-listing-card" key={item.id}>
        <div className="ess-listing-art" aria-hidden="true"><span>{item.type === "VENUE" ? "◈" : item.type === "GOOD" ? "▦" : "✦"}</span></div>
        <div className="ess-listing-body"><div className="ess-listing-meta"><span className="ess-tag">{item.category}</span><span className="ess-verified">✓ Verified provider</span></div>
          <h2>{item.title}</h2><p className="ess-listing-vendor">{item.vendorName} · {[item.city, item.country].filter(Boolean).join(", ")}</p>
          {item.description && <p className="ess-muted">{item.description}</p>}
          <div className="ess-listing-footer"><strong>{money(item.priceMinor, item.currency)}</strong><Link className="ess-outline-button" to="/auth/signin?role=CLIENT&returnTo=%2Fmarketplace">Sign in to enquire or book</Link></div>
        </div>
      </article>)}</div>}
      {!loading && totalPages > 1 && <nav className="ess-filter-row" aria-label="Marketplace pages">
        <button className="ess-outline-button" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <span className="ess-muted">Page {page} of {totalPages}</span>
        <button className="ess-outline-button" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </nav>}
    </section></main>
  );
}
