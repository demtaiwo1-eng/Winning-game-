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
        <small>Choose a safe operating environment</small>
      </div>
      <div className="ess-mode-menu-control">
        <span id="ess-platform-mode-label">Platform mode</span>
        <div className="ess-mode-switch" role="group" aria-labelledby="ess-platform-mode-label">
          {([
            ["demo", "Demo", "Simulated"],
            ["test", "Test", "Sandbox"],
            ["live", "Live", "Real transactions"],
          ] as const).map(([value, label, detail]) => (
            <button
              key={value}
              type="button"
              className={`ess-mode-choice ${selected === value ? "is-selected" : ""} ess-mode-choice--${value}`}
              aria-pressed={selected === value}
              disabled={loading || saving || role !== "ADMIN"}
              onClick={() => setSelected(value)}
            >
              <strong>{label}</strong>
              <small>{detail}</small>
            </button>
          ))}
        </div>
      </div>
      <p className="ess-muted">{loading ? "Checking active mode…" : descriptions[mode]}</p>
      {role === "ADMIN" ? (
        <button className="ess-outline-button" type="button" disabled={loading || saving || selected === mode} onClick={() => void apply()}>
          {saving ? "Applying…" : "Apply platform mode"}
        </button>
      ) : (
        <small className="ess-muted">Only an authorized administrator can change the platform-wide mode.</small>
      )}
      {error && <p className="ess-form-error" role="alert">{error}</p>}
      {message && <p className="ess-auth-notice" role="status">{message}</p>}
    </section>
  );
}
