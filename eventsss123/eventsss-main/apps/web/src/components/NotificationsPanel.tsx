import { useEffect, useState } from "react";
import { api } from "../lib/api";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  deliveryStatus: string;
};

type Preferences = {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  messages: boolean;
  bookings: boolean;
  payments: boolean;
  marketing: boolean;
};

const defaults: Preferences = {
  inAppEnabled: true,
  pushEnabled: false,
  messages: true,
  bookings: true,
  payments: true,
  marketing: false,
};

export default function NotificationsPanel() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setError("");
    try {
      const [notifications, saved] = await Promise.all([
        api<{ items: NotificationItem[] }>("/notifications?limit=50"),
        api<{ preferences: Preferences }>("/notifications/preferences"),
      ]);
      setItems(notifications.items || []);
      setPreferences({ ...defaults, ...saved.preferences });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load notifications.");
    }
  };

  useEffect(() => { void refresh(); }, []);

  const updatePreference = async (key: keyof Preferences, value: boolean) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const result = await api<{ preferences: Preferences }>("/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      setPreferences({ ...defaults, ...result.preferences });
      setNotice("Notification preferences saved.");
      if (key === "inAppEnabled" && !value) setItems([]);
    } catch (reason) {
      setPreferences(preferences);
      setError(reason instanceof Error ? reason.message : "Unable to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH", body: "{}" });
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update notification.");
    }
  };

  const markAllRead = async () => {
    try {
      await api("/notifications/read-all", { method: "POST", body: "{}" });
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to mark notifications as read.");
    }
  };

  return (
    <section className="ess-panel">
      <div className="ess-section-heading">
        <div>
          <p className="ess-eyebrow">Account updates</p>
          <h2>Notifications</h2>
          <p className="ess-muted">In-app updates are private to your account. Push delivery remains unavailable until a provider is configured.</p>
        </div>
        <button type="button" className="ess-outline-button" onClick={() => void refresh()}>Refresh</button>
      </div>
      {notice && <div className="ess-toast">{notice}</div>}
      {error && <div className="ess-form-error">{error}</div>}
      <div className="ess-form-grid">
        {([
          ["inAppEnabled", "In-app notifications"],
          ["pushEnabled", "Push notifications (provider not configured)"],
          ["messages", "Messages"],
          ["bookings", "Bookings"],
          ["payments", "Payments"],
          ["marketing", "Marketing updates"],
        ] as Array<[keyof Preferences, string]>).map(([key, label]) => (
          <label className="ess-note-label" key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={preferences[key]} disabled={saving} onChange={(event) => void updatePreference(key, event.target.checked)} />
            {label}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
        <strong>{items.filter((item) => !item.readAt).length} unread</strong>
        <button type="button" className="ess-outline-button" onClick={() => void markAllRead()} disabled={!items.some((item) => !item.readAt)}>Mark all read</button>
      </div>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {items.length === 0 && <p className="ess-muted">No notifications yet.</p>}
        {items.map((item) => (
          <article key={item.id} className="ess-wallet-card" style={{ opacity: item.readAt ? 0.72 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <strong>{item.title}</strong>
              <span className="ess-muted">{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            <p>{item.body}</p>
            <div className="ess-muted">Push status: {item.deliveryStatus.replace(/_/g, " ").toLowerCase()}</div>
            {!item.readAt && <button type="button" className="ess-quiet-button" onClick={() => void markRead(item.id)}>Mark read</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
