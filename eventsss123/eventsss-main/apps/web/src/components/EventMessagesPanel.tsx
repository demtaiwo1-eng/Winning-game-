import { useEffect, useState } from "react";
import { api } from "../lib/api";

type EventOption = { id: string; title: string };
type Participant = { id: string; name: string; role: string };
type Folder = "ALL" | "INBOX" | "SENT" | "ARCHIVED";
type EventMessage = {
  id: string;
  groupId?: string;
  senderId: string;
  recipientId: string;
  recipientKind?: "TO" | "CC" | "BCC";
  toRecipientIds?: string[] | null;
  ccRecipientIds?: string[] | null;
  body: string;
  createdAt: string;
  readAt?: string | null;
  senderArchivedAt?: string | null;
  recipientArchivedAt?: string | null;
  sender: Participant;
  recipient: Participant;
};
type MessagePage = {
  items: EventMessage[];
  participants: Participant[];
  viewerId: string;
  nextBefore: string | null;
};

export default function EventMessagesPanel({ events, initialEventId }: { events: EventOption[]; initialEventId?: string }) {
  const [eventId, setEventId] = useState(initialEventId || "");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [toIds, setToIds] = useState<string[]>([]);
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [bccIds, setBccIds] = useState<string[]>([]);
  const [broadcast, setBroadcast] = useState(false);
  const [folder, setFolder] = useState<Folder>("ALL");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const currentEventId = events.some((event) => event.id === eventId) ? eventId : events[0]?.id ?? "";
  const otherParticipants = participants.filter((person) => person.id !== viewerId);

  useEffect(() => {
    if (initialEventId && events.some((event) => event.id === initialEventId)) setEventId(initialEventId);
  }, [initialEventId, events]);

  const load = async (active: boolean) => {
    if (!currentEventId) return;
    const page = await api<MessagePage>(`/events/${currentEventId}/messages?limit=50&folder=${folder}`);
    if (!active) return;
    setParticipants(page.participants);
    setViewerId(page.viewerId);
    setMessages(page.items || []);
    setNextBefore(page.nextBefore);
  };

  useEffect(() => {
    setParticipants([]);
    setViewerId("");
    setMessages([]);
    setNextBefore(null);
    setToIds([]);
    setCcIds([]);
    setBccIds([]);
    if (!currentEventId) return;
    let active = true;
    setEventId(currentEventId);
    setLoading(true);
    setError("");
    setNotice("");
    load(active).catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentEventId, refreshKey, folder]);

  useEffect(() => {
    if (!currentEventId) return;
    const interval = window.setInterval(() => {
      api<MessagePage>(`/events/${currentEventId}/messages?limit=50&folder=${folder}`)
        .then((page) => {
          setMessages((current) => {
            const byId = new Map(current.map((message) => [message.id, message]));
            for (const message of page.items) byId.set(message.id, message);
            return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
          });
          setParticipants(page.participants);
        })
        .catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [currentEventId, folder]);

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSending(true);
    try {
      const result = await api<{ items: EventMessage[] }>(`/events/${currentEventId}/messages`, {
        method: "POST",
        body: JSON.stringify(broadcast ? { body, broadcast: true } : { body, toIds, ccIds, bccIds }),
      });
      setMessages((current) => [...current, ...result.items].sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
      setBody("");
      setToIds([]);
      setCcIds([]);
      setBccIds([]);
      setNotice(`Message sent to ${result.items.length} participant${result.items.length === 1 ? "" : "s"}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send this message.");
    } finally {
      setSending(false);
    }
  };

  const loadEarlier = async () => {
    if (!nextBefore) return;
    setError("");
    try {
      const page = await api<MessagePage>(
        `/events/${currentEventId}/messages?limit=50&folder=${folder}&before=${encodeURIComponent(nextBefore)}`,
      );
      setMessages((current) => [...page.items, ...current]);
      setNextBefore(page.nextBefore);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load earlier messages.");
    }
  };

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleTo = (id: string) => { toggle(setToIds, id); setCcIds((current) => current.filter((item) => item !== id)); setBccIds((current) => current.filter((item) => item !== id)); };
  const toggleCc = (id: string) => { toggle(setCcIds, id); setToIds((current) => current.filter((item) => item !== id)); setBccIds((current) => current.filter((item) => item !== id)); };
  const toggleBcc = (id: string) => { toggle(setBccIds, id); setToIds((current) => current.filter((item) => item !== id)); setCcIds((current) => current.filter((item) => item !== id)); };

  const mutateMessage = async (message: EventMessage, action: "read" | "unread" | "archive" | "unarchive" | "delete") => {
    setWorkingId(message.id);
    setError("");
    setNotice("");
    try {
      if (action === "delete") {
        await api(`/events/${currentEventId}/messages/${message.id}`, { method: "DELETE" });
      } else {
        await api(`/events/${currentEventId}/messages/${message.id}/${action}`, { method: "PATCH", body: "{}" });
      }
      const isSent = message.senderId === viewerId;
      setMessages((current) => {
        const isTarget = (item: EventMessage) =>
          isSent ? Boolean(message.groupId && item.groupId === message.groupId) : item.id === message.id;
        if (action === "delete" || (action === "archive" && folder !== "ALL") || (action === "unarchive" && folder === "ARCHIVED")) {
          return current.filter((item) => !isTarget(item));
        }
        return current.map((item) => !isTarget(item) ? item : {
          ...item,
          ...(action === "read" ? { readAt: new Date().toISOString() } : {}),
          ...(action === "unread" ? { readAt: null } : {}),
          ...(action === "archive" ? (isSent
            ? { senderArchivedAt: new Date().toISOString() }
            : { recipientArchivedAt: new Date().toISOString() }) : {}),
          ...(action === "unarchive" ? (isSent
            ? { senderArchivedAt: null }
            : { recipientArchivedAt: null }) : {}),
        });
      });
      setNotice(action === "delete" ? "Message deleted from your mailbox." : action === "archive" ? "Message archived." : action === "unarchive" ? "Message restored." : action === "read" ? "Message marked as read." : "Message marked as unread.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this message.");
    } finally {
      setWorkingId(null);
    }
  };

  if (events.length === 0) {
    return (
      <section className="ess-panel">
        <h2>Event messages</h2>
        <p className="ess-muted">Create an event before messaging its participants.</p>
      </section>
    );
  }

  return (
    <section className="ess-panel ess-event-messages ess-messaging-workspace">
      <p className="ess-eyebrow">Event coordination</p>
      <h2>Messages</h2>
      <label>
        Event
        <select value={currentEventId} onChange={(event) => setEventId(event.target.value)}>
          {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      {error && <p className="ess-form-error" role="alert">{error}</p>}
      {notice && <p role="status" className="ess-muted">{notice}</p>}
      <div className="ess-message-toolbar">
        <div className="ess-filter-row" role="group" aria-label="Message folder">
          {([
            ["ALL", "All"],
            ["INBOX", "Inbox"],
            ["SENT", "Sent"],
            ["ARCHIVED", "Archived"],
          ] as Array<[Folder, string]>).map(([value, label]) => (
            <button key={value} type="button" className={folder === value ? "ess-chip ess-chip-active" : "ess-chip"} onClick={() => setFolder(value)}>{label}</button>
          ))}
        </div>
        <button className="ess-outline-button" type="button" disabled={loading} onClick={() => setRefreshKey((current) => current + 1)}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="ess-message-list" aria-live="polite" aria-busy={loading} style={{ display: "grid", gap: 8, maxHeight: 460, overflowY: "auto", margin: "16px 0" }}>
        {nextBefore && <button className="ess-outline-button" type="button" onClick={() => void loadEarlier()}>Load earlier messages</button>}
        {!loading && messages.length === 0 && <p className="ess-muted">No messages in this folder yet.</p>}
        {messages.map((message) => {
          const sent = message.senderId === viewerId;
          const archivedForViewer = sent ? Boolean(message.senderArchivedAt) : Boolean(message.recipientArchivedAt);
          const busy = workingId === message.id;
          const visibleTo = (message.toRecipientIds || []).map((id) => participants.find((person) => person.id === id)?.name || "Event participant").join(", ");
          const visibleCc = (message.ccRecipientIds || []).map((id) => participants.find((person) => person.id === id)?.name || "Event participant").join(", ");
          return (
            <article className="ess-wallet-card ess-message-row" key={message.id} style={{ justifySelf: sent ? "end" : "start", maxWidth: "min(100%, 700px)", width: "100%" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <strong>{sent ? `To: ${message.recipient.name}` : message.sender.name}</strong>
                  <small className="ess-muted">{new Date(message.createdAt).toLocaleString()}</small>
                </div>
                {!sent && visibleTo && <small className="ess-muted">To: {visibleTo}</small>}
                {visibleCc && <small className="ess-muted">CC: {visibleCc}</small>}
                <p>{message.body}</p>
                <small className="ess-muted">{sent ? `Recipient type: ${message.recipientKind || "TO"}` : message.readAt ? "Read" : "Unread"}</small>
              </div>
              <div className="ess-message-actions">
                {!sent && <button type="button" className="ess-quiet-button" disabled={busy} onClick={() => void mutateMessage(message, message.readAt ? "unread" : "read")}>{message.readAt ? "Mark unread" : "Mark read"}</button>}
                <button type="button" className="ess-quiet-button" disabled={busy} onClick={() => void mutateMessage(message, archivedForViewer ? "unarchive" : "archive")}>{archivedForViewer ? "Restore" : "Archive"}</button>
                <button type="button" className="ess-quiet-button" disabled={busy} onClick={() => void mutateMessage(message, "delete")}>Delete</button>
              </div>
            </article>
          );
        })}
      </div>
      <form onSubmit={(event) => void send(event)} style={{ display: "grid", gap: 12 }}>
        <fieldset className="ess-choice-group">
          <legend>Recipients</legend>
          <label>
            <input type="checkbox" checked={broadcast} onChange={(event) => setBroadcast(event.target.checked)} />
            Send to everyone involved in this event
          </label>
        </fieldset>
        {!broadcast && (
          <>
            <fieldset className="ess-choice-group">
              <legend>To · required</legend>
              {otherParticipants.map((person) => (
                <label key={person.id}>
                  <input type="checkbox" checked={toIds.includes(person.id)} onChange={() => toggleTo(person.id)} />
                  {person.name} · {person.role}
                </label>
              ))}
              {otherParticipants.length === 0 && <p className="ess-muted">No other event participants are available yet.</p>}
            </fieldset>
            <details className="ess-recipient-options">
              <summary>CC and BCC options</summary>
              <fieldset className="ess-choice-group">
                <legend>CC · visible to recipients</legend>
                {otherParticipants.filter((person) => !toIds.includes(person.id)).map((person) => (
                  <label key={person.id}>
                    <input type="checkbox" checked={ccIds.includes(person.id)} onChange={() => toggleCc(person.id)} />
                    {person.name} · {person.role}
                  </label>
                ))}
              </fieldset>
              <fieldset className="ess-choice-group">
                <legend>BCC · hidden from other recipients</legend>
                {otherParticipants.filter((person) => !toIds.includes(person.id) && !ccIds.includes(person.id)).map((person) => (
                  <label key={person.id}>
                    <input type="checkbox" checked={bccIds.includes(person.id)} onChange={() => toggleBcc(person.id)} />
                    {person.name} · {person.role}
                  </label>
                ))}
              </fieldset>
            </details>
          </>
        )}
        <label>
          Message
          <textarea value={body} maxLength={5000} rows={4} onChange={(event) => setBody(event.target.value)} required placeholder="Write a clear update for your event team…" />
        </label>
        <button className="ess-primary" type="submit" disabled={sending || loading || !body.trim() || (broadcast ? otherParticipants.length === 0 : toIds.length === 0)}>
          {sending ? "Sending…" : "Send message"}
        </button>
      </form>
    </section>
  );
}

export function VendorEventMessagesPanel() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items: Array<{ event: EventOption | null }> }>("/payments/bookings?as=vendor")
      .then((result) => {
        setError("");
        setEvents([...new Map(
          result.items.flatMap((booking) => booking.event ? [[booking.event.id, booking.event] as const] : []),
        ).values()]);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <>
      {error && <p className="ess-form-error" role="alert">{error}</p>}
      <EventMessagesPanel events={events} />
    </>
  );
}
