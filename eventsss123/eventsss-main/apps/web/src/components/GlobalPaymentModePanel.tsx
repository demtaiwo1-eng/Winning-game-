import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Mode = "demo" | "test" | "live";
type Snapshot = { paymentMode: Mode; updatedAt: string };

const modes: Array<{ value: Mode; title: string; description: string }> = [
  { value: "demo", title: "DEMO", description: "Simulated payments only. External bank withdrawals are blocked." },
  { value: "test", title: "TEST", description: "Provider sandbox workflows. No live-money movement." },
  { value: "live", title: "LIVE", description: "Production OPay transactions. Requires production readiness checks." },
];

export default function GlobalPaymentModePanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<Mode>("test");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await api<Snapshot>("/admin/runtime/payment-mode");
      setSnapshot(result);
      setSelected(result.paymentMode);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load central payment mode.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const apply = async () => {
    if (selected === "live" && confirmation.trim() !== "LIVE") {
      setError("Type LIVE in the confirmation field before enabling production payments.");
      return;
    }
    if (selected === "live" && !window.confirm("Enable LIVE OPay payments and real bank withdrawals for every connected EPHINTA app? This affects real money.")) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Snapshot>("/admin/runtime/payment-mode", {
        method: "PATCH",
        body: JSON.stringify({ paymentMode: selected }),
      });
      setSnapshot(result);
      setSelected(result.paymentMode);
      setConfirmation("");
      setNotice(`Central payment mode changed to ${result.paymentMode.toUpperCase()}. All connected API instances will use it on their next payment request.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to change central payment mode.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ess-panel" aria-labelledby="global-payment-mode-title">
      <p className="ess-eyebrow">Global controls</p>
      <h2 id="global-payment-mode-title">Central payment mode</h2>
      <p className="ess-muted">One server-controlled setting for every web, PWA and installed mobile client connected to this EPHINTA backend.</p>
      {loading ? <p className="ess-muted">Loading central mode…</p> : (
        <>
          <div className="ess-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
            {modes.map((mode) => (
              <label key={mode.value} className="ess-card" style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", border: selected === mode.value ? "2px solid var(--ess-accent, #2563eb)" : undefined }}>
                <input type="radio" name="global-payment-mode" value={mode.value} checked={selected === mode.value} onChange={() => setSelected(mode.value)} />
                <span><strong>{mode.title}</strong><br /><small>{mode.description}</small></span>
              </label>
            ))}
          </div>
          {selected === "live" && (
            <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
              Type LIVE to confirm production activation
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
            </label>
          )}
          {snapshot && <p className="ess-muted">Current mode: <strong>{snapshot.paymentMode.toUpperCase()}</strong> · Last changed {new Date(snapshot.updatedAt).toLocaleString()}</p>}
          {error && <p className="ess-form-error" role="alert">{error}</p>}
          {notice && <p className="ess-auth-notice" role="status">{notice}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ess-primary" type="button" disabled={saving || selected === snapshot?.paymentMode} onClick={() => void apply()}>{saving ? "Applying…" : "Apply globally"}</button>
            <button className="ess-outline-button" type="button" disabled={saving} onClick={() => void refresh()}>Refresh mode</button>
          </div>
        </>
      )}
    </section>
  );
}
