import { useEffect, useRef, useState } from "react";
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
  { id: "venues", icon: "⌂", eyebrow: "VENUES", title: "Venues & spaces", description: "Find a setting that fits your occasion." },
  { id: "catering", icon: "✦", eyebrow: "FOOD & EXPERIENCES", title: "Catering & treats", description: "Bring everyone together around the table." },
  { id: "photography", icon: "◉", eyebrow: "PHOTO & VIDEO", title: "Capture the moments", description: "Find photographers and creative teams." },
  { id: "production", icon: "◇", eyebrow: "DECOR & PRODUCTION", title: "Decor & production", description: "Browse decor, rentals, sound and lighting." },
] as const;

function locationLabel(city?: string | null, country?: string | null): string {
  return [city, country].filter(Boolean).join(", ");
}

/** Compact, touch-friendly Marketplace and approved-promotion carousel. */
export default function MarketplaceAdStrip() {
  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);
  const rail = useRef<HTMLDivElement>(null);

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
      .catch(() => { if (!cancelled) setPromotions([]); });
    return () => { cancelled = true; };
  }, []);

  const move = (direction: -1 | 1) => {
    rail.current?.scrollBy({ left: direction * Math.max(220, rail.current.clientWidth * 0.72), behavior: "smooth" });
  };

  return (
    <section className="eph-portal-marketplace eph-portal-marketplace-compact" aria-label="EPHINTA Marketplace and featured advertising">
      <div className="eph-portal-marketplace-heading">
        <div>
          <span className="eph-portal-marketplace-kicker">DISCOVER · CONNECT · CELEBRATE</span>
          <h2>Discover the EPHINTA Marketplace</h2>
          <p>Featured services and approved vendor promotions.</p>
        </div>
        <a href="/marketplace" className="eph-portal-marketplace-cta">Explore <span aria-hidden="true">→</span></a>
      </div>
      <div className="eph-portal-carousel-controls" aria-label="Marketplace carousel controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous Marketplace cards">‹</button>
        <button type="button" onClick={() => move(1)} aria-label="Next Marketplace cards">›</button>
      </div>
      <div ref={rail} className="eph-portal-ad-scroll eph-portal-ad-carousel" role="list" aria-label="Swipe or scroll through Marketplace categories and sponsored offers">
        {promotions.map((promotion) => (
          <article className="eph-portal-ad-card eph-portal-ad-card-sponsored" role="listitem" key={promotion.id}>
            <small>SPONSORED · APPROVED VENDOR</small>
            <strong>{promotion.title}</strong>
            <p>{promotion.description || `${promotion.vendorName} is featuring an event service on EPHINTA.`}</p>
            <div className="eph-portal-ad-meta">
              <span>{promotion.vendorName}</span>
              {promotion.listingTitle && <span>{promotion.listingTitle}</span>}
              {locationLabel(promotion.city, promotion.country) && <span>{locationLabel(promotion.city, promotion.country)}</span>}
            </div>
            <a href="/marketplace">View offer <span aria-hidden="true">→</span></a>
          </article>
        ))}
        {MARKETPLACE_CATEGORIES.map((item) => (
          <article className="eph-portal-ad-card" role="listitem" key={item.id}>
            <span className="eph-portal-ad-icon" aria-hidden="true">{item.icon}</span>
            <small>{item.eyebrow}</small>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
            <a href="/marketplace">Explore <span aria-hidden="true">→</span></a>
          </article>
        ))}
      </div>
      <div className="eph-portal-marketplace-footer">
        <span>{promotions.length ? `${promotions.length} approved vendor promotion${promotions.length === 1 ? "" : "s"} featured` : "Explore Marketplace categories; approved vendor campaigns appear when active."}</span>
        <span>Swipe to browse</span>
      </div>
    </section>
  );
}
