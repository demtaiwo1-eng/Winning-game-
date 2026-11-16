import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type PublicListing = {
  id: string; title: string; description?: string | null; type: "VENUE" | "GOOD" | "SERVICE";
  priceMinor: string; currency: string; city?: string | null; country?: string | null;
  capacity?: number | null; mediaUrls: string[]; vendorName: string; vendorSlug: string;
  category: string; categorySlug: string;
};
type CatalogueResponse = { items: PublicListing[]; pagination: { page: number; take: number; total: number; totalPages: number } };
type DemoListing = { id: number; title: string; description: string; type: PublicListing["type"]; priceMinor: number; currency: string; city: string; country: string; category: string; provider: string };
const money = (minor: string | number, currency: string) => {
  const amount = Number(minor) / 100;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
};

// Synthetic catalogue records are deliberately labelled and never sent to the API or persisted.
const demoCategories = [
  { name: "Event venues", type: "VENUE" as const, titles: ["Garden celebration space", "Modern conference hall", "Rooftop event terrace", "Intimate party lounge"], base: 18000000 },
  { name: "Catering", type: "SERVICE" as const, titles: ["Buffet catering package", "Small-chops and canapé service", "Wedding dining service", "Corporate lunch package"], base: 4500000 },
  { name: "Photography", type: "SERVICE" as const, titles: ["Event photography coverage", "Photo and highlight video", "Portrait booth experience", "Full-day media coverage"], base: 2500000 },
  { name: "Decor and styling", type: "SERVICE" as const, titles: ["Elegant table styling", "Floral event decoration", "Stage and backdrop design", "Full venue transformation"], base: 3200000 },
  { name: "Event supplies", type: "GOOD" as const, titles: ["Guest seating package", "Premium tableware set", "Portable event lighting", "Celebration gift bundle"], base: 850000 },
  { name: "Music and entertainment", type: "SERVICE" as const, titles: ["Live music performance", "Professional event DJ", "Sound system package", "MC and host service"], base: 2800000 },
  { name: "Transport", type: "SERVICE" as const, titles: ["Guest shuttle service", "Executive event transfer", "Equipment logistics package", "Wedding convoy coordination"], base: 2200000 },
  { name: "Planning", type: "SERVICE" as const, titles: ["On-the-day coordination", "Full event planning support", "Guest management service", "Corporate event production"], base: 5000000 },
];
const demoCities = ["Ibadan", "Lagos", "Abuja", "Port Harcourt", "Enugu", "Kano", "Benin City", "Ilorin", "Abeokuta", "Uyo", "Accra", "Nairobi"];
const demoListings: DemoListing[] = Array.from({ length: 1200 }, (_, index) => {
  const category = demoCategories[index % demoCategories.length];
  const city = demoCities[Math.floor(index / 3) % demoCities.length];
  const title = category.titles[Math.floor(index / demoCategories.length) % category.titles.length];
  const priceMinor = Math.round(category.base * (0.72 + ((index * 37) % 67) / 100));
  return {
    id: index + 1, title: `${title} · Sample ${String(index + 1).padStart(4, "0")}`,
    description: "Illustrative demo listing for exploring EPHINTA filters and event-service workflows. This is not a real offer.",
    type: category.type, priceMinor, currency: city === "Accra" ? "GHS" : city === "Nairobi" ? "KES" : "NGN", city, country: city === "Accra" ? "Ghana" : city === "Nairobi" ? "Kenya" : "Nigeria",
    category: category.name, provider: `Demo provider ${String(index + 1).padStart(4, "0")}`,
  };
});

