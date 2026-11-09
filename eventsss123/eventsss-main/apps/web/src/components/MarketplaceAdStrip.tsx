import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

type PublicPromotion = {
  id: string;
  title: string;
  vendorName: string;
  listingTitle?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
};

const MARKETPLACE_CATEGORIES = [
  { id: "venues", icon: "⌂", eyebrow: "VENUES & SPACES", title: "Find a setting that fits your occasion", description: "Explore event spaces, halls, outdoor venues and locations for gatherings of every size." },
  { id: "catering", icon: "✦", eyebrow: "FOOD & EXPERIENCES", title: "Bring everyone together around the table", description: "Discover catering teams, cakes, drinks and hospitality services for your event." },
  { id: "photography", icon: "◉", eyebrow: "PHOTO & VIDEO", title: "Keep the moments worth remembering", description: "Find photographers, videographers and creative teams to capture your occasion." },
  { id: "production", icon: "◇", eyebrow: "DECOR & PRODUCTION", title: "Give your ideas a memorable finish", description: "Browse décor, rentals, sound, lighting, staging and event production services." },
] as const;

function locationLabel(city?: string | null, country?: string | null): string {
  return [city, country].filter(Boolean).join(", ");
}

/** Shared Marketplace advertising strip for every authenticated workspace. */
export default function MarketplaceAdStrip() {
  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/billing/public-promotions"))
      .then(async (response) => {
        if (!response.ok) throw new Error("Promotions are temporarily unavailable.");
        const payload: unknown = await response.json();
        const items = payload && typeof payload === "object" && "items" in payload
          ? (payload as { items?: unknown }).items
          : [];
        if (!cancelled) setPromotions(Array.isArray(items) ? items as PublicPromotion[] : []);
      })
      .catch(() => {
        if (!cancelled) setPromotions([]);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="eph-portal-marketplace" aria-label="EPHINTA Marketplace promotions">
      <div className="eph-portal-marketplace-heading">
        <div>
          <span className="eph-portal-marketplace-kicker">DISCOVER · CONNECT · CELEBRATE</span>
          <h2>Explore the EPHINTA Marketplace</h2>
          <p>Discover event professionals, useful services and featured vendor offers.</p>
        </div>
        <a href="/" className="eph-portal-marketplace-cta">Explore EPHINTA <span aria-hidden="true">→</span></a>
      </div>
      <div className="eph-portal-ad-scroll" role="list" aria-label="Horizontally scrollable Marketplace categories and sponsored offers">
        {promotions.map((promotion) => (
          <article className="eph-portal-ad-card eph-portal-ad-card-sponsored" role="listitem" key={promotion.id}>
            <small>Sponsored · Approved vendor</small>
            <strong>{promotion.title}</strong>
            <p>{promotion.description || `${promotion.vendorName} is featuring an event service on EPHINTA.`}</p>
            <div className="eph-portal-ad-meta">
              <span>{promotion.vendorName}</span>
              {promotion.listingTitle && <span>{promotion.listingTitle}</span>}
              {locationLabel(promotion.city, promotion.country) && <span>{locationLabel(promotion.city, promotion.country)}</span>}
            </div>
            <a href="/">Discover offer <span aria-hidden="true">→</span></a>
          </article>
        ))}
        {MARKETPLACE_CATEGORIES.map((item) => (
          <article className="eph-portal-ad-card" role="listitem" key={item.id}>
            <span className="eph-portal-ad-icon" aria-hidden="true">{item.icon}</span>
            <small>{item.eyebrow}</small>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <a href="/">Explore services <span aria-hidden="true">→</span></a>
          </article>
        ))}
      </div>
      <div className="eph-portal-marketplace-footer">
        <span>{promotions.length ? `${promotions.length} approved vendor promotion${promotions.length === 1 ? "" : "s"} currently featured` : "Marketplace categories are available; approved vendor campaigns appear here when active."}</span>
        <span>Swipe or scroll to see more →</span>
      </div>
    </section>
  );
}
