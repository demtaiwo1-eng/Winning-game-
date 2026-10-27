import { useEffect, useState } from "react";
import { kycApi, kycCountriesApi } from "../lib/api";
import { prepareKycUpload } from "../lib/prepareKycUpload";

type Country = {
  code: string;
  name: string;
  region: string;
  currency: string;
  identityDocs: string[];
  businessDocs: string[];
  addressProofDocs?: string[];
  nationalIdLabel?: string;
  notes?: string;
  assurance?: string;
};

type KycItem = {
  id: string;
  kind: string;
  status: string;
  documentUrl?: string | null;
  notes?: string | null;
};

export default function KycUpload({ defaultKind = "BUSINESS" }: { defaultKind?: "IDENTITY" | "BUSINESS" }) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState("NG");
  const [profile, setProfile] = useState<Country | null>(null);
  const [kind, setKind] = useState<"IDENTITY" | "BUSINESS">(defaultKind);
  const [primaryDocType, setPrimaryDocType] = useState("PASSPORT");
  const [nationalId, setNationalId] = useState("");
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [base64, setBase64] = useState("");
  const [url, setUrl] = useState("");
  const [addressUrl, setAddressUrl] = useState("");
  const [businessUrl, setBusinessUrl] = useState("");
  const [items, setItems] = useState<KycItem[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    kycCountriesApi
      .list()
      .then((res) => {
        setCountries(res.items || []);
        if (res.items?.length) {
          const ng = res.items.find((c) => c.code === "NG") || res.items[0];
          setCountry(ng.code);
        }
      })
      .catch(() => setCountries([]));
    kycApi.me().then((res) => setItems((res.items as KycItem[]) || [])).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!country) return;
    kycCountriesApi
      .profile(country)
      .then((res) => {
        const p = res.profile as Country;
        setProfile(p);
        if (p.identityDocs?.[0]) setPrimaryDocType(p.identityDocs[0]);
      })
      .catch(() => setProfile(null));
  }, [country]);

  const filteredCountries = countries.filter(
    (c) =>
      !filter ||
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.code.toLowerCase().includes(filter.toLowerCase()),
  );

  const onFile = async (file: File | null) => {
    if (!file) return;
    setMsg("");
    try {
      const prepared = await prepareKycUpload(file);
      setFileName(prepared.fileName);
      setBase64(prepared.base64);
      setUrl("");
      setMsg(`Document ready (${Math.ceil(prepared.size / 1024)} KB).`);
    } catch (error) {
      setBase64("");
      setFileName("");
      setMsg(error instanceof Error ? error.message : "Unable to prepare this document.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await kycApi.submit({
        kind,
        notes: notes || undefined,
        ...(url ? { documentUrl: url } : { documentBase64: base64, fileName: fileName || "document.pdf" }),
        // extended fields sent as any — api client posts JSON
        ...({
          country,
          primaryDocType,
          nationalId: nationalId || undefined,
          addressDocUrl: addressUrl || undefined,
          businessDocUrl: businessUrl || undefined,
        } as object),
      } as Parameters<typeof kycApi.submit>[0] & Record<string, string>);
      setMsg(
        `KYC submitted for ${profile?.name || country}. Status PENDING. ${
          (res as { nextSteps?: string[] }).nextSteps?.join(" ") || ""
        }`,
      );
      setBase64("");
      setFileName("");
      setUrl("");
      kycApi.me().then((r) => setItems((r.items as KycItem[]) || []));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ess-panel">
      <p className="ess-eyebrow">Trust · 170+ countries</p>
      <h2>Global KYC verification</h2>
      <p className="ess-muted">
        Select your country to load accepted ID types, national ID labels, and business documents.
        FATF-aligned modular collection — production plugs OCR/liveness per region.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 560, marginTop: 16 }}>
        <label>
          Search country ({countries.length} markets)
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Nigeria, Kenya, India, Brazil…"
          />
        </label>
        <label>
          Country of ID / registration
          <select value={country} onChange={(e) => setCountry(e.target.value)} required>
            {filteredCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code}) · {c.currency}
              </option>
            ))}
          </select>
        </label>

        {profile && (
          <div className="ess-wallet-card" style={{ fontSize: 13 }}>
            <strong>
              {profile.name} · {profile.region} · {profile.assurance || "STANDARD"} assurance
            </strong>
            <div className="ess-muted">
              Identity: {(profile.identityDocs || []).join(", ")}
            </div>
            {kind === "BUSINESS" && (
              <div className="ess-muted">Business: {(profile.businessDocs || []).join(", ")}</div>
            )}
            {profile.notes && <div className="ess-muted">{profile.notes}</div>}
          </div>
        )}

        <label>
          Verification type
          <select value={kind} onChange={(e) => setKind(e.target.value as "IDENTITY" | "BUSINESS")}>
            <option value="IDENTITY">Personal identity</option>
            <option value="BUSINESS">Business / vendor</option>
          </select>
        </label>

        <label>
          Primary document type
          <select value={primaryDocType} onChange={(e) => setPrimaryDocType(e.target.value)}>
            {(profile?.identityDocs || ["PASSPORT", "NATIONAL_ID"]).map((d) => (
              <option key={d} value={d}>
                {d.replace(/_/g, " ")}
              </option>
            ))}
            <option value="PASSPORT">PASSPORT</option>
          </select>
        </label>

        {profile?.nationalIdLabel && (
          <label>
            {profile.nationalIdLabel}
            <input
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              placeholder={profile.nationalIdLabel}
            />
          </label>
        )}

        <label>
          Primary document file
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => onFile(e.target.files?.[0] || null)} />
        </label>
        <label>
          Or document HTTPS URL
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>
        <label>
          Address proof URL (optional)
          <input type="url" value={addressUrl} onChange={(e) => setAddressUrl(e.target.value)} placeholder="Utility bill / bank statement" />
        </label>
        {kind === "BUSINESS" && (
          <label>
            Business registration URL (optional)
            <input type="url" value={businessUrl} onChange={(e) => setBusinessUrl(e.target.value)} placeholder="CAC / Companies House / trade licence" />
          </label>
        )}
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>
        <button className="ess-primary" type="submit" disabled={busy || (!base64 && !url)}>
          {busy ? "Submitting…" : "Submit KYC for review"}
        </button>
      </form>

      {msg && (
        <div className="ess-form-error" style={{ marginTop: 12, background: "#052e16", borderColor: "#166534", color: "#86efac" }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h3>Your submissions</h3>
        {items.length === 0 ? (
          <p className="ess-muted">No KYC requests yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            {items.map((i) => (
              <li key={i.id} className="ess-wallet-card">
                <strong>
                  {i.kind} · {i.status}
                </strong>
                <div className="ess-muted" style={{ fontSize: 13 }}>
                  {i.notes || i.documentUrl}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
