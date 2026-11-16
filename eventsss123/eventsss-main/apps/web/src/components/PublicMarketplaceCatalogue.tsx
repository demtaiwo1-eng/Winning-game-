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
type DemoListing = { id: string; title: string; description: string; type: PublicListing["type"]; priceMinor: string; currency: string; city: string; country: string; vendorName: string; category: string };
const PAGE_SIZE = 24;
const money = (minor: string, currency: string) => {
  const amount = Number(minor) / 100;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
};

// Synthetic catalogue examples are generated locally. They are never written to
// the API/database and cannot be booked, enquired about, paid out or reviewed.
const demoTemplates: Array<Pick<DemoListing, "title" | "description" | "type" | "category" | "priceMinor">> = [
  { title: "Garden celebration venue", description: "Illustrative outdoor venue package for a sample event brief.", type: "VENUE", category: "Venues", priceMinor: "25000000" },
  { title: "Intimate reception hall", description: "Sample indoor event space with flexible seating options.", type: "VENUE", category: "Venues", priceMinor: "18000000" },
  { title: "Celebration catering package", description: "Example buffet package with configurable guest quantities.", type: "SERVICE", category: "Catering", priceMinor: "8500000" },
  { title: "Small-chops service", description: "Illustrative snack and small-chops service package.", type: "SERVICE", category: "Catering", priceMinor: "3200000" },
  { title: "Event photography coverage", description: "Sample photography coverage for a one-day celebration.", type: "SERVICE", category: "Photography", priceMinor: "4500000" },
  { title: "Live music and DJ", description: "Demo entertainment package; availability is not real.", type: "SERVICE", category: "Entertainment", priceMinor: "6000000" },
  { title: "Floral décor collection", description: "Example table and stage floral styling package.", type: "GOOD", category: "Décor", priceMinor: "2800000" },
  { title: "Stage and lighting setup", description: "Illustrative production and lighting bundle.", type: "SERVICE", category: "Production", priceMinor: "7200000" },
  { title: "Guest chair rental bundle", description: "Sample rental bundle for event planning practice.", type: "GOOD", category: "Rentals", priceMinor: "950000" },
  { title: "Bridal styling package", description: "Example beauty and styling service package.", type: "SERVICE", category: "Beauty", priceMinor: "2100000" },
];
const demoCities = ["Ibadan", "Lagos", "Abuja", "Port Harcourt", "Enugu", "Abeokuta", "Benin City", "Ilorin", "Kano", "Uyo"];
const demoListings: DemoListing[] = Array.from({ length: 2000 }, (_, index) => {
  const template = demoTemplates[index % demoTemplates.length];
  const city = demoCities[Math.floor(index / demoTemplates.length) % demoCities.length];
  const number = String(index + 1).padStart(4, "0");
  return {
    ...template, id: `demo-${number}`, title: template.title,
    description: template.description, city, country: "Nigeria",
    vendorName: `Demo provider ${number}`,
    priceMinor: String(Number(template.priceMinor) + (index % 7) * 125000),
    currency: "NGN",
  };
});

