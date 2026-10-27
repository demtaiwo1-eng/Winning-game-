import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useOnlineStatus } from "../lib/offline/network";

type EventOption = { id: string; title: string; startsAt?: string | null };
type Guest = {
  id: string;
  token?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  rsvp: string;
  checkedInAt?: string | null;
  checkInMethod?: string | null;
};
type GuestPage = { items: Guest[]; total: number };
type CheckInMethod = "MANUAL" | "NFC" | "BLUETOOTH";
type CheckInResult = { queued?: boolean; offline?: boolean; alreadyCheckedIn?: boolean; guest?: Guest };

type NdefRecordLike = { recordType: string; data?: DataView };
type NdefReaderLike = {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
  addEventListener: (name: "reading", listener: (event: { message: { records: NdefRecordLike[] } }) => void) => void;
};
type BluetoothDeviceLike = {
  gatt?: { connect: () => Promise<{ getPrimaryService: (uuid: string) => Promise<{ getCharacteristic: (uuid: string) => Promise<{ readValue: () => Promise<DataView> }> }> }> };
};

// ESS BLE scanners must expose this documented GATT service/characteristic and
// return a guest invitation UUID as UTF-8 text. Generic Bluetooth devices are
// not assumed to be check-in scanners.
const ESS_CHECKIN_SERVICE = "f0e10000-7e57-4a53-9a10-45535343484b";
const ESS_CHECKIN_CHARACTERISTIC = "f0e10001-7e57-4a53-9a10-45535343484b";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pendingKey = (eventId: string) => `ess-checkin-pending:${eventId}`;

function decodeRecord(record: NdefRecordLike): string {
  if (!record.data) return "";
  try {
    // NDEF text payloads begin with a status byte followed by a language code.
    if (record.recordType === "text" && record.data.byteLength > 1) {
      const languageLength = record.data.getUint8(0) & 0x3f;
      return new TextDecoder().decode(new DataView(record.data.buffer, record.data.byteOffset + 1 + languageLength, record.data.byteLength - 1 - languageLength)).trim();
    }
    if (record.recordType === "url" && record.data.byteLength > 0) {
      const prefixes = ["", "http://www.", "https://www.", "http://", "https://", "tel:", "mailto:"];
      const prefix = prefixes[record.data.getUint8(0)] ?? "";
      const suffix = new TextDecoder().decode(new DataView(record.data.buffer, record.data.byteOffset + 1, record.data.byteLength - 1));
      return `${prefix}${suffix}`.trim();
    }
    return new TextDecoder().decode(record.data).trim();
  } catch { return ""; }
}
function extractToken(value: string): string | null {
  const trimmed = value.trim();
  if (UUID_RE.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const candidate = parsed.pathname.split("/").filter(Boolean).at(-1) || "";
    return UUID_RE.test(candidate) ? candidate : null;
  } catch { return null; }
}
function loadPending(eventId: string): string[] {
  try { const parsed: unknown = JSON.parse(localStorage.getItem(pendingKey(eventId)) || "[]"); return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []; } catch { return []; }
}
function savePending(eventId: string, ids: string[]) {
  try { localStorage.setItem(pendingKey(eventId), JSON.stringify([...new Set(ids)])); } catch { /* Storage can be unavailable in private contexts. */ }
}

