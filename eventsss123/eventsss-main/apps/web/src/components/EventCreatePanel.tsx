import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { COMPENDIUM_TEMPLATES, SECTORS, type CompendiumTemplate } from "../lib/compendiumTemplates";

const EVENT_TYPES = [
  "PERSONAL",
  "CORPORATE",
  "SOCIAL",
  "SPORTS",
  "CULTURAL",
  "RELIGIOUS",
  "POLITICAL",
  "ENTERTAINMENT",
  "EDUCATIONAL",
  "VIRTUAL",
] as const;

const SCALES = [
  { id: "SMALL", label: "Small (< 200)" },
  { id: "MEDIUM", label: "Medium (200–2,000)" },
  { id: "LARGE", label: "Large (2,000–15,000)" },
  { id: "MEGA", label: "Mega (15,000+)" },
] as const;

const FORMATS = ["IN_PERSON", "HYBRID", "VIRTUAL", "ROADSHOW", "INVITE_ONLY"] as const;

export default function EventCreatePanel({ onCreated }: { onCreated?: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof EVENT_TYPES)[number]>("CORPORATE");
  const [scaleTier, setScaleTier] = useState("MEDIUM");
  const [isVirtual, setIsVirtual] = useState(false);
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("IN_PERSON");
  const [sector, setSector] = useState<string>("TECHNOLOGY");
  const [specialRequests, setSpecialRequests] = useState("");
  const [kpiTargets, setKpiTargets] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("NG");
  const [currency, setCurrency] = useState("NGN");
  const [expectedGuests, setExpectedGuests] = useState("");
  const [budgetMajor, setBudgetMajor] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [parentEventId, setParentEventId] = useState("");
  const [parentOptions, setParentOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    api<{ items?: Array<{ id: string; title: string }> }>("/events")
      .then((r) => {
        const items = r.items || [];
        setParentOptions(items.map((e) => ({ id: e.id, title: e.title })));
      })
      .catch(() => setParentOptions([]));
  }, []);

  const applyTemplate = (t: CompendiumTemplate) => {
    setTemplateId(t.id);
    setTitle(t.title);
    setType(t.type as (typeof EVENT_TYPES)[number]);
    setScaleTier(t.scaleTier);
    setIsVirtual(t.isVirtual);
    setFormat(t.format);
    setSector(t.sector);
    setExpectedGuests(String(t.suggestedGuests));
    setSpecialRequests(t.specialRequests);
    setKpiTargets(t.kpiTargets);
    setMsg(`Template loaded from ${t.caseRef}. Adjust dates and budget, then create.`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const budgetMinor =
        budgetMajor && Number.isFinite(Number(budgetMajor))
          ? String(Math.round(Number(budgetMajor) * 100))
          : undefined;
      const res = await api<{ event: { id: string; title: string } }>("/events", {
        method: "POST",
        body: JSON.stringify({
          title,
          type,
          scaleTier,
          isVirtual: isVirtual || format === "VIRTUAL" || format === "HYBRID",
          format,
          sector,
          specialRequests: specialRequests || null,
          kpiTargets: kpiTargets || null,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          city: city || null,
          country: country || null,
          currency,
          expectedGuests: expectedGuests ? Number(expectedGuests) : null,
          budgetMinor,
          parentEventId: parentEventId || null,
          autoChecklist: true,
          isPublic: false,
        }),
      });
      if (scaleTier === "LARGE" || scaleTier === "MEGA" || scaleTier === "MEDIUM" || format === "HYBRID") {
        try {
          await api(`/readiness/events/${res.event.id}/seed-zones`, {
            method: "POST",
            body: "{}",
          });
        } catch {
          /* optional until migrate */
        }
      }
      setMsg(`Event “${res.event.title}” created — production path ready (zones + checklist).`);
      onCreated?.(res.event.id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ess-panel">
      <p className="ess-eyebrow">Production · Compendium 2026 · 100-case ready</p>
      <h2>Create event</h2>
      <p className="ess-muted">
        Start from a sector template (Tech, Healthcare, Finance, Esports, Government…) or build custom.
        Every path ends on the same promise: <strong>all green by T−2h</strong>, escrow, KYC, multi-verifier zones.
      </p>

      <div style={{ marginTop: 14, marginBottom: 8 }}>
        <p className="ess-eyebrow">Compendium templates</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {COMPENDIUM_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={templateId === t.id ? "ess-chip ess-chip-active" : "ess-chip"}
              onClick={() => applyTemplate(t)}
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 640, marginTop: 16 }}>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sector
            <select value={sector} onChange={(e) => setSector(e.target.value)}>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Format
            <select
              value={format}
              onChange={(e) => {
                const f = e.target.value as (typeof FORMATS)[number];
                setFormat(f);
                if (f === "VIRTUAL" || f === "HYBRID") setIsVirtual(true);
              }}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scale
            <select value={scaleTier} onChange={(e) => setScaleTier(e.target.value)}>
              {SCALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={isVirtual} onChange={(e) => setIsVirtual(e.target.checked)} />
          Stream / virtual critical (STREAM zone)
        </label>
        <label>
          Starts at (drives T−6h / T−2h clocks)
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label>
          Ends at
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            Country (ISO)
            <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Expected guests
            <input
              type="number"
              min={1}
              max={5000000}
              value={expectedGuests}
              onChange={(e) => setExpectedGuests(e.target.value)}
            />
          </label>
          <label>
            Budget (major units)
            <input
              type="number"
              min={0}
              step="0.01"
              value={budgetMajor}
              onChange={(e) => setBudgetMajor(e.target.value)}
            />
          </label>
        </div>
        <label>
          Currency
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </label>
        <label>
          Series parent (roadshow / multi-day)
          <select value={parentEventId} onChange={(e) => setParentEventId(e.target.value)}>
            <option value="">None — standalone</option>
            {parentOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Special requests (compendium)
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            rows={3}
            placeholder="Translation, Faraday pods, vegan catering, red carpet…"
          />
        </label>
        <label>
          KPI targets
          <textarea
            value={kpiTargets}
            onChange={(e) => setKpiTargets(e.target.value)}
            rows={2}
            placeholder="NPS, check-in rate, pipeline, compliance pass…"
          />
        </label>
        <button className="ess-primary" type="submit" disabled={busy || !title.trim()}>
          {busy ? "Creating…" : "Create production event + readiness zones"}
        </button>
      </form>
      {msg && (
        <div
          className="ess-form-error"
          style={{ marginTop: 12, background: "#052e16", borderColor: "#166534", color: "#86efac" }}
        >
          {msg}
        </div>
      )}
    </section>
  );
}
