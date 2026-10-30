import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

type Invitation = {
  name: string;
  rsvp: "PENDING" | "ACCEPTED" | "DECLINED" | "MAYBE";
  plusOnes: number;
  respondedAt?: string | null;
  event: { title: string; type: string; startsAt?: string | null; endsAt?: string | null; city?: string | null; country?: string | null; status: string };
};

export default function PublicRsvpPage() {
  const { token = "" } = useParams();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [choice, setChoice] = useState<"ACCEPTED" | "DECLINED" | "MAYBE">("ACCEPTED");
  const [plusOnes, setPlusOnes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    api<Invitation>(`/rsvp/${encodeURIComponent(token)}`)
      .then((result) => {
        if (!active) return;
        setInvitation(result);
        setChoice(result.rsvp === "PENDING" ? "ACCEPTED" : result.rsvp);
        setPlusOnes(result.plusOnes);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Invitation not found."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !invitation || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await api<{ guest: Pick<Invitation, "name" | "rsvp" | "plusOnes" | "respondedAt"> }>(
        `/rsvp/${encodeURIComponent(token)}`,
        { method: "POST", body: JSON.stringify({ rsvp: choice, plusOnes }) },
      );
      setInvitation((current) => current ? { ...current, ...result.guest } : current);
      setNotice("Your response has been saved. You can return to this link to update it before the event closes.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your response.");
    } finally { setSaving(false); }
  };

  const closed = invitation?.event.status === "CANCELLED" || invitation?.event.status === "COMPLETED";
  return (
    <div className="ess-app">
      <main className="ess-content">
        <section className="ess-auth-modal" style={{ maxWidth: 620, margin: "40px auto" }}>
          <p className="ess-eyebrow">Ephinta · Guest invitation</p>
          {loading ? <p role="status">Loading your invitation…</p> : !invitation ? (
            <><h1>Invitation unavailable</h1><p className="ess-form-error" role="alert">{error || "This invitation link is invalid or has expired."}</p></>
          ) : (
            <>
              <h1>You're invited, {invitation.name}</h1>
              <h2>{invitation.event.title}</h2>
              <p className="ess-muted">{[invitation.event.startsAt ? new Date(invitation.event.startsAt).toLocaleString() : "", invitation.event.city, invitation.event.country].filter(Boolean).join(" · ") || "Event details will be shared by the organizer."}</p>
              <p className="ess-muted">Current response: {invitation.rsvp}{invitation.respondedAt ? ` · Updated ${new Date(invitation.respondedAt).toLocaleString()}` : ""}</p>
              {closed ? <p>This event is closed and is no longer accepting RSVP changes.</p> : (
                <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 20 }}>
                  <label>Will you attend?
                    <select value={choice} onChange={(event) => setChoice(event.target.value as typeof choice)}>
                      <option value="ACCEPTED">Yes, I'll attend</option>
                      <option value="MAYBE">Maybe</option>
                      <option value="DECLINED">Sorry, I can't attend</option>
                    </select>
                  </label>
                  <label>Additional guests
                    <input type="number" min={0} max={10} value={plusOnes} onChange={(event) => setPlusOnes(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} />
                  </label>
                  {error && <p className="ess-form-error" role="alert">{error}</p>}
                  {notice && <p role="status" className="ess-panel">{notice}</p>}
                  <button className="ess-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Submit RSVP"}</button>
                </form>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