export default function GuestCheckInPanel({ events }: { events: EventOption[] }) {
  const online = useOnlineStatus();
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [bluetoothAvailable, setBluetoothAvailable] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!events.some((event) => event.id === eventId)) setEventId(events[0]?.id || "");
  }, [events, eventId]);

  const refresh = useCallback(async () => {
    if (!eventId) { setGuests([]); return; }
    setError("");
    setPending(loadPending(eventId));
    try {
      const result = await api<GuestPage>(`/events/${eventId}/guests?limit=200`);
      const items = result.items || [];
      setGuests(items);
      const serverCheckedIn = new Set(items.filter((guest) => guest.checkedInAt).map((guest) => guest.id));
      const remaining = loadPending(eventId).filter((id) => !serverCheckedIn.has(id));
      savePending(eventId, remaining);
      setPending(remaining);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load guests.");
    }
  }, [eventId]);

  useEffect(() => { void refresh(); }, [refresh, online]);
  useEffect(() => {
    const nav = navigator as Navigator & { bluetooth?: unknown };
    const win = window as Window & { NDEFReader?: unknown };
    setNfcAvailable(Boolean(win.NDEFReader) && window.isSecureContext);
    setBluetoothAvailable(Boolean(nav.bluetooth) && window.isSecureContext);
    return () => abortRef.current?.abort();
  }, []);

  const checkIn = useCallback(async (input: { guestId?: string; token?: string; method: CheckInMethod }) => {
    if (!eventId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<CheckInResult>(`/events/${eventId}/guests/check-in`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID?.() || `${Date.now()}-${Math.random()}` },
        body: JSON.stringify(input),
      });
      if (result.queued || result.offline) {
        const matchedGuestId = input.guestId || guests.find((guest) => guest.token === input.token)?.id;
        if (matchedGuestId) {
          const next = [...loadPending(eventId), matchedGuestId];
          savePending(eventId, next); setPending(next);
        }
        setNotice("Saved for offline sync. The server will confirm check-in after reconnection.");
      } else {
        setNotice(result.alreadyCheckedIn ? "This guest was already checked in." : `${result.guest?.name || "Guest"} checked in successfully.`);
        if (input.guestId) setPending((current) => current.filter((id) => id !== input.guestId));
        await refresh();
      }
      setToken("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check-in failed.");
    } finally { setBusy(false); }
  }, [eventId, busy, guests, refresh]);

  const startNfc = async () => {
    const win = window as Window & { NDEFReader?: new () => NdefReaderLike };
    if (!win.NDEFReader || !window.isSecureContext) { setError("NFC scanning requires a compatible Android browser and HTTPS. Use manual token entry instead."); return; }
    try {
      abortRef.current?.abort();
      const controller = new AbortController(); abortRef.current = controller;
      const reader = new win.NDEFReader();
      reader.addEventListener("reading", (event) => {
        const value = event.message.records.map(decodeRecord).find(Boolean) || "";
        const found = extractToken(value);
        if (!found) { setError("The NFC tag did not contain an ESS guest UUID or invitation URL."); return; }
        void checkIn({ token: found, method: "NFC" });
        controller.abort();
      });
      await reader.scan({ signal: controller.signal });
      setNotice("NFC ready. Hold the guest's ESS tag near the phone.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start NFC scan."); }
  };

  const startBluetooth = async () => {
    const nav = navigator as Navigator & { bluetooth?: { requestDevice: (options: { filters: Array<{ services: string[] }> }) => Promise<BluetoothDeviceLike> } };
    if (!nav.bluetooth || !window.isSecureContext) { setError("Web Bluetooth requires a supported browser and HTTPS. Use NFC or manual entry."); return; }
    try {
      const device = await nav.bluetooth.requestDevice({ filters: [{ services: [ESS_CHECKIN_SERVICE] }] });
      if (!device.gatt) throw new Error("The selected device does not expose GATT services.");
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(ESS_CHECKIN_SERVICE);
      const characteristic = await service.getCharacteristic(ESS_CHECKIN_CHARACTERISTIC);
      const value = new TextDecoder().decode(await characteristic.readValue()).trim();
      const found = extractToken(value);
      if (!found) throw new Error("The Bluetooth scanner returned no valid ESS guest UUID.");
      await checkIn({ token: found, method: "BLUETOOTH" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bluetooth check-in failed."); }
  };

  const visibleGuests = guests.filter((guest) => `${guest.name} ${guest.email || ""} ${guest.phone || ""}`.toLowerCase().includes(search.toLowerCase()));
  const checkedCount = guests.filter((guest) => Boolean(guest.checkedInAt) || pending.includes(guest.id)).length;

  return <section className="ess-panel" aria-labelledby="ess-checkin-heading">
    <p className="ess-eyebrow">Phase 7 · Offline gate operations</p>
    <h2 id="ess-checkin-heading">Guest check-in</h2>
    <p className="ess-muted">Check in from the cached guest list while offline. NFC reads an ESS invitation UUID or RSVP URL. Bluetooth scanners must expose the ESS check-in GATT service documented in the Phase 7 report.</p>
    {events.length === 0 ? <p>Create an event and add guests before starting check-in.</p> : <>
      <label>Event<select value={eventId} onChange={(event) => setEventId(event.target.value)} style={{ display: "block", width: "100%", maxWidth: 520, marginTop: 6 }}>
        {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
      </select></label>
      <div className="ess-filter-row" style={{ marginTop: 12 }}>
        <span className="ess-chip">{checkedCount} / {guests.length} checked in</span>
        <span className="ess-chip">{online ? "Online" : "Offline mode"}</span>
        {pending.length > 0 && <span className="ess-chip">{pending.length} pending sync</span>}
      </div>
      <div className="ess-filter-row" style={{ marginTop: 12 }}>
        <button className="ess-primary" type="button" onClick={() => void startNfc()} disabled={!nfcAvailable || busy}>Scan NFC</button>
        <button className="ess-outline-button" type="button" onClick={() => void startBluetooth()} disabled={!bluetoothAvailable || busy}>Connect Bluetooth scanner</button>
        <button className="ess-outline-button" type="button" onClick={() => void refresh()} disabled={busy}>Refresh guests</button>
      </div>
      {!nfcAvailable && <p className="ess-muted">NFC is not available in this browser/device; manual check-in remains available.</p>}
      {!bluetoothAvailable && <p className="ess-muted">Web Bluetooth is not available in this browser/device; manual check-in remains available.</p>}
      <form onSubmit={(event) => { event.preventDefault(); const value = token.trim(); if (UUID_RE.test(value)) void checkIn({ token: value, method: "MANUAL" }); else setError("Enter a valid guest UUID or invitation token."); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <input aria-label="Guest invitation token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Guest UUID / invitation token" style={{ flex: "1 1 240px" }} />
        <button className="ess-outline-button" type="submit" disabled={busy || !token.trim()}>Check in token</button>
      </form>
      <label style={{ display: "block", marginTop: 12 }}>Find guest<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone" style={{ display: "block", width: "100%", marginTop: 6 }} /></label>
      {error && <p className="ess-form-error" role="alert">{error}</p>}
      {notice && <p className="ess-panel" role="status">{notice}</p>}
      <div className="ess-listing-grid" style={{ marginTop: 12 }}>
        {visibleGuests.map((guest) => {
          const isChecked = Boolean(guest.checkedInAt) || pending.includes(guest.id);
          return <article className="ess-card" key={guest.id}>
            <h3>{guest.name}</h3><p className="ess-muted">RSVP: {guest.rsvp}{guest.phone ? ` · ${guest.phone}` : ""}</p>
            <p>{guest.checkedInAt ? `Checked in ${new Date(guest.checkedInAt).toLocaleString()}` : pending.includes(guest.id) ? "Saved locally · awaiting server confirmation" : "Not checked in"}</p>
            <button className={isChecked ? "ess-outline-button" : "ess-primary"} type="button" disabled={busy || isChecked} onClick={() => void checkIn({ guestId: guest.id, method: "MANUAL" })}>{isChecked ? "Checked in" : "Check in guest"}</button>
          </article>;
        })}
      </div>
      {visibleGuests.length === 0 && <p className="ess-muted">No guests found. Load the guest list while online once to make it available offline.</p>}
    </>}
  </section>;
}