export default function PublicMarketplaceCatalogue() {
  const [items, setItems] = useState<PublicListing[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [catalogue, setCatalogue] = useState<"verified" | "demo">("verified");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (catalogue === "demo") { setLoading(false); setError(""); return; }
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
  }, [page, query, city, type, catalogue]);

  const filteredDemo = useMemo(() => demoListings.filter((item) => {
    const text = `${item.title} ${item.description} ${item.category} ${item.provider}`.toLowerCase();
    return (!query.trim() || text.includes(query.trim().toLowerCase()))
      && (!city.trim() || item.city.toLowerCase().includes(city.trim().toLowerCase()))
      && (!type || item.type === type);
  }), [query, city, type]);
  const demoTotalPages = Math.max(1, Math.ceil(filteredDemo.length / 24));
  const demoPageItems = filteredDemo.slice((page - 1) * 24, page * 24);
  const updateFilter = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(event.target.value); setPage(1);
  };
  const switchCatalogue = (next: "verified" | "demo") => { setCatalogue(next); setPage(1); setQuery(""); setCity(""); setType(""); };

  return (
    <main className="ess-content ess-public-marketplace"><section className="ess-shell">
      <div className="ess-page-heading"><div><p className="ess-eyebrow">EPHINTA marketplace</p>
        <h1>Discover event services</h1>
        <p className="ess-muted">Browse real verified providers or explore a separate sample catalogue before you sign up.</p></div>
        <div className="ess-filter-row"><Link className="ess-outline-button" to="/auth/signin?role=CLIENT&returnTo=%2Fmarketplace">Sign in</Link>
          <Link className="ess-primary" to="/auth/signup?role=CLIENT">Create account</Link></div>
      </div>
      <div className="ess-marketplace-catalogue-switch" role="group" aria-label="Choose marketplace catalogue">
        <button type="button" className={catalogue === "verified" ? "ess-primary" : "ess-outline-button"} aria-pressed={catalogue === "verified"} onClick={() => switchCatalogue("verified")}>Verified providers</button>
        <button type="button" className={catalogue === "demo" ? "ess-primary" : "ess-outline-button"} aria-pressed={catalogue === "demo"} onClick={() => switchCatalogue("demo")}>Explore demo catalogue</button>
      </div>
      {catalogue === "demo" && <aside className="ess-demo-catalogue-notice" role="note">
        <strong>DEMO CONTENT · 1,200 illustrative sample listings</strong>
        <p>These fictional examples help you test search and browsing. They are not real businesses, verified offers, available inventory or bookable services. No payment or booking can be made from this catalogue.</p>
      </aside>}
      <div className="ess-filter-row" role="search" aria-label="Filter marketplace">
        <label>Search listings<input value={query} onChange={updateFilter(setQuery)} placeholder="Venue, catering, photography…" /></label>
        <label>City<input value={city} onChange={updateFilter(setCity)} placeholder="e.g. Ibadan" /></label>
        <label>Type<select value={type} onChange={updateFilter(setType)}><option value="">All types</option><option value="VENUE">Venues</option><option value="SERVICE">Services</option><option value="GOOD">Goods</option></select></label>
      </div>
      {catalogue === "verified" ? <>
        <p className="ess-muted" aria-live="polite">{total.toLocaleString()} verified active listing{total === 1 ? "" : "s"}</p>
        {loading ? <p className="ess-muted">Loading marketplace…</p> : error ? <p className="ess-form-error" role="alert">{error}</p> : items.length === 0 ? (
          <div className="ess-empty-state"><strong>No verified listings match this search yet</strong><p>Try another city or explore the clearly labelled demo catalogue to preview the browsing experience.</p><button type="button" className="ess-outline-button" onClick={() => switchCatalogue("demo")}>Explore sample listings</button></div>
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
      </> : <>
        <p className="ess-muted" aria-live="polite">{filteredDemo.length.toLocaleString()} demo sample listing{filteredDemo.length === 1 ? "" : "s"}</p>
        {filteredDemo.length === 0 ? <div className="ess-empty-state"><strong>No sample listings match those filters</strong><p>Try a broader search or clear the city and type filters.</p></div> : <>
          <div className="ess-listing-grid">{demoPageItems.map((item) => <article className="ess-listing-card ess-demo-listing-card" key={item.id}>
            <div className="ess-listing-art" aria-hidden="true"><span>{item.type === "VENUE" ? "◈" : item.type === "GOOD" ? "▦" : "✦"}</span></div>
            <div className="ess-listing-body"><div className="ess-listing-meta"><span className="ess-tag">{item.category}</span><span className="ess-demo-label">DEMO ONLY</span></div>
              <h2>{item.title}</h2><p className="ess-listing-vendor">{item.provider} · {item.city}, {item.country}</p>
              <p className="ess-muted">{item.description}</p>
              <div className="ess-listing-footer"><strong>{money(item.priceMinor, item.currency)}</strong><span className="ess-demo-label">Not bookable</span></div>
            </div>
          </article>)}</div>
          {demoTotalPages > 1 && <nav className="ess-filter-row" aria-label="Demo catalogue pages">
            <button className="ess-outline-button" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span className="ess-muted">Page {page} of {demoTotalPages}</span>
            <button className="ess-outline-button" type="button" disabled={page >= demoTotalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </nav>}
        </>}
      </>}
    </section></main>
  );
}
