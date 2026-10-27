import { useEffect, useState } from "react";
import { api } from "../lib/api";

type VerifierCard = {
  id: string;
  name: string;
  headline?: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  jobsCompleted: number;
  ratingAvg: number;
  ratingCount: number;
  specialties: string[];
  distanceKm: number | null;
  tier: string;
};

type Review = {
  rating: number;
  comment?: string | null;
  authorName: string;
  createdAt: string;
};

const TIER_LABEL: Record<string, string> = {
  TOP_LOCAL: "Top · closest",
  NEARBY: "Nearby",
  SAME_CITY: "Same city",
  STANDARD: "Available",
};

export default function VerifierPicker({
  eventId,
  city,
  country,
  lat,
  lng,
}: {
  eventId?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
}) {
  const [items, setItems] = useState<VerifierCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{
    profile: VerifierCard & { bio?: string | null; isAvailable?: boolean };
    reviews: Review[];
  } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    const q = new URLSearchParams();
    if (eventId) q.set("eventId", eventId);
    if (city) q.set("city", city);
    if (country) q.set("country", country);
    if (lat != null) q.set("lat", String(lat));
    if (lng != null) q.set("lng", String(lng));
    api<{ items: VerifierCard[] }>(`/readiness/verifiers/directory?${q}`)
      .then((r) => setItems(r.items || []))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
  }, [eventId, city, country, lat, lng]);

  const openPopup = async (id: string) => {
    try {
      const res = await api<{
        profile: VerifierCard & { bio?: string | null };
        reviews: Review[];
      }>(`/readiness/verifiers/${id}/profile`);
      setDetail(res);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not load profile");
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const confirmSelect = async () => {
    if (!eventId || selected.size === 0) {
      setMsg("Create/select an event and pick at least one verifier.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await api<{ notified: number }>(`/readiness/events/${eventId}/select-verifiers`, {
        method: "POST",
        body: JSON.stringify({ verifierIds: [...selected], zone: "GENERAL" }),
      });
      setMsg(`${res.notified} verifier(s) selected and notified.`);
      setSelected(new Set());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Selection failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ess-panel">
      <p className="ess-eyebrow">Choose verifiers early</p>
      <h2>Verifier directory</h2>
      <p className="ess-muted">
        Closest to your event location rank first (Top local → Nearby → Same city). Open a card for bio,
        ratings from past jobs, and specialties. Selected verifiers get an in-app (and push) notification.
      </p>
      {!eventId && (
        <p className="ess-form-error" style={{ marginTop: 12 }}>
          Set a readiness event id (or create an event first) to confirm selection.
        </p>
      )}
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {items.length === 0 && (
          <p className="ess-muted">No verifier profiles yet. Verifiers should complete their location profile.</p>
        )}
        {items.map((v) => (
          <div
            key={v.id}
            className="ess-card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              border: "1px solid #1e2430",
              background: "#0b0d12",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{v.name}</strong>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: v.tier === "TOP_LOCAL" ? "rgba(16,185,129,.2)" : "rgba(148,163,184,.12)",
                    color: v.tier === "TOP_LOCAL" ? "#34d399" : "#94a3b8",
                  }}
                >
                  {TIER_LABEL[v.tier] || v.tier}
                </span>
                {v.distanceKm != null && (
                  <span className="ess-muted" style={{ fontSize: 12 }}>
                    {v.distanceKm} km
                  </span>
                )}
              </div>
              <p className="ess-muted" style={{ fontSize: 13, marginTop: 4 }}>
                {v.headline || "Readiness verifier"}
                {v.city ? ` · ${v.city}` : ""}
                {v.country ? `, ${v.country}` : ""}
              </p>
              <p style={{ fontSize: 13, marginTop: 6 }}>
                ★ {v.ratingAvg.toFixed(1)} ({v.ratingCount}) · {v.jobsCompleted} jobs
                {v.specialties?.length ? ` · ${v.specialties.join(", ")}` : ""}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button type="button" className="ess-outline-button" onClick={() => openPopup(v.id)}>
                Details
              </button>
              <button
                type="button"
                className={selected.has(v.id) ? "ess-primary" : "ess-outline-button"}
                onClick={() => toggle(v.id)}
              >
                {selected.has(v.id) ? "Selected" : "Select"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="ess-primary"
        style={{ marginTop: 16 }}
        disabled={busy || selected.size === 0 || !eventId}
        onClick={confirmSelect}
      >
        {busy ? "Notifying…" : `Confirm ${selected.size || ""} verifier(s) & notify`}
      </button>
      {msg && (
        <div
          className="ess-form-error"
          style={{ marginTop: 12, background: "#052e16", borderColor: "#166534", color: "#86efac" }}
        >
          {msg}
        </div>
      )}

      {detail && (
        <div
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.75)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => setDetail(null)}
        >
          <div
            className="ess-panel"
            style={{ maxWidth: 420, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="ess-eyebrow">Verifier profile</p>
            <h2>{detail.profile.name}</h2>
            <p className="ess-muted">{detail.profile.headline}</p>
            <p style={{ marginTop: 10, fontSize: 14 }}>{detail.profile.bio || "No bio yet."}</p>
            <p style={{ marginTop: 10, fontSize: 13 }}>
              ★ {Number(detail.profile.ratingAvg || 0).toFixed(1)} · {detail.profile.jobsCompleted} completed
              jobs
            </p>
            <h3 style={{ marginTop: 16, fontSize: 14 }}>Ratings from other jobs</h3>
            {detail.reviews.length === 0 && <p className="ess-muted">No reviews yet.</p>}
            {detail.reviews.map((r, i) => (
              <div key={i} style={{ borderTop: "1px solid #1e2430", padding: "8px 0", fontSize: 13 }}>
                <strong>★ {r.rating}</strong> · {r.authorName}
                <div className="ess-muted">{r.comment || "—"}</div>
              </div>
            ))}
            <button type="button" className="ess-outline-button" style={{ marginTop: 12 }} onClick={() => setDetail(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
