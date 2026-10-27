import { useEffect, useState } from "react";
import { api } from "../lib/api";

type EventOption = { id: string; title: string };
type EventTask = {
  id: string;
  title: string;
  tier: "ESSENTIAL" | "RECOMMENDED" | "OPTIONAL";
  status: "TODO" | "DOING" | "DONE";
  dueAt?: string | null;
};

const TIERS: EventTask["tier"][] = ["ESSENTIAL", "RECOMMENDED", "OPTIONAL"];

export default function EventChecklistPanel({
  events,
  initialEventId,
}: {
  events: EventOption[];
  initialEventId?: string;
}) {
  const [eventId, setEventId] = useState(initialEventId || events[0]?.id || "");
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) {
      setTasks([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    api<{ tasks: EventTask[] }>(`/events/${eventId}/tasks`)
      .then((result) => { if (active) setTasks(result.tasks || []); })
      .catch((loadError: Error) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    if (initialEventId) setEventId(initialEventId);
  }, [initialEventId]);

  const updateStatus = async (task: EventTask, status: EventTask["status"]) => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ task: EventTask }>(`/events/${eventId}/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setTasks((current) => current.map((item) => item.id === task.id ? result.task : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update this task.");
    } finally {
      setBusy(false);
    }
  };

  const addTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!eventId || !title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ task: EventTask }>(`/events/${eventId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim() }),
      });
      setTasks((current) => [...current, result.task]);
      setTitle("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to add this task.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ess-panel">
      <p className="ess-eyebrow">Event planning</p>
      <h2>Planning checklist</h2>
      {!events.length ? (
        <p className="ess-muted">Create an event to build its type-specific checklist.</p>
      ) : (
        <>
          <label style={{ display: "block", maxWidth: 420, margin: "12px 0" }}>
            Event
            <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
              {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <p className="ess-muted" aria-live="polite">
            {tasks.filter((task) => task.status === "DONE").length} of {tasks.length} tasks complete
          </p>
          {error && <p className="ess-form-error" role="alert">{error}</p>}
          {loading ? <p className="ess-muted">Loading checklist…</p> : (
            TIERS.map((tier) => {
              const tierTasks = tasks.filter((task) => task.tier === tier);
              if (!tierTasks.length) return null;
              return (
                <section key={tier} aria-labelledby={`checklist-${tier}`} style={{ marginTop: 20 }}>
                  <h3 id={`checklist-${tier}`}>{tier[0] + tier.slice(1).toLowerCase()}</h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {tierTasks.map((task) => (
                      <div key={task.id} className="ess-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                        <div>
                          <strong>{task.title}</strong>
                          {task.dueAt && <p className="ess-muted">Due {new Date(task.dueAt).toLocaleDateString()}</p>}
                        </div>
                        <label>
                          <span className="ess-sr-only">Status for {task.title}</span>
                          <select
                            value={task.status}
                            disabled={busy}
                            onChange={(event) => void updateStatus(task, event.target.value as EventTask["status"])}
                          >
                            <option value="TODO">To do</option>
                            <option value="DOING">In progress</option>
                            <option value="DONE">Done</option>
                          </select>
                        </label>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
          <form onSubmit={addTask} style={{ display: "flex", gap: 8, marginTop: 20, maxWidth: 640 }}>
            <label style={{ flex: 1 }}>
              Add a task
              <input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <button className="ess-outline-button" type="submit" disabled={busy || !title.trim()} style={{ alignSelf: "end" }}>
              Add task
            </button>
          </form>
        </>
      )}
    </section>
  );
}