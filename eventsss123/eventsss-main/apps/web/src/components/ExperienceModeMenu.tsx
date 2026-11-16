import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Mode = "demo" | "test" | "live";
type Props = { role: string };

const descriptions: Record<Mode, string> = {
  demo: "Practice with simulated money and demo-only rewards. No payouts.",
  test: "Exercise sandbox payment and event workflows. No real-money movement.",
  live: "Real users, real listings and production payments.",
};

export default function ExperienceModeMenu({ role }: Props) {
  const [mode, setMode] = useState<Mode>("test");
  const [selected, setSelected] = useState<Mode>("test");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await api<{ paymentMode: Mode }>("/runtime/config");
      setMode(result.paymentMode);
      setSelected(result.paymentMode);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read the active experience mode.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const apply = async () => {
    if (role !== "ADMIN" || selected === mode) return;
    if (selected === "live") {
      if (!window.confirm("Switch the entire EPHINTA platform to LIVE? Real payments and withdrawals may be initiated.")) return;
      const typed = window.prompt("Type LIVE to confirm production mode.");
      if (typed !== "LIVE") return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ paymentMode: Mode }>("/admin/runtime/payment-mode", {
        method: "PATCH",
        body: JSON.stringify({ paymentMode: selected }),
      });
      setMode(result.paymentMode);
      setSelected(result.paymentMode);
      setMessage(`Platform mode changed to ${result.paymentMode.toUpperCase()}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change the platform mode.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ess-mode-menu" aria-label="Platform experience mode">
      <div className="ess-menu-heading">
        <span>Experience mode</span>
        <small>Demo · Test · Live</small>
      </div>
      <label className="ess-mode-menu-control">
        <span>Platform mode</span>
        <select
          aria-label="Platform experience mode"
          value={selected}
          disabled={loading || saving || role !== "ADMIN"}
          onChange={(event) => setSelected(event.target.value as Mode)}
        >
          <option value="demo">Demo — simulated</option>
          <option value="test">Test — sandbox</option>
          <option value="live">Live — real transactions</option>
        </select>
      </label>
      <p className="ess-muted">{loading ? "Checking active mode…" : descriptions[mode]}</p>
      {role === "ADMIN" ? (
        <button className="ess-outline-button" type="button" disabled={loading || saving || selected === mode} onClick={() => void apply()}>
          {saving ? "Applying…" : "Apply platform mode"}
        </button>
      ) : (
        <small className="ess-muted">Mode changes are managed by an authorized administrator.</small>
      )}
      {error && <p className="ess-form-error" role="alert">{error}</p>}
      {message && <p className="ess-auth-notice" role="status">{message}</p>}
    </section>
  );
}
