import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { AllGreenFinale } from "./JourneyMoments";

type Check = {
  id: string;
  label: string;
  category?: string | null;
  zone?: string | null;
  status: "PENDING" | "GREEN" | "AMBER" | "RED";
  notes?: string | null;
  checkedAt?: string | null;
  taskId?: string | null;
  verifiedBy?: { id: string; name: string } | null;
};

type BookingPayment = {
  id: string; status: string; currency: string; totalMinor: string; paidMinor: string; vendorName: string;
  paymentRequests: Array<{ id: string; amountMinor: string; reason: string; status: string; paidAt?: string | null; createdAt?: string; requestedBy: string }>;
};

type Readiness = {
  status: string;
  totalChecks: number;
  greenCount: number;
  amberCount: number;
  redCount: number;
  pendingCount: number;
  windowOpensAt?: string | null;
  greenDeadlineAt?: string | null;
  startsAt?: string | null;
  windowOpen?: boolean;
  pastGreenDeadline?: boolean;
  msToStart?: number | null;
  msToGreenDeadline?: number | null;
  allGreen?: boolean;
};

type EventInfo = {
  title: string;
  status: string;
  endsAt?: string | null;
};

function formatMoney(minor: string, currency: string) {
  const amount = Number(minor) / 100;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return currency + " " + amount.toFixed(2); }
}

function formatCountdown(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms <= 0) return "0h 0m";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

const statusColor: Record<string, string> = {
  GREEN: "#16a34a",
  AMBER: "#d97706",
  RED: "#dc2626",
  PENDING: "#64748b",
  ALL_GREEN: "#16a34a",
  BLOCKED: "#dc2626",
  AT_RISK: "#d97706",
  IN_PROGRESS: "#2563eb",
  NOT_STARTED: "#64748b",
};

