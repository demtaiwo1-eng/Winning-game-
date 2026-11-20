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
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [base64, setBase64] = useState("");
  const [addressUrl, setAddressUrl] = useState("");
  const [businessUrl, setBusinessUrl] = useState("");
  const [items, setItems] = useState<KycItem[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [step, setStep] = useState(0);
  const [bytidConsent, setBytidConsent] = useState(false);
  const [bytidRequestId, setBytidRequestId] = useState("");
  const [bytidStatus, setBytidStatus] = useState("");
  const [bytidBusy, setBytidBusy] = useState(false);
  const [bytidEnabled, setBytidEnabled] = useState(false);
  const [bytidMode, setBytidMode] = useState<"sandbox" | "live">("sandbox");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("kyc") === "bytid" && params.get("requestId")) {
      setBytidRequestId(params.get("requestId") || "");
      window.history.replaceState({}, "", window.location.pathname);
    }
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
    kycApi.bytidConfig().then((res) => { setBytidEnabled(res.enabled); setBytidMode(res.mode); }).catch(() => setBytidEnabled(false));
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

  const availableDocTypes = kind === "BUSINESS"
    ? profile?.businessDocs || []
    : profile?.identityDocs || [];

  const steps = kind === "BUSINESS"
    ? ["country", "kind", "documentType", "primaryDocument", "addressProof", "businessProof", "notes", "review"] as const
    : ["country", "kind", "documentType", "primaryDocument", "addressProof", "notes", "review"] as const;
  const currentStep = steps[Math.min(step, steps.length - 1)];
  const nextStep = () => {
    if (currentStep === "primaryDocument" && !base64) {
      setMsg("Please add your primary document, or use secure provider verification where available.");
      return;
    }
    setMsg("");
    setStep((value) => Math.min(value + 1, steps.length - 1));
  };
  const previousStep = () => {
    setMsg("");
    setStep((value) => Math.max(0, value - 1));
  };

  useEffect(() => {
    if (availableDocTypes.length && !availableDocTypes.includes(primaryDocType)) {
      setPrimaryDocType(availableDocTypes[0]);
    }
  }, [kind, profile, primaryDocType]);

  const filteredCountries = countries.filter(
    (c) =>
      !filter ||
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.code.toLowerCase().includes(filter.toLowerCase()),
  );

  const startBytid = async () => {
    setBytidBusy(true);
    setMsg("");
    try {
      const result = await kycApi.startBytid(bytidConsent);
      setBytidRequestId(result.requestId);
      window.location.assign(result.verificationUrl);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Unable to start secure identity verification.");
      setBytidBusy(false);
    }
  };

  const refreshBytid = async () => {
    if (!bytidRequestId) return;
    setBytidBusy(true);
    try {
      const result = await kycApi.bytidStatus(bytidRequestId);
      setBytidStatus(`${result.request.status} · provider ${result.providerStatus} · face ${result.faceMatch || "pending"} · liveness ${result.liveness || "pending"}`);
      kycApi.me().then((r) => setItems((r.items as KycItem[]) || []));
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Unable to refresh identity verification.");
    } finally {
      setBytidBusy(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setMsg("");
    try {
      const prepared = await prepareKycUpload(file);
      setFileName(prepared.fileName);
      setBase64(prepared.base64);
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
        documentBase64: base64,
        fileName: fileName || "document.pdf",
        // extended fields sent as any — api client posts JSON
        ...({
          country,
          primaryDocType,
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
      kycApi.me().then((r) => setItems((r.items as KycItem[]) || []));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ess-panel ess-kyc-workspace">
      <p className="ess-eyebrow">Trust · 170+ countries</p>
      <h2>Global KYC verification</h2>
      <p className="ess-muted">
        Complete the guided steps below. Requirements are selected for your country and account type;
        EPHINTA only displays a verified status after the identity provider or review team confirms it.
      </p>
      <div className="ess-kyc-stepper" aria-label="KYC interview progress">
        <span aria-current={currentStep === "country" ? "step" : undefined}>1 · Country</span>
        <span aria-current={currentStep === "kind" ? "step" : undefined}>2 · Verification</span>
        <span aria-current={["documentType", "primaryDocument"].includes(currentStep) ? "step" : undefined}>3 · Identity</span>
        <span aria-current={["addressProof", "businessProof"].includes(currentStep) ? "step" : undefined}>4 · Supporting evidence</span>
        <span aria-current={["notes", "review"].includes(currentStep) ? "step" : undefined}>5 · Review</span>
      </div>
      <div className="ess-interview-progress-track" aria-hidden="true">
        <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 560, marginTop: 16 }}>
        <p className="ess-interview-step-label">Question {step + 1} of {steps.length}</p>
        {currentStep === "country" && (
          <>
            <h3>Which country are you completing verification in?</h3>
            <p className="ess-muted">We use this to show the relevant document types and guidance.</p>
            <label>
              Search country ({countries.length} markets)
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Nigeria, Kenya, India, Brazil…" />
            </label>
            <label>
              Country of ID / registration
              <select value={country} onChange={(e) => { setCountry(e.target.value); setStep(1); }} required>
                {filteredCountries.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code}) · {c.currency}</option>)}
              </select>
            </label>
            {profile && (
              <div className="ess-wallet-card" style={{ fontSize: 13 }}>
                <strong>{profile.name} · {profile.region} · {profile.assurance || "STANDARD"} assurance</strong>
                <div className="ess-muted">Identity: {(profile.identityDocs || []).join(", ")}</div>
                {profile.businessDocs?.length ? <div className="ess-muted">Business: {profile.businessDocs.join(", ")}</div> : null}
                {profile.notes && <div className="ess-muted">{profile.notes}</div>}
              </div>
            )}
          </>
        )}
        {currentStep === "kind" && (
          <>
            <h3>What would you like EPHINTA to verify?</h3>
            <p className="ess-muted">Choose the verification route that matches this account.</p>
            <label>Verification type
              <select value={kind} onChange={(e) => { setKind(e.target.value as "IDENTITY" | "BUSINESS"); setStep(2); }}>
                <option value="IDENTITY">Personal identity</option>
                <option value="BUSINESS">Business / vendor</option>
              </select>
            </label>
          </>
        )}
        {currentStep === "documentType" && (
          <>
            <h3>Which document will you use?</h3>
            <p className="ess-muted">Choose from the document types listed for {profile?.name || country}.</p>
            <label>Primary document type
              <select value={primaryDocType} onChange={(e) => setPrimaryDocType(e.target.value)}>
                {(availableDocTypes.length ? availableDocTypes : ["PASSPORT", "NATIONAL_ID"]).map((d) => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}
                <option value="PASSPORT">PASSPORT</option>
              </select>
            </label>
            {kind === "IDENTITY" && country === "NG" && (
              <div className="ess-wallet-card" style={{ display: "grid", gap: 10 }}>
                <strong>Prefer secure Nigerian identity verification?</strong>
                {!bytidEnabled ? (
                  <p className="ess-muted">Hosted verification is awaiting the API service's sandbox key. You can continue with document review.</p>
                ) : (
                  <>
                    <p className="ess-muted">Bytid handles the BVN/NIN and face check. EPHINTA receives the verification result rather than asking you to type your BVN or NIN here.</p>
                    <p className="ess-muted">{bytidMode === "live" ? "Live verification may incur provider fees. Review Bytid pricing before continuing." : "Sandbox mode uses test records and is free."}</p>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <input type="checkbox" checked={bytidConsent} onChange={(e) => setBytidConsent(e.target.checked)} />
                      <span>I consent to EPHINTA sharing my name and email with Bytid for its secure identity and face verification.</span>
                    </label>
                    <button className="ess-primary" type="button" disabled={bytidBusy || !bytidConsent} onClick={startBytid}>
                      {bytidBusy ? "Starting secure verification…" : "Continue with secure ID verification"}
                    </button>
                    {bytidRequestId && (
                      <div>
                        <button type="button" disabled={bytidBusy} onClick={refreshBytid}>Refresh verification status</button>
                        {bytidStatus && <p className="ess-muted" role="status">{bytidStatus}</p>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
        {currentStep === "primaryDocument" && (
          <>
            <h3>Can you add your {primaryDocType.replace(/_/g, " ").toLowerCase()}?</h3>
            <p className="ess-muted">Upload a clear, readable file. Accepted formats: PDF, PNG, JPG or WebP.</p>
            <label>Upload your primary document
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => onFile(e.target.files?.[0] || null)} />
            </label>
            {fileName && <p className="ess-muted" role="status">Selected: {fileName}</p>}
          </>
        )}
        {currentStep === "addressProof" && (
          <>
            <h3>Would you like to add proof of address?</h3>
            <p className="ess-muted">This is optional here. If the selected country or review team requires it, EPHINTA will explain what is needed.</p>
            <label>Proof of residential address (optional)
              <input type="url" value={addressUrl} onChange={(e) => setAddressUrl(e.target.value)} placeholder="Secure utility bill / bank statement link" />
            </label>
          </>
        )}
        {currentStep === "businessProof" && (
          <>
            <h3>Do you have business registration evidence?</h3>
            <p className="ess-muted">This is optional at this step. Examples depend on your country and business type.</p>
            <label>Business registration document (optional)
              <input type="url" value={businessUrl} onChange={(e) => setBusinessUrl(e.target.value)} placeholder="Secure CAC / Companies House / trade licence link" />
            </label>
          </>
        )}
        {currentStep === "notes" && (
          <>
            <h3>Is there anything else the review team should know?</h3>
            <p className="ess-muted">Add a short note if a document is pending or you need help. Do not include passwords, PINs or full bank details.</p>
            <label>Additional notes (optional)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
            </label>
          </>
        )}
        {currentStep === "review" && (
          <>
            <h3>Review your verification details</h3>
            <p className="ess-muted">Check the information before sending it to the EPHINTA review team.</p>
            <div className="ess-wallet-card" style={{ display: "grid", gap: 8 }}>
              <div><strong>Country</strong><div className="ess-muted">{profile?.name || country}</div></div>
              <div><strong>Verification</strong><div className="ess-muted">{kind === "BUSINESS" ? "Business / vendor" : "Personal identity"}</div></div>
              <div><strong>Document type</strong><div className="ess-muted">{primaryDocType.replace(/_/g, " ")}</div></div>
              <div><strong>Primary document</strong><div className="ess-muted">{fileName || "Not attached"}</div></div>
              <div><strong>Address evidence</strong><div className="ess-muted">{addressUrl ? "Provided" : "Not provided"}</div></div>
              {kind === "BUSINESS" && <div><strong>Business evidence</strong><div className="ess-muted">{businessUrl ? "Provided" : "Not provided"}</div></div>}
            </div>
            <p className="ess-muted">Your submission will remain pending until the provider or authorised review team confirms it.</p>
            <button className="ess-primary" type="submit" disabled={busy || !base64}>
              {busy ? "Submitting…" : "Submit documents for review"}
            </button>
          </>
        )}
        {msg && <p className="ess-form-error" role="alert">{msg}</p>}
        {currentStep !== "review" && (
          <div className="ess-builder-actions ess-interview-actions">
            <button type="button" className="ess-outline-button" onClick={previousStep} disabled={step === 0}>Previous question</button>
            <button type="button" className="ess-primary" onClick={nextStep}>Next question →</button>
          </div>
        )}
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
