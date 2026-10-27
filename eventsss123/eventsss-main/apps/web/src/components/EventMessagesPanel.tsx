import { useEffect, useState } from "react";
import { api } from "../lib/api";

type EventOption = { id: string; title: string };
type Participant = { id: string; name: string; role: string };
type EventMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  sender: Participant;
  recipient: Participant;
};
type MessagePage = {
  items: EventMessage[];
  participants: Participant[];
  viewerId: string;
  nextBefore: string | null;
};

export default function EventMessagesPanel({ events }: { events: EventOption[] }) {
  const [eventId, setEventId] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [broadcast, setBroadcast] = useState(true);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const currentEventId = events.some((event) => event.id === eventId) ? eventId : events[0]?.id ?? "";
  const otherParticipants = participants.filter((person) => person.id !== viewerId);

  useEffect(() => {
    setParticipants([]);
    setViewerId("");
    setMessages([]);
    setNextBefore(null);
    setRecipientIds([]);
    if (!currentEventId) {
      return;
    }

    let active = true;
    setEventId(currentEventId);
    setLoading(true);
    setError("");
    setNotice("");
    api<MessagePage>(`/events/${currentEventId}/messages?limit=50`)
      .then((page) => {
        if (!active) return;
        setParticipants(page.participants);
        setViewerId(page.viewerId);
        setMessages(page.items);
        setNextBefore(page.nextBefore);
        api(`/events/${currentEventId}/messages/read`, { method: "PATCH" })
          .catch((reason: Error) => {
            if (active) setError(reason.message);
          });
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentEventId, refreshKey]);

  useEffect(() => {
    if (!currentEventId) return;
    const interval = window.setInterval(() => {
      api<MessagePage>(`/events/${currentEventId}/messages?limit=50`)
        .then((page) => {
          setMessages((current) => {
            const byId = new Map(current.map((message) => [message.id, message]));
            for (const message of page.items) byId.set(message.id, message);
            return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
          });
          setParticipants(page.participants);
        })
        .catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [currentEventId]);

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSending(true);
    try {
      const result = await api<{ items: EventMessage[] }>(`/events/${currentEventId}/messages`, {
        method: "POST",
        body: JSON.stringify(broadcast ? { body, broadcast: true } : { body, recipientIds }),
      });
      setMessages((current) => {
        const byId = new Map(current.map((message) => [message.id, message]));
        for (const message of result.items) byId.set(message.id, message);
        return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      });
      setBody("");
      setNotice(`Message sent to ${result.items.length} event participant${result.items.length === 1 ? "" : "s"}.`);
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
        `/events/${currentEventId}/messages?limit=50&before=${encodeURIComponent(nextBefore)}`,
      );
      setMessages((current) => [...page.items, ...current]);
      setNextBefore(page.nextBefore);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load earlier messages.");
    }
  };

  const toggleRecipient = (id: string) =>
    setRecipientIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  if (events.length === 0) {
    return (
      <section className="ess-panel">
        <h2>Event messages</h2>
        <p className="ess-muted">Create an event before messaging its participants.</p>
      </section>
    );
  }

  return (
    <section className="ess-panel">
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
      <button className="ess-outline-button" type="button" disabled={loading} onClick={() => setRefreshKey((current) => current + 1)}>
        {loading ? "Refreshing…" : "Refresh messages"}
      </button>
      <div aria-live="polite" aria-busy={loading} style={{ display: "grid", gap: 8, maxHeight: 420, overflowY: "auto", margin: "16px 0" }}>
        {nextBefore && <button className="ess-outline-button" type="button" onClick={() => void loadEarlier()}>Load earlier messages</button>}
        {!loading && messages.length === 0 && <p className="ess-muted">No messages for this event yet.</p>}
        {messages.map((message) => (
          <article className="ess-wallet-card" key={message.id} style={{ justifySelf: message.senderId === viewerId ? "end" : "start", maxWidth: "min(100%, 640px)" }}>
            <strong>{message.senderId === viewerId ? "You" : message.sender.name}</strong>
            <p>{message.body}</p>
            <small>{new Date(message.createdAt).toLocaleString()}</small>
          </article>
        ))}
      </div>
      <form onSubmit={(event) => void send(event)} style={{ display: "grid", gap: 12 }}>
        <fieldset className="ess-choice-group">
          <legend>Who should receive this message?</legend>
          <label>
            <input type="radio" checked={broadcast} onChange={() => setBroadcast(true)} />
            Everyone involved in this event
          </label>
          <label>
            <input type="radio" checked={!broadcast} onChange={() => setBroadcast(false)} />
            Selected participants
          </label>
        </fieldset>
        {!broadcast && (
          <fieldset className="ess-choice-group">
            <legend>Select recipients</legend>
            {otherParticipants.map((person) => (
              <label key={person.id}>
                <input type="checkbox" checked={recipientIds.includes(person.id)} onChange={() => toggleRecipient(person.id)} />
                {person.name} · {person.role}
              </label>
            ))}
          </fieldset>
        )}
        <label>
          Message
          <textarea value={body} maxLength={5000} rows={4} onChange={(event) => setBody(event.target.value)} required />
        </label>
        {broadcast && otherParticipants.length === 0 && (
          <p className="ess-muted">Add a verifier or book an event service before sending a team broadcast.</p>
        )}
        <button
          className="ess-primary"
          type="submit"
          disabled={sending || loading || !body.trim() || (broadcast ? otherParticipants.length === 0 : recipientIds.length === 0)}
        >
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
