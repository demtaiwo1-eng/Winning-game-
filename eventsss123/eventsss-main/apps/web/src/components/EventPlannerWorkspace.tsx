import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type EventOption = { id: string; title: string; startsAt?: string | null; endsAt?: string | null; city?: string | null; currency?: string };
type Task = { id: string; title: string; tier: "ESSENTIAL" | "RECOMMENDED" | "OPTIONAL"; status: "TODO" | "DOING" | "DONE"; dueAt?: string | null };
type Guest = { id: string; name: string; email?: string | null; phone?: string | null; rsvp: string; checkedInAt?: string | null; checkInMethod?: string | null; plusOnes: number };
type BudgetItem = { id: string; label: string; category?: string | null; plannedMinor: string; actualMinor: string };
type CheckIn = { id: string; method: string; checkedInAt: string; guest: { id: string; name: string } };
type Booking = { id: string; status: string; currency: string; totalMinor: string; createdAt: string; event?: { id: string; title: string } | null; vendor?: { businessName: string }; items?: Array<{ listing?: { title: string } }> };
const PLAN_FIELDS = [
  ["desiredOutcome", "Desired outcome"],
  ["audienceNeeds", "Audience needs"],
  ["accessibility", "Accessibility requirements"],
  ["dietaryNeeds", "Dietary requirements"],
  ["programDetails", "Programme details"],
  ["safetyAndPermits", "Safety and permits"],
  ["successMeasures", "Success measures"],
] as const;
const money = (minor: string, currency: string) => {
  const n = Number(minor);
  return Number.isFinite(n) ? new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n / 100) : currency + " " + minor;
};
const icsEscape = (value: string) => value.replace(/\\\\/g, "\\\\\\\\").replace(/;/g, "\\\\;").replace(/,/g, "\\\\,").replace(/\\r?\\n/g, "\\\\n");
const icsDate = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\\.\\d{3}Z$/, "Z");
const escapeCsv = (value: unknown) => {
  const s = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return '"' + safe.replace(/"/g, '""') + '"';
};

export default function EventPlannerWorkspace({ events, initialEventId }: { events: EventOption[]; initialEventId?: string }) {
  const [eventId, setEventId] = useState(initialEventId || events[0]?.id || "");
  const [event, setEvent] = useState<EventOption | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [city, setCity] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [budgetLabel, setBudgetLabel] = useState("");
  const [budgetCategory, setBudgetCategory] = useState("");
  const [planned, setPlanned] = useState("");
  const [actual, setActual] = useState("");
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const currency = event?.currency || "NGN";

  useEffect(() => { if (initialEventId) setEventId(initialEventId); }, [initialEventId]);
  useEffect(() => { if (!eventId) { setEvent(null); return; } }, [eventId]);

  const refresh = async () => {
    if (!eventId) return;
    setLoading(true); setError(""); setNotice("");
    try {
      const [detail, taskData, guestData, checkInData, budgetData, bookingData, planData] = await Promise.all([
        api<{ event: EventOption }>(`/events/${eventId}`),
        api<{ tasks: Task[] }>(`/events/${eventId}/tasks`),
        api<{ items: Guest[]; total: number }>(`/events/${eventId}/guests?limit=200`),
        api<{ items: CheckIn[] }>(`/events/${eventId}/guests/check-ins`),
        api<{ items: BudgetItem[] }>(`/events/${eventId}/budget`),
        api<{ items: Booking[] }>("/payments/bookings"),
        api<{ answers: Record<string, string> }>(`/events/${eventId}/plan-answers`),
      ]);
      setEvent(detail.event); setTitle(detail.event.title);
      setStartsAt(detail.event.startsAt ? new Date(detail.event.startsAt).toISOString().slice(0, 16) : "");
      setEndsAt(detail.event.endsAt ? new Date(detail.event.endsAt).toISOString().slice(0, 16) : "");
      setCity(detail.event.city || "");
      setTasks(taskData.tasks || []); setGuests(guestData.items || []); setCheckIns(checkInData.items || []);
      setBudgetItems(budgetData.items || []);
      setBookings((bookingData.items || []).filter((b) => b.event?.id === eventId));
      setAnswers(planData.answers || {});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load this event workspace."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [eventId]);

  const totals = useMemo(() => budgetItems.reduce((sum, item) => ({ planned: sum.planned + Number(item.plannedMinor || 0), actual: sum.actual + Number(item.actualMinor || 0) }), { planned: 0, actual: 0 }), [budgetItems]);
  const checkedIn = checkIns;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const overdue = tasks.filter((t) => t.status !== "DONE" && t.dueAt && Date.parse(t.dueAt) < Date.now()).length;

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault(); if (!eventId) return; setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ event: EventOption }>(`/events/${eventId}`, { method: "PATCH", body: JSON.stringify({ title: title.trim(), startsAt: startsAt ? new Date(startsAt).toISOString() : null, endsAt: endsAt ? new Date(endsAt).toISOString() : null, city: city || null }) });
      setEvent(result.event); setNotice("Event details saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save event."); }
    finally { setBusy(false); }
  };
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault(); if (!eventId || !taskTitle.trim()) return; setBusy(true); setError("");
    try {
      const result = await api<{ task: Task }>(`/events/${eventId}/tasks`, { method: "POST", body: JSON.stringify({ title: taskTitle.trim(), dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null }) });
      setTasks((current) => [...current, result.task]); setTaskTitle(""); setTaskDueAt(""); setNotice("Task added to the event timeline.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add task."); }
    finally { setBusy(false); }
  };
  const updateTask = async (task: Task, patch: Partial<Pick<Task, "status" | "dueAt">>) => {
    setBusy(true); setError("");
    try {
      const result = await api<{ task: Task }>(`/events/${eventId}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setTasks((current) => current.map((t) => t.id === task.id ? result.task : t));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update task."); }
    finally { setBusy(false); }
  };
  const addBudgetItem = async (e: React.FormEvent) => {
    e.preventDefault(); if (!eventId || !budgetLabel.trim()) return;
    const toMinor = (v: string) => { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER / 100) throw new Error("Enter valid non-negative budget amounts."); return String(Math.round(n * 100)); };
    setBusy(true); setError("");
    try {
      const result = await api<{ item: BudgetItem }>(`/events/${eventId}/budget/items`, { method: "POST", body: JSON.stringify({ label: budgetLabel.trim(), category: budgetCategory || null, plannedMinor: toMinor(planned || "0"), actualMinor: toMinor(actual || "0") }) });
      setBudgetItems((current) => [...current, result.item]); setBudgetLabel(""); setBudgetCategory(""); setPlanned(""); setActual(""); setNotice("Budget line added.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add budget line."); }
    finally { setBusy(false); }
  };
  const updateActual = async (item: BudgetItem, value: string) => {
    const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER / 100) { setError("Enter a valid actual amount."); return; }
    setBusy(true); setError("");
    try {
      const result = await api<{ item: BudgetItem }>(`/events/${eventId}/budget/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ actualMinor: String(Math.round(n * 100)) }) });
      setBudgetItems((current) => current.map((i) => i.id === item.id ? result.item : i));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update actual spend."); }
    finally { setBusy(false); }
  };
  const saveAnswers = async () => {
    setBusy(true); setError("");
    try { await api(`/events/${eventId}/plan-answers`, { method: "PUT", body: JSON.stringify({ answers }) }); setNotice("Planning answers saved."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save planning answers."); }
    finally { setBusy(false); }
  };
  const downloadCalendarReminder = (task: Task) => {
    if (!task.dueAt) return;
    const start = icsDate(task.dueAt);
    const alarm = new Date(Date.parse(task.dueAt) - 24 * 60 * 60 * 1000);
    const alarmAt = icsDate(alarm.toISOString());
    const ics = [
      "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//EPHINTA//Event Planner//EN","CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",`UID:${task.id}@ephinta`,`DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${start}`,`SUMMARY:${icsEscape(task.title)}`,
      `DESCRIPTION:${icsEscape(event?.title || "Event task")}`,
      "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Task due in 24 hours","TRIGGER:-PT24H","END:VALARM",
      "END:VEVENT","END:VCALENDAR",
    ].join("\\r\\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `ephinta-reminder-${task.id}.ics`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Calendar reminder downloaded. Import it into your calendar to receive the 24-hour alert.");
  };
  const exportSummary = () => {
    if (!event) return;
    const rows = [["Section","Item","Status / Detail"], ["Event",event.title,event.startsAt || ""], ...tasks.map((t) => ["Task",t.title,t.status + (t.dueAt ? " · " + t.dueAt : "")]), ...guests.map((g) => ["Guest",g.name,g.rsvp + (g.checkedInAt ? " · Checked in " + g.checkedInAt : "")]), ...budgetItems.map((i) => ["Budget",i.label,"Planned " + i.plannedMinor + " · Actual " + i.actualMinor]), ...bookings.map((b) => ["Booking",b.items?.map((i) => i.listing?.title).filter(Boolean).join(", ") || b.id,b.status])];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\\uFEFF",csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "ephinta-event-readiness.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return <section className="ess-panel" aria-labelledby="event-workspace-title">
    <p className="ess-eyebrow">Phase 4 · event planner</p><h2 id="event-workspace-title">Complete event workspace</h2>
    {!events.length ? <p className="ess-muted">Create an event to manage its timeline, budget, guests and bookings.</p> : <>
      <label style={{ display: "block", maxWidth: 520, margin: "12px 0" }}>Event
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>{events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      </label>
      {error && <p className="ess-form-error" role="alert">{error}</p>}
      {notice && <p className="ess-muted" role="status">{notice}</p>}
      {loading ? <p className="ess-muted">Loading event workspace…</p> : event && <>
        <div className="ess-metrics">
          <article className="ess-metric"><span>Tasks complete</span><strong>{doneTasks}/{tasks.length}</strong><small>{overdue} overdue</small></article>
          <article className="ess-metric"><span>Guests checked in</span><strong>{checkedIn.length}/{guests.length}</strong><small>Recorded check-in events</small></article>
          <article className="ess-metric"><span>Planned budget</span><strong>{money(String(totals.planned),currency)}</strong><small>All budget lines</small></article>
          <article className="ess-metric"><span>Actual spend</span><strong>{money(String(totals.actual),currency)}</strong><small>Variance {money(String(totals.planned-totals.actual),currency)}</small></article>
        </div>
        <div className="ess-filter-row" style={{ margin: "14px 0" }}>
          <button className="ess-outline-button" type="button" onClick={exportSummary}>Export event summary CSV</button>
          <button className="ess-outline-button" type="button" onClick={() => window.print()}>Print / save PDF</button>
          <button className="ess-outline-button" type="button" disabled={loading || busy} onClick={() => void refresh()}>Refresh workspace</button>
        </div>
        <section style={{ marginTop: 18 }}>
          <h3>Event details · save and resume</h3>
          <form onSubmit={saveEvent} className="ess-form-grid">
            <label>Event title<input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} /></label>
            <label>City<input value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} /></label>
            <label>Starts at<input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
            <label>Ends at<input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
            <button className="ess-primary" type="submit" disabled={busy || !title.trim()}>Save event changes</button>
          </form>
        </section>
        <section style={{ marginTop: 22 }}>
          <h3>Planning answers</h3>
          <div className="ess-form-grid">{PLAN_FIELDS.map(([key,label]) => <label key={key}>{label}<textarea rows={2} maxLength={2000} value={answers[key] || ""} onChange={(e) => setAnswers((a) => ({ ...a,[key]:e.target.value }))} /></label>)}</div>
          <button className="ess-outline-button" type="button" disabled={busy} onClick={() => void saveAnswers()}>Save planning answers</button>
        </section>
        <section style={{ marginTop: 22 }}>
          <h3>Task timeline and due dates</h3>
          <form onSubmit={addTask} className="ess-form-grid">
            <label>Task<input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} maxLength={200} required /></label>
            <label>Due date<input type="datetime-local" value={taskDueAt} onChange={(e) => setTaskDueAt(e.target.value)} /></label>
            <button className="ess-primary" type="submit" disabled={busy || !taskTitle.trim()}>Add task</button>
          </form>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>{tasks.map((task) => <article className="ess-card" key={task.id}>
            <strong>{task.title}</strong><div className="ess-filter-row"><button className="ess-outline-button" type="button" disabled={!task.dueAt} onClick={() => downloadCalendarReminder(task)}>Add 24h calendar reminder</button></div><div className="ess-form-grid">
              <label>Status<select value={task.status} disabled={busy} onChange={(e) => void updateTask(task,{ status:e.target.value as Task["status"] })}><option value="TODO">To do</option><option value="DOING">In progress</option><option value="DONE">Done</option></select></label>
              <label>Due date<input type="datetime-local" value={task.dueAt ? new Date(task.dueAt).toISOString().slice(0,16) : ""} disabled={busy} onChange={(e) => void updateTask(task,{ dueAt:e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
            </div>
          </article>)}</div>
          <p className="ess-muted">Due dates and overdue indicators are tracked here. Download a 24-hour calendar reminder for any dated task and import it into your calendar; automatic push/email delivery is not enabled.</p>
        </section>
        <section style={{ marginTop: 22 }}>
          <h3>Budget · planned vs actual</h3>
          <form onSubmit={addBudgetItem} className="ess-form-grid">
            <label>Budget line<input value={budgetLabel} onChange={(e) => setBudgetLabel(e.target.value)} required /></label>
            <label>Category<input value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} /></label>
            <label>Planned ({currency})<input type="number" min="0" step="0.01" value={planned} onChange={(e) => setPlanned(e.target.value)} required /></label>
            <label>Actual ({currency})<input type="number" min="0" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} required /></label>
            <button className="ess-primary" type="submit" disabled={busy}>Add budget line</button>
          </form>
          <div style={{ overflowX: "auto", marginTop: 12 }}><table><thead><tr><th>Item</th><th>Planned</th><th>Actual</th><th>Variance</th></tr></thead><tbody>
            {budgetItems.map((item) => <tr key={item.id}><td>{item.label}{item.category ? " · " + item.category : ""}</td><td>{money(item.plannedMinor,currency)}</td><td><input aria-label={`Actual spend for ${item.label}`} type="number" min="0" step="0.01" defaultValue={(Number(item.actualMinor)/100).toFixed(2)} disabled={busy} onBlur={(e) => { const v=e.currentTarget.value; if (v !== (Number(item.actualMinor)/100).toFixed(2)) void updateActual(item,v); }} /></td><td>{money(String(Number(item.plannedMinor)-Number(item.actualMinor)),currency)}</td></tr>)}
          </tbody></table></div>
        </section>
        <section style={{ marginTop: 22 }}>
          <h3>Guest check-in history and privacy</h3>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={showContacts} onChange={(e) => setShowContacts(e.target.checked)} /> Show guest contact details</label>
          <div style={{ overflowX: "auto", marginTop: 10 }}><table><thead><tr><th>Guest</th>{showContacts && <th>Contact</th>}<th>RSVP</th><th>Check-in time</th><th>Method</th></tr></thead><tbody>
            {checkIns.map((entry) => <tr key={entry.id}><td>{entry.guest.name}</td>{showContacts && <td>{guests.find((g) => g.id === entry.guest.id)?.email || guests.find((g) => g.id === entry.guest.id)?.phone || "—"}</td>}<td>{guests.find((g) => g.id === entry.guest.id)?.rsvp || "—"}</td><td>{new Date(entry.checkedInAt).toLocaleString()}</td><td>{entry.method}</td></tr>)}
            {!checkedIn.length && <tr><td colSpan={showContacts ? 5 : 4}>No new check-in history recorded yet. Pre-migration check-ins are not reconstructed; existing guest check-in fields remain unchanged.</td></tr>}
          </tbody></table></div>
          <p className="ess-muted">Each accepted check-in is appended with its method and server timestamp. Contact details remain hidden unless you opt to reveal them.</p>
        </section>
        <section style={{ marginTop: 22 }}>
          <h3>Vendor bookings linked to this event</h3>
          {bookings.length ? <div style={{ display: "grid", gap: 8 }}>{bookings.map((booking) => <article className="ess-card" key={booking.id}><strong>{booking.items?.map((i) => i.listing?.title).filter(Boolean).join(", ") || "Vendor booking"}</strong><p className="ess-muted">{booking.vendor?.businessName || "Vendor"} · {booking.status} · {money(booking.totalMinor,booking.currency)}</p></article>)}</div> : <p className="ess-muted">No bookings are currently linked to this event. Create a booking from this event context to have it appear here.</p>}
        </section>
      </>}
    </>}
  </section>;
}
