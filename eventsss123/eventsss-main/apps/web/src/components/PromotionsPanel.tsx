import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

type Mode = "vendor" | "admin";
type Promotion = {
  id: string;
  title: string;
  budgetMinor: string;
  spentMinor?: string;
  startsAt: string;
  endsAt: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
  paidAt?: string | null;
  approvedAt?: string | null;
  impressions?: number;
  clicks?: number;
  listing?: { id: string; title: string } | null;
};

function toMinorUnits(value: string): string | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const naira = BigInt(match[1]);
  const kobo = BigInt((match[2] || "").padEnd(2, "0") || "0");
  const amount = naira * 100n + kobo;
  return amount > 0n ? amount.toString() : null;
}

function money(minor: string): string {
  const amount = Number(minor) / 100;
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(amount)
    : "NGN —";
}

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function PromotionsPanel({ mode }: { mode: Mode }) {
  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [listingId, setListingId] = useState("");
  const [startsAt, setStartsAt] = useState(() => localDateTime(new Date()));
  const [endsAt, setEndsAt] = useState(() => localDateTime(new Date(Date.now() + 14 * 86400_000)));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ items: Promotion[] }>("/billing/promotions");
      setItems(result.items);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountMinor = toMinorUnits(budget);
    if (!amountMinor) {
      setError("Enter a valid positive NGN budget, for example 25000 or 25000.50.");
      return;
    }
    if (!title.trim() || new Date(endsAt) <= new Date(startsAt)) {
      setError("Add a campaign title and an end date later than its start date.");
      return;
    }
    setBusyId("create");
    setError("");
    setNotice("");
    try {
      await api("/billing/promotions", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          budgetMinor: amountMinor,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          ...(listingId.trim() ? { listingId: listingId.trim() } : {}),
        }),
      });
      setTitle("");
      setBudget("");
      setListingId("");
      setNotice("Campaign saved as DRAFT. Pay from your NGN wallet, then wait for administrator approval.");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create campaign");
    } finally {
      setBusyId("");
    }
  };

  const act = async (id: string, action: "pay" | "pause" | "approve" | "resume" | "end") => {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      if (action === "pay") {
        await api(`/billing/promotions/${id}/pay`, { method: "POST", body: "{}" });
        setNotice("Wallet payment recorded. The campaign is still unpublished until an administrator approves it.");
      } else if (action === "pause") {
        if (mode === "vendor") {
          await api(`/billing/promotions/${id}/pause`, { method: "POST", body: "{}" });
        } else {
          await api(`/billing/promotions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "PAUSED" }) });
        }
        setNotice("Campaign paused.");
      } else {
        const status = action === "approve" || action === "resume" ? "ACTIVE" : "ENDED";
        await api(`/billing/promotions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
        setNotice(status === "ACTIVE" ? "Campaign approved and active." : "Unpaid draft campaign ended.");
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Campaign action failed");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="ess-panel">
        <div className="ess-section-heading">
          <div>
            <p className="ess-eyebrow">{mode === "vendor" ? "Vendor marketing" : "Paid placement governance"}</p>
            <h2>{mode === "vendor" ? "Campaigns & promotions" : "Promotion approval queue"}</h2>
            <p className="ess-muted">
              {mode === "vendor"
                ? "Create a draft, pay from your verified NGN wallet, and wait for approval before it appears publicly."
                : "Review paid campaigns. Only exact matching wallet ledger payments can be approved."}
            </p>
          </div>
          <button className="ess-outline-button" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
        </div>
        {mode === "vendor" && (
          <form onSubmit={create} style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <label>
              Campaign title
              <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={120} required placeholder="e.g. December event package" />
            </label>
            <div className="ess-form-grid">
              <label>
                Budget (NGN)
                <input inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} required placeholder="25000.00" />
              </label>
              <label>
                Listing ID (optional)
                <input value={listingId} onChange={(event) => setListingId(event.target.value)} placeholder="Your listing ID" />
              </label>
              <label>
                Starts
                <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
              </label>
              <label>
                Ends
                <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
              </label>
            </div>
            <p className="ess-muted">The budget is prepaid from your NGN wallet. Creating a campaign does not publish it or charge you.</p>
            <button className="ess-primary" type="submit" disabled={busyId === "create"}>{busyId === "create" ? "Saving…" : "Save draft campaign"}</button>
          </form>
        )}
        {error && <p className="ess-form-error" role="alert">{error}</p>}
        {notice && <p className="ess-toast" role="status">{notice}</p>}
      </section>

      <section className="ess-panel">
        <div className="ess-section-heading">
          <div>
            <p className="ess-eyebrow">Campaign ledger</p>
            <h2>{mode === "vendor" ? "Your campaigns" : "All vendor campaigns"}</h2>
          </div>
          <span className="ess-muted">{items.length} total</span>
        </div>
        {loading ? <p className="ess-muted">Loading campaigns…</p> : items.length === 0 ? (
          <p className="ess-muted">No campaigns yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((item) => (
              <article className="ess-card" key={item.id} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="ess-muted">{item.listing?.title || "General vendor campaign"} · {money(item.budgetMinor)}</p>
                  </div>
                  <span className="ess-chip">{item.status}</span>
                </div>
                <small className="ess-muted">{new Date(item.startsAt).toLocaleString()} – {new Date(item.endsAt).toLocaleString()}</small>
                <small className="ess-muted">
                  {item.paidAt ? "Wallet paid" : "Not paid"} · {item.approvedAt ? "Approved" : "Awaiting approval"} · {(item.impressions || 0).toLocaleString()} impressions · {(item.clicks || 0).toLocaleString()} clicks
                </small>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {mode === "vendor" && item.status === "DRAFT" && !item.paidAt && (
                    <button className="ess-primary" type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "pay")}>{busyId === item.id ? "Processing…" : "Pay from wallet"}</button>
                  )}
                  {mode === "vendor" && item.status === "ACTIVE" && (
                    <button className="ess-outline-button" type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "pause")}>Pause campaign</button>
                  )}
                  {mode === "admin" && item.status === "DRAFT" && item.paidAt && (
                    <button className="ess-primary" type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "approve")}>Approve & publish</button>
                  )}
                  {mode === "admin" && item.status === "DRAFT" && !item.paidAt && (
                    <button className="ess-outline-button" type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "end")}>End unpaid draft</button>
                  )}
                  {mode === "admin" && item.status === "ACTIVE" && (
                    <button className="ess-outline-button" type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "pause")}>Pause</button>
                  )}
                  {mode === "admin" && item.status === "PAUSED" && (
                    <button className="ess-primary" type="button" disabled={busyId === item.id} onClick={() => void act(item.id, "resume")}>Resume</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
