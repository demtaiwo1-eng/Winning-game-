import { useEffect, useMemo, useState } from "react";
import { kycCountriesApi } from "../lib/api";

export type VendorKycAnswers = {
  legalForm?: string;
  registrationStatus?: string;
  registrationEvidence?: string;
  businessEvidence?: string;
  taxStatus?: string;
  operatingAddress?: string;
  regulatedActivity?: string;
  regulatoryLicence?: string;
};

const TAX_LABELS: Record<string, string> = {
  NG: "Tax Identification Number (TIN)",
  GB: "Unique Taxpayer Reference (UTR)",
  US: "Employer Identification Number (EIN)",
  IN: "PAN / GSTIN (as applicable)",
  KE: "KRA PIN",
  GH: "Ghana Card / Taxpayer Identification Number",
  ZA: "Tax reference number",
  CA: "Business Number (BN)",
  AU: "Australian Business Number (ABN)",
};

const LEGAL_FORMS = ["Sole trader / individual", "Partnership", "Limited liability company", "Corporation / public company", "Non-profit / charity", "Other / not sure"];

export default function VendorKycQuestionnaire({
  country,
  value,
  onChange,
}: {
  country: string;
  value: VendorKycAnswers;
  onChange: (next: VendorKycAnswers) => void;
}) {
  const [step, setStep] = useState(0);
  const [countryProfile, setCountryProfile] = useState<{ businessDocs?: string[]; notes?: string | null } | null>(null);
  useEffect(() => {
    let active = true;
    kycCountriesApi.profile(country).then((result) => {
      if (active) setCountryProfile(result.profile as { businessDocs?: string[]; notes?: string | null });
    }).catch(() => { if (active) setCountryProfile(null); });
    return () => { active = false; };
  }, [country]);
  const taxLabel = TAX_LABELS[country] || "Tax identification number (if issued in your country)";
  const questions = useMemo(() => [
    { title: "How is your business legally organised?", help: "This helps us identify the right business verification route.", key: "legalForm" as const, type: "select", options: LEGAL_FORMS },
    { title: "Is the business registered with the relevant authority?", help: "Choose the status that best describes the business today.", key: "registrationStatus" as const, type: "select", options: ["Yes, registered", "Registration in progress", "Not registered", "Not required for my business type"] },
    { title: "Which country-specific business evidence could you provide later?", help: "Choose the evidence type that best matches your business. You will not upload anything in this questionnaire.", key: "businessEvidence" as const, type: "select", options: [...(countryProfile?.businessDocs || []), "Not sure / need guidance", "Not applicable"] },
    
    { title: `Have you been issued a ${taxLabel}?`, help: "We only need to know the status at registration. Do not enter your tax number here.", key: "taxStatus" as const, type: "select", options: ["Yes", "Application in progress", "Not issued / not applicable", "I am not sure"] },
    { title: "What is your main operating business address?", help: "Provide the street address and city where the business operates. A PO box alone may not be sufficient for later verification.", key: "operatingAddress" as const, type: "text" },
    { title: "Do your services require a special permit or professional licence?", help: "For example, regulated transport, security, health, alcohol, or financial services. Requirements vary by country and service.", key: "regulatedActivity" as const, type: "select", options: ["Yes", "No", "Not sure"] },
    { title: "What licence or permit do you hold?", help: "If you selected Yes, tell us the licence name and issuing authority. Do not upload documents here.", key: "regulatoryLicence" as const, type: "text" },
  ], [taxLabel, countryProfile]);
  const current = questions[step];
  const valueForStep = value[current.key] || "";
  const conditional = current.key === "regulatoryLicence" && value.regulatedActivity !== "Yes";
  const required = ["legalForm", "registrationStatus", "taxStatus", "operatingAddress", "regulatedActivity"].includes(current.key);
  const canContinue = conditional || !required || Boolean(valueForStep.trim());
  const setAnswer = (answer: string) => onChange({ ...value, [current.key]: answer });
  return (
    <section className="ess-registration-note" aria-label="Vendor KYC questionnaire" style={{ display: "grid", gap: 12, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <strong>Business verification · {country}</strong>
        <span className="ess-muted">Question {step + 1} of {questions.length}</span>
      </div>
      <div className="ess-registration-progress-track"><span style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div>
      <h3 style={{ margin: 0 }}>{current.title}</h3>
      <p className="ess-muted" style={{ margin: 0 }}>{current.help}</p>
      {step === 2 && countryProfile?.notes && <p className="ess-muted" style={{ margin: 0 }}>{countryProfile.notes}</p>}
      {current.type === "select" ? (
        <select aria-label={current.title} value={valueForStep} onChange={(event) => setAnswer(event.target.value)}>
          <option value="">Choose an answer</option>
          {(current.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input
          aria-label={current.title}
          value={valueForStep}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={current.key === "operatingAddress" ? "Street, city, region" : "Enter answer (optional where stated)"}
          maxLength={current.key === "operatingAddress" ? 300 : 120}
        />
      )}
      {conditional && <p className="ess-muted">This question is not needed based on your previous answer.</p>}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button type="button" className="ess-outline-button" disabled={step === 0} onClick={() => setStep((n) => Math.max(0, n - 1))}>Previous</button>
        {step < questions.length - 1 ? (
          <button type="button" className="ess-primary" disabled={!canContinue} onClick={() => setStep((n) => Math.min(questions.length - 1, n + 1))}>Next question →</button>
        ) : (
          <span className="ess-muted">Questionnaire complete</span>
        )}
      </div>
      <p className="ess-muted" style={{ fontSize: 12, margin: 0 }}>Your answers are sent securely for KYC review. EPHINTA will request supporting evidence separately if the applicable country and service rules require it. This questionnaire is an initial information step, not a guarantee of regulatory compliance or approval.</p>
      <input type="hidden" name="kycQuestionnaire" value={JSON.stringify(value)} />
    </section>
  );
}
