import { useEffect, useState } from "react";
import { api } from "../lib/api";

type DspOverview = {
  tracks: Array<{ id: string; key: string; title: string; artist: string; assetUrl: string; plays: number; rightsOwner: { id: string; displayName: string; userId: string } | null }>;
  owners: Array<{ id: string; displayName: string; userId: string }>;
  usage: { plays: number; listenedSeconds: number };
  revenue: Array<{ id: string; source: string; amountMinor: string; currency: string; periodStart: string; periodEnd: string; reference: string }>;
  statements: Array<{ id: string; owner: string; currency: string; royaltyMinor: string; periodStart: string; periodEnd: string; status: string }>;
};

export default function MusicDspAdminPanel() {
  const [data, setData] = useState<DspOverview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [trackKey, setTrackKey] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [source, setSource] = useState("ADVERTISING");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [reference, setReference] = useState("");
  const [periodStart, setPeriodStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let active = true;
    api<DspOverview>("/music-dsp/admin/overview").then((result) => {
      if (active) {
        setData(result);
        setError("");
        if (!trackKey && result.tracks[0]) setTrackKey(result.tracks[0].key);
        if (!ownerId && result.owners[0]) setOwnerId(result.owners[0].id);
      }
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [refresh]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); setRefresh((v) => v + 1); }
    catch (e) { setError(e instanceof Error ? e.message : "Music DSP action failed."); }
    finally { setBusy(false); }
  };
  const selectedTrack = data?.tracks.find((t) => t.key === trackKey);
  const linkOwner = () => run(() => api("/music-dsp/admin/rights-owners", { method: "POST", body: JSON.stringify({ email: ownerEmail, displayName: ownerName }) }), "Rights-owner account linked.");
  const assignTrack = () => {
    if (!selectedTrack || !ownerId) return;
    return run(() => api("/music-dsp/admin/tracks", { method: "POST", body: JSON.stringify({ key: selectedTrack.key, title: selectedTrack.title, artist: selectedTrack.artist, assetUrl: selectedTrack.assetUrl, rightsOwnerId: ownerId }) }), "Track ownership saved.");
  };
  const recordRevenue = () => run(() => api("/music-dsp/admin/revenue", { method: "POST", body: JSON.stringify({ source, amountMinor: amount, currency, reference, periodStart: new Date(periodStart + "T00:00:00.000Z").toISOString(), periodEnd: new Date(periodEnd + "T23:59:59.999Z").toISOString() }) }), "DSP revenue recorded.");
  const generate = () => run(() => api("/music-dsp/admin/settlements/generate", { method: "POST", body: JSON.stringify({ periodStart: new Date(periodStart + "T00:00:00.000Z").toISOString(), periodEnd: new Date(periodEnd + "T23:59:59.999Z").toISOString() }) }), "25% rights-owner statements generated as pending.");

  return <section className="ess-panel">
    <div className="ess-section-title"><div><p className="ess-eyebrow">Music DSP operations</p><h2>Rights, revenue & statements</h2></div><button className="ess-outline-button" type="button" disabled={busy} onClick={() => setRefresh((v) => v + 1)}>Refresh</button></div>
    {error && <p className="ess-form-error" role="alert">{error}</p>}{notice && <p className="ess-toast" role="status">{notice}</p>}
    <div className="ess-metrics"><article className="ess-metric ess-metric-accent"><span>Recorded plays</span><strong>{data?.usage.plays ?? "—"}</strong><small>Authenticated app listening sessions</small></article><article className="ess-metric"><span>Listening time</span><strong>{Math.round((data?.usage.listenedSeconds ?? 0) / 60)} min</strong><small>Accumulated media playback time</small></article><article className="ess-metric"><span>Rights-owner share</span><strong>25%</strong><small>Of eligible net DSP revenue</small></article></div>
    <div className="ess-grid ess-grid-main">
      <section className="ess-card"><h3>Link a rights owner</h3><p className="ess-muted">Use an existing AFFILIATE account; no new registration flow is needed.</p><label className="ess-note-label">Account email<input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="rights-owner@example.com" /></label><label className="ess-note-label">Rights-holder display name<input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Artist or rights holder" /></label><button className="ess-primary" disabled={busy || !ownerEmail || !ownerName} onClick={() => void linkOwner()}>Link account</button></section>
      <section className="ess-card"><h3>Assign a track</h3><label className="ess-note-label">Track<select value={trackKey} onChange={(e) => setTrackKey(e.target.value)}>{(data?.tracks ?? []).map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}</select></label><label className="ess-note-label">Rights owner<select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>{(data?.owners ?? []).map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}</select></label><button className="ess-primary" disabled={busy || !selectedTrack || !ownerId} onClick={() => void assignTrack()}>Save track ownership</button></section>
    </div>
    <section className="ess-card"><h3>Record net DSP revenue</h3><p className="ess-muted">Enter the amount after taxes, refunds and third-party deductions. Amount is in minor units (kobo/cents).</p><div className="ess-form-grid"><label className="ess-note-label">Source<select value={source} onChange={(e) => setSource(e.target.value)}><option value="ADVERTISING">Advertising</option><option value="SPONSORSHIP">Sponsorship</option><option value="OTHER">Other</option></select></label><label className="ess-note-label">Amount in minor units<input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 2500000" /></label><label className="ess-note-label">Currency<select value={currency} onChange={(e) => setCurrency(e.target.value)}><option>NGN</option><option>USD</option><option>GBP</option><option>EUR</option></select></label><label className="ess-note-label">Unique reference<input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ad-network-2026-11" /></label><label className="ess-note-label">Period start<input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></label><label className="ess-note-label">Period end<input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></label></div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="ess-primary" disabled={busy || !/^[1-9][0-9]*$/.test(amount) || !reference} onClick={() => void recordRevenue()}>Record revenue</button><button className="ess-outline-button" disabled={busy || !periodStart || !periodEnd || periodEnd < periodStart} onClick={() => void generate()}>Generate 25% statements</button></div></section>
    <div className="ess-table-wrap"><table className="ess-table"><thead><tr><th>Track</th><th>Plays</th><th>Rights owner</th></tr></thead><tbody>{(data?.tracks ?? []).map((t) => <tr key={t.id}><td>{t.title}</td><td>{t.plays}</td><td>{t.rightsOwner?.displayName ?? "Unassigned"}</td></tr>)}</tbody></table></div>
    <small className="ess-muted">Statements remain pending. This MVP does not trigger bank or wallet payouts and does not invent advertising revenue.</small>
  </section>;
}