export default function PublicMarketplaceCatalogue() {
  const [mode, setMode] = useState<"verified" | "demo">("verified");
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
    if (mode !== "verified") { setLoading(false); setError(""); return; }
    let active = true;
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), take: String(PAGE_SIZE) });
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
  }, [mode, page, query, city, type]);

  const demoResults = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const c = city.trim().toLocaleLowerCase();
    return demoListings.filter((item) =>
      (!q || [item.title, item.description, item.category, item.vendorName, item.city].some((value) => value.toLocaleLowerCase().includes(q))) &&
      (!c || item.city.toLocaleLowerCase().includes(c)) &&
      (!type || item.type === type),
    );
  }, [query, city, type]);
  const visibleDemo = demoResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const demoPages = Math.max(1, Math.ceil(demoResults.length / PAGE_SIZE));

  const updateFilter = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(event.target.value); setPage(1);
  };
  const switchMode = (next: "verified" | "demo") => { setMode(next); setPage(1); };

  return (
    <main className="ess-content ess-public-marketplace"><section className="ess-shell">
      <div className="ess-page-heading"><div><p className="ess-eyebrow">EPHINTA marketplace</p>
        <h1>Discover event services</h1>
        <p className="ess-muted">Browse real verified providers, or explore a clearly labelled sample catalogue to practise planning.</p></div>
        <div className="ess-filter-row"><Link className="ess-outline-button" to="/auth/signin?role=CLIENT&returnTo=%2Fmarketplace">Sign in</Link>
          <Link className="ess-primary" to="/auth/signup?role=CLIENT">Create account</Link></div>
      </div>
      <div className="ess-marketplace-mode" role="group" aria-label="Marketplace catalogue mode">
        <button type="button" className={mode === "verified" ? "is-active" : ""} aria-pressed={mode === "verified"} onClick={() => switchMode("verified")}>Verified providers</button>
        <button type="button" className={mode === "demo" ? "is-active" : ""} aria-pressed={mode === "demo"} onClick={() => switchMode("demo")}>Demo showcase · 2,000 examples</button>
      </div>
      {mode === "demo" && <aside className="ess-marketplace-demo-notice" role="note"><strong>DEMO SHOWCASE — SIMULATED CONTENT</strong><span>These 2,000 sample cards are generated for practice. They are not real businesses, verified providers, available inventory or offers. Enquiries, bookings, reviews and payments are disabled in this mode.</span></aside>}
      <div className="ess-filter-row" role="search" aria-label="Filter marketplace">
        <label>Search listings<input value={query} onChange={updateFilter(setQuery)} placeholder="Venue, catering, photography…" /></label>
        <label>City<input value={city} onChange={updateFilter(setCity)} placeholder="e.g. Ibadan" /></label>
        <label>Type<select value={type} onChange={updateFilter(setType)}><option value="">All types</option><option value="VENUE">Venues</option><option value="SERVICE">Services</option><option value="GOOD">Goods</option></select></label>
      </div>
      {mode === "verified" ? <>
        <p className="ess-muted" aria-live="polite">{total.toLocaleString()} verified active listing{total === 1 ? "" : "s"}</p>
        {loading ? <p className="ess-muted">Loading marketplace…</p> : error ? <p className="ess-form-error" role="alert">{error}</p> : items.length === 0 ? (
          <div className="ess-empty-state"><strong>No verified listings are available yet</strong><p>Try the Demo showcase to explore sample services while verified providers join EPHINTA.</p><button className="ess-primary" type="button" onClick={() => switchMode("demo")}>Explore demo examples</button></div>
        ) : <div className="ess-listing-grid">{items.map((item) => <article className="ess-listing-card" key={item.id}>
          <div className="ess-listing-art" aria-hidden="true"><span>{item.type === "VENUE" ? "◈" : item.type === "GOOD" ? "▦" : "✦"}</span></div>
          <div className="ess-listing-body"><div className="ess-listing-meta"><span className="ess-tag">{item.category}</span><span className="ess-verified">✓ Verified provider</span></div>
            <h2>{item.title}</h2><p className="ess-listing-vendor">{item.vendorName} · {[item.city, item.country].filter(Boolean).join(", ")}</p>
            {item.description && <p className="ess-muted">{item.description}</p>}
            <div className="ess-listing-footer"><strong>{money(item.priceMinor, item.currency)}</strong><Link className="ess-outline-button" to="/auth/signin?role=CLIENT&returnTo=%2Fmarketplace">Sign in to enquire or book</Link></div>
          </div>
        </article>)}</div>}
        {!loading && totalPages > 1 && <nav className="ess-filter-row" aria-label="Marketplace pages"><button className="ess-outline-button" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="ess-muted">Page {page} of {totalPages}</span><button className="ess-outline-button" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></nav>}
      </> : <>
        <p className="ess-muted" aria-live="polite">{demoResults.length.toLocaleString()} simulated sample{demoResults.length === 1 ? "" : "s"}</p>
        {visibleDemo.length === 0 ? <div className="ess-empty-state"><strong>No sample matches</strong><p>Change your search, city or type filter.</p></div> : <div className="ess-listing-grid">{visibleDemo.map((item) => <article className="ess-listing-card ess-demo-listing" key={item.id}>
          <div className="ess-listing-art" aria-hidden="true"><span>{item.type === "VENUE" ? "◈" : item.type === "GOOD" ? "▦" : "✦"}</span></div>
          <div className="ess-listing-body"><div className="ess-listing-meta"><span className="ess-tag">{item.category}</span><span className="ess-demo-tag">DEMO EXAMPLE</span></div>
            <h2>{item.title}</h2><p className="ess-listing-vendor">{item.vendorName} · {item.city}, {item.country}</p><p className="ess-muted">{item.description}</p>
            <div className="ess-listing-footer"><strong>{money(item.priceMinor, item.currency)}</strong><span className="ess-demo-unavailable">Sample only · not bookable</span></div>
          </div>
        </article>)}</div>}
        {demoPages > 1 && <nav className="ess-filter-row" aria-label="Demo showcase pages"><button className="ess-outline-button" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="ess-muted">Page {page} of {demoPages}</span><button className="ess-outline-button" type="button" disabled={page >= demoPages} onClick={() => setPage((value) => value + 1)}>Next</button></nav>}
      </>}
    </section></main>
  );
}