export default function EventReadinessBoard({
  eventId,
  mode = "client",
}: {
  eventId: string;
  mode?: "client" | "verifier";
}) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [bookingPayments, setBookingPayments] = useState<BookingPayment[]>([]);
  const [checkNotes, setCheckNotes] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [canFinalize, setCanFinalize] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showFinale, setShowFinale] = useState(false);
  const [seenGreen, setSeenGreen] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await api<{
        event: EventInfo;
        readiness: Readiness;
        checks: Check[];
        bookingPayments: BookingPayment[];
        canFinalize: boolean;
      }>(`/readiness/events/${eventId}`);
      setTitle(data.event.title);
      setEvent(data.event);
      setReadiness(data.readiness);
      setChecks(data.checks || []);
      setBookingPayments(data.bookingPayments || []);
      setCheckNotes((current) => Object.fromEntries((data.checks || []).map((check) => [check.id, current[check.id] ?? check.notes ?? ""])));
      setCanFinalize(data.canFinalize);
      if (data.readiness?.allGreen && !seenGreen) {
        setSeenGreen(true);
        setShowFinale(true);
      }

    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load readiness");
    }
  }, [eventId]);

  useEffect(() => {
    let active = true;
    api(`/readiness/events/${eventId}/sync`, { method: "POST", body: "{}" })
      .catch(() => undefined)
      .finally(() => { if (active) void load(); });
    return () => { active = false; };
  }, [eventId, load]);

  useEffect(() => {
    const id = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // live countdown from stored timestamps
  const msToStart = readiness?.startsAt
    ? Math.max(0, new Date(readiness.startsAt).getTime() - Date.now())
    : readiness?.msToStart ?? null;
  const msToDeadline = readiness?.greenDeadlineAt
    ? Math.max(0, new Date(readiness.greenDeadlineAt).getTime() - Date.now())
    : readiness?.msToGreenDeadline ?? null;
  void tick;

  const setCheck = async (checkId: string, status: string) => {
    const notes = (checkNotes[checkId] || "").trim();
    if (status === "GREEN" && notes.length < 8) {
      setError("Add an on-the-ground confirmation note of at least 8 characters before marking an item ready.");
      return;
    }
    setBusy(true);
    try {
      await api(`/readiness/checks/${checkId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    try {
      await api(`/readiness/events/${eventId}/sync`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  const finalizeEvent = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ bookingIds: string[] }>(
        `/readiness/events/${eventId}/finalize`,
        { method: "POST", body: "{}" },
      );
      let released = 0;
      for (const bookingId of result.bookingIds) {
        await api(`/payments/bookings/${bookingId}/release`, {
          method: "POST",
          body: "{}",
        });
        released += 1;
      }
      setNotice(
        `Event completion confirmed. Verifier-authorized escrow release processed for ${released} booking${released === 1 ? "" : "s"}.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete event and release escrow.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const eventHasEnded = Boolean(
    event?.endsAt && new Date(event.endsAt).getTime() <= Date.now(),
  );
  const canComplete = canFinalize &&
    readiness?.allGreen === true &&
    eventHasEnded &&
    event?.status !== "CANCELLED";

  return (
    <section className="ess-panel">
      {showFinale && (
        <AllGreenFinale eventTitle={title} onDismiss={() => setShowFinale(false)} />
      )}

      <p className="ess-eyebrow">Pre-event readiness · T−6h window · T−2h all green</p>
      <h2>{title || "Event readiness"}</h2>
      <p className="ess-muted">
        A verifier confirms every booked service. All lights must be <strong>green</strong> at least{" "}
        <strong>2 hours</strong> before start. Checks open from <strong>6 hours</strong> before start.
      </p>

      {error && <div className="ess-form-error">{error}</div>}
      {notice && <div className="ess-toast" role="status">{notice}</div>}

      {readiness && (
        <div
          className="ess-wallet-card"
          style={{
            marginTop: 16,
            borderColor: statusColor[readiness.status] || "#334155",
            borderWidth: 2,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <div>
              <div className="ess-muted" style={{ fontSize: 12 }}>
                Board status
              </div>
              <strong style={{ color: statusColor[readiness.status], fontSize: 20 }}>
                {readiness.status.replace(/_/g, " ")}
              </strong>
            </div>
            <div>
              <div className="ess-muted" style={{ fontSize: 12 }}>
                Countdown to start
              </div>
              <strong style={{ fontSize: 20, fontVariantNumeric: "tabular-nums" }}>
                {formatCountdown(msToStart)}
              </strong>
            </div>
            <div>
              <div className="ess-muted" style={{ fontSize: 12 }}>
                Time to “all green” deadline
              </div>
              <strong style={{ fontSize: 20, fontVariantNumeric: "tabular-nums" }}>
                {formatCountdown(msToDeadline)}
              </strong>
            </div>
            <div>
              <div className="ess-muted" style={{ fontSize: 12 }}>
                Lights
              </div>
              <strong>
                <span style={{ color: statusColor.GREEN }}>{readiness.greenCount} green</span>
                {" · "}
                <span style={{ color: statusColor.AMBER }}>{readiness.amberCount} amber</span>
                {" · "}
                <span style={{ color: statusColor.RED }}>{readiness.redCount} red</span>
                {" · "}
                <span style={{ color: statusColor.PENDING }}>{readiness.pendingCount} pending</span>
              </strong>
            </div>
          </div>
          {readiness.pastGreenDeadline && !readiness.allGreen && (
            <p style={{ color: "#dc2626", marginTop: 12, marginBottom: 0 }}>
              Past the 2-hour deadline and not all green — escalate with your verifier immediately.
            </p>
          )}
          {readiness.allGreen && (
            <p style={{ color: "#16a34a", marginTop: 12, marginBottom: 0 }}>
              All services confirmed green. You are clear for go-live.
            </p>
          )}
        </div>
      )}

      <details className="ess-dashboard-fold" open={mode === "verifier"}>
        <summary>Vendor payments and part-payment milestones · {bookingPayments.length}</summary>
        <p className="ess-muted">Read-only financial confirmation from recorded EPHINTA payment transactions. A pending request is not treated as paid; only recorded paid amounts count.</p>
        <div style={{ display: "grid", gap: 8, margin: "0 12px 12px" }}>
          {bookingPayments.map((booking) => (
            <article className="ess-card" key={booking.id}>
              <strong>{booking.vendorName}</strong>
              <p className="ess-muted">{booking.status} · Paid {formatMoney(booking.paidMinor, booking.currency)} of {formatMoney(booking.totalMinor, booking.currency)}</p>
              {booking.paymentRequests.length ? booking.paymentRequests.map((request) => (
                <p className="ess-muted" key={request.id}>Part payment: {formatMoney(request.amountMinor, booking.currency)} · {request.reason} · {request.status}{request.paidAt ? " · Paid " + new Date(request.paidAt).toLocaleString() : ""}</p>
              )) : <p className="ess-muted">No part-payment requests recorded.</p>}
            </article>
          ))}
          {!bookingPayments.length && <p className="ess-muted">No vendor bookings are linked to this event yet.</p>}
        </div>
      </details>

      {mode === "verifier" && canComplete && (
        <div className="ess-wallet-card" style={{ marginTop: 16 }}>
          <strong>{event?.status === "COMPLETED" ? "Verifier-authorized escrow release" : "Confirm event completion"}</strong>
          <p className="ess-muted">
            Funds remain in platform-controlled escrow until the event has ended, every service check is green, and you confirm as the selected lead verifier. Each booking release is recorded in the ledger.
          </p>
          <button type="button" className="ess-primary" onClick={finalizeEvent} disabled={busy}>
            {busy
              ? "Processing protected releases…"
              : event?.status === "COMPLETED"
                ? "Retry pending escrow releases"
                : "Confirm completion & release escrow"}
          </button>
        </div>
      )}

      {mode === "verifier" && canFinalize && readiness?.allGreen && !eventHasEnded && (
        <p className="ess-muted" style={{ marginTop: 16 }}>
          All services are green. Escrow remains protected until the event end time, {event?.endsAt ? new Date(event.endsAt).toLocaleString() : "which must be set"}.
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" className="ess-outline-button" onClick={sync} disabled={busy}>
          Sync booked services
        </button>
        <button
          type="button"
          className="ess-outline-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/readiness/events/${eventId}/seed-zones`, { method: "POST", body: "{}" });
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Seed failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Seed scale zones
        </button>
        <button
          type="button"
          className="ess-outline-button"
          disabled={busy}
          onClick={async () => {
            try {
              const res = await api<{ snapshot: unknown }>(`/readiness/events/${eventId}/snapshot`);
              setError("");
              alert(JSON.stringify(res.snapshot, null, 2));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Snapshot failed");
            }
          }}
        >
          Satisfaction snapshot
        </button>
        <button
          type="button"
          className="ess-outline-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/readiness/events/${eventId}/verifiers`, {
                method: "POST",
                body: JSON.stringify({ zone: "GENERAL", isLead: false }),
              });
              setError("");
              alert("Joined the GENERAL verifier zone. The event owner must select the lead verifier.");
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Assign failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Assign me as verifier
        </button>
        {mode === "verifier" && (
          <button
            type="button"
            className="ess-outline-button"
            disabled={busy}
            onClick={async () => {
              const zone = window.prompt(
                "Zone to claim (STAGE, FNB, ACCESS, PRODUCTION, MEDICAL, SECURITY, STREAM, GENERAL)",
                "STAGE",
              );
              if (!zone) return;
              setBusy(true);
              try {
                await api(`/readiness/events/${eventId}/verifiers`, {
                  method: "POST",
                  body: JSON.stringify({ zone: zone.toUpperCase(), isLead: false }),
                });
                alert(`Claimed zone ${zone.toUpperCase()}`);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Zone claim failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Claim zone
          </button>
        )}
        <button type="button" className="ess-outline-button" onClick={load} disabled={busy}>
          Refresh
        </button>
      </div>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20, display: "grid", gap: 10 }}>
        {checks.length === 0 && (
          <li className="ess-muted">
            No service checks yet. Book vendors on this event, then press “Sync booked services”.
          </li>
        )}
        {checks.map((c) => (
          <li
            key={c.id}
            className="ess-wallet-card"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              borderLeft: `4px solid ${statusColor[c.status]}`,
            }}
          >
            <div>
              <strong>{c.label}</strong>
              <div className="ess-muted" style={{ fontSize: 13 }}>
                {c.zone || "GENERAL"} · {c.category || "Service"} · {c.status}
                {c.taskId ? " · Planner checklist item" : ""}
                {c.notes ? ` · ${c.notes}` : ""}
                {c.verifiedBy?.name ? " · Verified by " + c.verifiedBy.name : ""}
                {c.checkedAt ? " · " + new Date(c.checkedAt).toLocaleString() : ""}
              </div>
            </div>
            {mode === "verifier" && (
              <div style={{ display: "grid", gap: 8, width: "min(100%, 360px)" }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  On-the-ground confirmation
                  <textarea rows={2} value={checkNotes[c.id] ?? ""} onChange={(event) => setCheckNotes((current) => ({ ...current, [c.id]: event.target.value }))} placeholder="What did you physically confirm? Note vendor arrival, setup, payment receipt or issue…" maxLength={500} />
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["GREEN", "AMBER", "RED"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={s === "GREEN" ? "ess-primary" : "ess-outline-button"}
                    style={
                      s === "GREEN"
                        ? { background: statusColor.GREEN, borderColor: statusColor.GREEN }
                        : s === "RED"
                          ? { color: statusColor.RED, borderColor: statusColor.RED }
                          : { color: statusColor.AMBER, borderColor: statusColor.AMBER }
                    }
                    disabled={busy || (s === "GREEN" && (checkNotes[c.id] || "").trim().length < 8)}
                    onClick={() => setCheck(c.id, s)}
                  >
                    {s}
                  </button>
                ))}
                </div>
              </div>
            )}
            {mode === "client" && (
              <span
                style={{
                  fontWeight: 700,
                  color: statusColor[c.status],
                  letterSpacing: "0.04em",
                }}
              >
                ● {c.status}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
