import { useEffect, useState } from "react";
import { api } from "../lib/api";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt?: string | null;
  archivedAt?: string | null;
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

type Folder = "ACTIVE" | "ARCHIVED" | "ALL";
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
  const [folder, setFolder] = useState<Folder>("ACTIVE");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const refresh = async () => {
    setError("");
    try {
      const [notifications, saved] = await Promise.all([
        api<{ items: NotificationItem[] }>(`/notifications?limit=50&folder=${folder}`),
        api<{ preferences: Preferences }>("/notifications/preferences"),
      ]);
      setItems(notifications.items || []);
      setPreferences({ ...defaults, ...saved.preferences });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load notifications.");
    }
  };

  useEffect(() => { void refresh(); }, [folder]);

  const updatePreference = async (key: keyof Preferences, value: boolean) => {
    const previous = preferences;
    setPreferences({ ...preferences, [key]: value });
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
      setPreferences(previous);
      setError(reason instanceof Error ? reason.message : "Unable to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const mutate = async (id: string, action: "read" | "unread" | "archive" | "unarchive" | "delete") => {
    setWorkingId(id);
    setError("");
    setNotice("");
    try {
      if (action === "delete") {
        await api(`/notifications/${id}`, { method: "DELETE" });
      } else {
        await api(`/notifications/${id}/${action}`, { method: "PATCH", body: "{}" });
      }
      setItems((current) => {
        if (action === "delete" || (action === "archive" && folder !== "ALL") || (action === "unarchive" && folder === "ARCHIVED")) {
          return current.filter((item) => item.id !== id);
        }
        return current.map((item) => item.id !== id ? item : {
          ...item,
          ...(action === "read" ? { readAt: new Date().toISOString() } : {}),
          ...(action === "unread" ? { readAt: null } : {}),
          ...(action === "archive" ? { archivedAt: new Date().toISOString() } : {}),
          ...(action === "unarchive" ? { archivedAt: null } : {}),
        });
      });
      setNotice(action === "delete" ? "Notification deleted." : action === "archive" ? "Notification archived." : action === "unarchive" ? "Notification restored." : action === "read" ? "Marked as read." : "Marked as unread.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update notification.");
    } finally {
      setWorkingId(null);
    }
  };

  const markAllRead = async () => {
    setError("");
    try {
      await api("/notifications/read-all", { method: "POST", body: "{}" });
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setNotice("All notifications marked as read.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to mark notifications as read.");
    }
  };

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <section className="ess-panel ess-notifications-panel ess-notifications-workspace">
      <div className="ess-section-heading">
        <div>
          <p className="ess-eyebrow">Account updates</p>
          <h2>Notifications</h2>
          <p className="ess-muted">Manage event, payment and account updates. Push delivery is shown honestly when a device provider is not configured.</p>
        </div>
        <button type="button" className="ess-outline-button" disabled={saving} onClick={() => void refresh()}>Refresh</button>
      </div>
      {notice && <div className="ess-toast" role="status">{notice}</div>}
      {error && <div className="ess-form-error" role="alert">{error}</div>}
      <div className="ess-form-grid">
        {([
          ["inAppEnabled", "In-app notifications"],
          ["pushEnabled", "Push notifications (provider configuration required)"],
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
      <div className="ess-notification-toolbar">
        <div className="ess-filter-row" role="group" aria-label="Notification folder">
          {([
            ["ACTIVE", "Inbox"],
            ["ARCHIVED", "Archived"],
            ["ALL", "All"],
          ] as Array<[Folder, string]>).map(([value, label]) => (
            <button key={value} type="button" className={folder === value ? "ess-chip ess-chip-active" : "ess-chip"} onClick={() => setFolder(value)}>{label}</button>
          ))}
        </div>
        <div className="ess-notification-actions">
          <strong>{unreadCount} unread</strong>
          <button type="button" className="ess-outline-button" onClick={() => void markAllRead()} disabled={!items.some((item) => !item.readAt)}>Mark all read</button>
        </div>
      </div>
      <div className="ess-notification-list" aria-live="polite" style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {items.length === 0 && <p className="ess-muted">{folder === "ARCHIVED" ? "Nothing archived yet." : "No notifications in this folder."}</p>}
        {items.map((item) => (
          <article key={item.id} className="ess-wallet-card ess-notification-row" style={{ opacity: item.readAt ? 0.78 : 1, borderInlineStart: item.readAt ? undefined : "3px solid var(--ess-accent, #ed7b35)" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{item.title}</strong>
                <span className="ess-muted">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p>{item.body}</p>
              <div className="ess-muted">Push status: {item.deliveryStatus.replace(/_/g, " ").toLowerCase()}</div>
            </div>
            <div className="ess-notification-actions">
              {item.archivedAt ? (
                <button type="button" className="ess-quiet-button" disabled={workingId === item.id} onClick={() => void mutate(item.id, "unarchive")}>Restore</button>
              ) : (
                <button type="button" className="ess-quiet-button" disabled={workingId === item.id} onClick={() => void mutate(item.id, "archive")}>Archive</button>
              )}
              <button type="button" className="ess-quiet-button" disabled={workingId === item.id} onClick={() => void mutate(item.id, item.readAt ? "unread" : "read")}>{item.readAt ? "Mark unread" : "Mark read"}</button>
              <button type="button" className="ess-quiet-button" disabled={workingId === item.id} onClick={() => void mutate(item.id, "delete")}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
