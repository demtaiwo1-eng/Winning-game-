import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Mode = "demo" | "test" | "live";
type Props = { role: string };

const descriptions: Record<Mode, string> = {
  demo: "Practice with simulated money and demo-only rewards. No payouts.",
  test: "Exercise sandbox payment and event workflows. No real-money movement.",
  live: "Real users, real listings and production payments.",
};

const choices: Array<{ value: Mode; label: string; detail: string }> = [
  { value: "demo", label: "Demo", detail: "Simulated" },
  { value: "test", label: "Test", detail: "Sandbox" },
  { value: "live", label: "Live", detail: "Real transactions" },
];

export default function ExperienceModeMenu({ role }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [selected, setSelected] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ paymentMode: Mode }>("/runtime/config");
      if (!choices.some((choice) => choice.value === result.paymentMode)) {
        throw new Error("The server returned an unknown platform mode.");
      }
      setMode(result.paymentMode);
      setSelected(result.paymentMode);
    } catch (cause) {
      setMode(null);
      setSelected(null);
      setError(cause instanceof Error ? cause.message : "Unable to read the active experience mode.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const apply = async () => {
    if (role !== "ADMIN" || !selected || selected === mode) return;
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
        <small>Platform-wide payment and workflow environment</small>
      </div>
      <div className="ess-mode-menu__active" aria-live="polite">
        {loading ? "Checking active mode…" : mode ? `Active mode: ${mode.toUpperCase()}` : "Active mode unavailable"}
      </div>
      <div className="ess-mode-menu-control">
        <span id="ess-platform-mode-label">Choose mode</span>
        <div className="ess-mode-switch" role="group" aria-labelledby="ess-platform-mode-label">
          {choices.map(({ value, label, detail }) => (
            <button
              key={value}
              type="button"
              className={`ess-mode-choice ${selected === value ? "is-selected" : ""} ess-mode-choice--${value}`}
              aria-label={`${label}: ${detail}`}
              aria-pressed={selected === value}
              disabled={loading || saving || !!error || role !== "ADMIN"}
              onClick={() => { setSelected(value); setMessage(""); }}
            >
              <strong>{label}</strong>
              <small>{detail}</small>
            </button>
          ))}
        </div>
      </div>
      {mode && <p className="ess-muted">{descriptions[mode]}</p>}
      {role === "ADMIN" ? (
        <div className="ess-mode-menu__actions">
          <button className="ess-outline-button" type="button" disabled={loading || saving || !!error || !selected || selected === mode} onClick={() => void apply()}>
            {saving ? "Applying…" : "Apply platform mode"}
          </button>
          <button className="ess-mode-menu__refresh" type="button" disabled={loading || saving} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      ) : (
        <small className="ess-muted">Mode is visible to all accounts. Only an authorized administrator can change the platform-wide mode.</small>
      )}
      {error && <div className="ess-mode-menu__error" role="alert">{error}<button type="button" onClick={() => void refresh()}>Retry</button></div>}
      {message && <p className="ess-auth-notice" role="status">{message}</p>}
    </section>
  );
}
