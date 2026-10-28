// /**
//  * ESS Landing — functional portals + 12 marketing blocks + mobile menu
//  * Install: apps/web/src/components/LandingPage.tsx
//  *
//  * ESS Landing — functional entry to real portals
//  * Path: apps/web/src/components/LandingPage.tsx
//  *
//  * Register roles: CLIENT | VENDOR | AFFILIATE | VERIFIER | CONSULTANT
//  */
// import React, { useEffect, useState } from "react";

// type AuthPayload = {
//   accessToken: string;
//   refreshToken: string;
//   user: { id: string; email: string; name: string; role: string; locale?: string; country?: string; currency?: string };
// };

// type PortalRole = "CLIENT" | "VENDOR" | "VERIFIER" | "CONSULTANT" | "AFFILIATE";

// interface LandingPageProps {
//   onLoginSuccess: (payload: AuthPayload) => void;
// }

// const EVENT_TYPES = [
//   "PERSONAL", "CORPORATE", "SOCIAL", "SPORTS", "CULTURAL",
//   "RELIGIOUS", "POLITICAL", "ENTERTAINMENT", "EDUCATIONAL", "VIRTUAL",
// ] as const;

// const CSS = `
// .ess{--bg:#f7f8fb;--surface:#fff;--ink:#0f172a;--mute:#64748b;--line:#e2e8f0;--line2:#cbd5e1;
//   --brand:#0f172a;--accent:#ea580c;--accent2:#c2410c;--accent-soft:#fff7ed;
//   --radius:14px;--shadow:0 1px 2px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.06);
//   background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh}
// .ess *{box-sizing:border-box}.ess button{font:inherit;cursor:pointer}
// .ess :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
// .ess-wrap{max-width:1100px;margin:0 auto;padding:0 20px}
// .ess-nav{position:sticky;top:0;z-index:50;background:rgba(247,248,251,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
// .ess-nav-inner{display:flex;align-items:center;gap:16px;height:60px}
// .ess-logo{display:flex;align-items:center;gap:10px;background:none;border:0;padding:0}
// .ess-mark{width:36px;height:36px;border-radius:10px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:900;font-size:12px}
// .ess-logo strong{font-size:15px;font-weight:800;letter-spacing:-.02em}.ess-logo span{display:block;font-size:11px;color:var(--mute);font-weight:500}
// .ess-nav-links{display:flex;gap:4px;flex:1;margin-left:8px}
// .ess-nav-links button{background:none;border:0;color:var(--mute);font-weight:600;font-size:13px;padding:8px 12px;border-radius:8px}
// .ess-nav-links button:hover{color:var(--ink);background:#eef2f7}
// .ess-nav-actions{display:flex;gap:8px;align-items:center}
// .ess-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;border-radius:10px;font-weight:700;font-size:13px;border:1.5px solid transparent}
// .ess-btn:disabled{opacity:.55;cursor:not-allowed}
// .ess-btn-primary{background:var(--brand);color:#fff}.ess-btn-primary:hover{background:#1e293b}
// .ess-btn-accent{background:var(--accent);color:#fff}.ess-btn-accent:hover{background:var(--accent2)}
// .ess-btn-ghost{background:var(--surface);border-color:var(--line2);color:var(--ink)}.ess-btn-ghost:hover{border-color:var(--ink)}
// .ess-btn-soft{background:var(--accent-soft);color:var(--accent2)}.ess-btn-soft:hover{background:#ffedd5}
// .ess-burger{display:none;width:42px;height:42px;border-radius:10px;border:1.5px solid var(--line2);background:var(--surface);align-items:center;justify-content:center;flex-direction:column;gap:5px;padding:0}
// .ess-burger i{display:block;width:18px;height:2px;background:var(--ink);border-radius:1px}
// .ess-drawer{position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.45)}
// .ess-drawer-panel{position:absolute;right:0;top:0;bottom:0;width:min(90vw,320px);background:#fff;padding:16px;display:flex;flex-direction:column;gap:4px;box-shadow:-8px 0 32px rgba(15,23,42,.12)}
// .ess-drawer-panel button.row{width:100%;text-align:left;padding:14px 12px;border:0;background:none;border-radius:10px;font-weight:600;font-size:15px}
// .ess-drawer-panel button.row:hover{background:#f1f5f9}
// .ess-hero{padding:48px 0 40px}
// .ess-hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:36px;align-items:start}
// .ess-kicker{display:inline-flex;font-size:12px;font-weight:700;color:var(--accent2);background:var(--accent-soft);padding:6px 12px;border-radius:999px;margin-bottom:14px}
// .ess-hero h1{font-size:clamp(1.85rem,4vw,2.65rem);line-height:1.12;letter-spacing:-.03em;margin:0 0 12px;font-weight:800}
// .ess-hero .lead{color:var(--mute);font-size:16px;margin:0 0 22px;max-width:34rem}
// .ess-hero-ctas{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
// .ess-mini{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--mute);font-weight:600}
// .ess-mini b{color:var(--ink)}
// .ess-panel{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:var(--shadow)}
// .ess-panel h2{margin:0 0 6px;font-size:17px;font-weight:800}
// .ess-panel .hint{color:var(--mute);font-size:13px;margin:0 0 14px}
// .ess-steps{display:flex;gap:6px;margin-bottom:14px}
// .ess-steps span{flex:1;height:4px;border-radius:99px;background:var(--line)}
// .ess-steps span.on{background:var(--accent)}
// .ess-label{display:block;font-size:12px;font-weight:700;color:var(--mute);margin-bottom:12px}
// .ess-label>*{margin-top:6px}
// .ess-input,.ess-select{width:100%;padding:10px 12px;border:1.5px solid var(--line2);border-radius:10px;background:#fff;color:var(--ink);font:inherit}
// .ess-input:focus,.ess-select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(234,88,12,.15)}
// .ess-chips{display:flex;flex-wrap:wrap;gap:6px}
// .ess-chips button{padding:7px 11px;border-radius:999px;border:1.5px solid var(--line2);background:#fff;font-size:12px;font-weight:600}
// .ess-chips button.on{background:var(--brand);border-color:var(--brand);color:#fff}
// .ess-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
// .ess-sec{padding:40px 0}
// .ess-sec h2{margin:0 0 8px;font-size:clamp(1.35rem,2.5vw,1.75rem);font-weight:800;letter-spacing:-.02em}
// .ess-sec .sub{color:var(--mute);margin:0 0 24px;max-width:36rem;font-size:14px}
// .ess-portals{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
// .ess-portal{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--shadow)}
// .ess-portal:hover{border-color:#94a3b8}
// .ess-portal .tag{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)}
// .ess-portal h3{margin:0;font-size:16px;font-weight:800}
// .ess-portal p{margin:0;font-size:13px;color:var(--mute);flex:1}
// .ess-portal ul{margin:0;padding:0;list-style:none}
// .ess-portal li{font-size:12px;color:var(--ink);padding:4px 0;border-top:1px solid var(--line)}
// .ess-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
// .ess-flow article{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px}
// .ess-flow .n{font-size:11px;font-weight:800;color:var(--accent2);margin-bottom:6px}
// .ess-flow h3{margin:0 0 6px;font-size:14px}.ess-flow p{margin:0;font-size:12px;color:var(--mute)}
// .ess-split{display:grid;grid-template-columns:1fr 1fr;gap:14px}
// .ess-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px}
// .ess-card h3{margin:0 0 6px;font-size:15px}.ess-card p{margin:0;font-size:13px;color:var(--mute)}
// .ess-faq details{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin-bottom:8px;padding:12px 14px}
// .ess-faq summary{font-weight:700;cursor:pointer;font-size:14px}
// .ess-faq p{margin:8px 0 0;font-size:13px;color:var(--mute)}
// .ess-ft{border-top:1px solid var(--line);padding:28px 0;font-size:12px;color:var(--mute)}
// .ess-ft-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:20px;margin-bottom:20px}
// .ess-ft h4{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink)}
// .ess-ft button{background:none;border:0;padding:0;display:block;color:var(--mute);font-size:13px;margin-bottom:6px;text-align:left}
// .ess-ft button:hover{color:var(--ink)}
// .ess-modal{position:fixed;inset:0;z-index:70;background:rgba(15,23,42,.5);display:grid;place-items:center;padding:16px}
// .ess-dialog{width:100%;max-width:440px;max-height:92vh;overflow:auto;background:#fff;border-radius:16px;padding:22px;border:1px solid var(--line);box-shadow:0 20px 50px rgba(15,23,42,.2)}
// .ess-dialog h2{margin:0;font-size:20px;font-weight:800}
// .ess-err{color:#b91c1c;font-size:13px;margin:0 0 10px;background:#fef2f2;padding:8px 10px;border-radius:8px}
// .ess-roles{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
// .ess-roles button{padding:7px 11px;border-radius:999px;border:1.5px solid var(--line2);background:#fff;font-size:12px;font-weight:600}
// .ess-roles button.on{background:var(--brand);color:#fff;border-color:var(--brand)}
// @media(max-width:900px){
//   .ess-nav-links,.ess-nav-actions .hide-m{display:none}
//   .ess-burger{display:flex}
//   .ess-hero-grid,.ess-portals,.ess-flow,.ess-split,.ess-ft-grid,.ess-row2{grid-template-columns:1fr}
// }
// @media(max-width:600px){
//   .ess-hero{padding:28px 0 24px}
// }
// `;

// const PORTALS: { role: PortalRole; tag: string; title: string; desc: string; points: string[]; cta: string }[] = [
//   {
//     role: "CLIENT",
//     tag: "Customer",
//     title: "Plan an event",
//     desc: "Client workspace: create events, guests, tasks, budget, book verified vendors with escrow.",
//     points: ["Event wizard & workspace", "Guests · tasks · budget", "Marketplace booking", "Escrow payments"],
//     cta: "Start as customer",
//   },
//   {
//     role: "VENDOR",
//     tag: "Service provider",
//     title: "Sell event services",
//     desc: "Vendor portal: business profile, KYC, listings, fulfil bookings.",
//     points: ["Business profile", "KYC verification", "List venues / goods / services", "Escrow releases"],
//     cta: "Register as vendor",
//   },
//   {
//     role: "VERIFIER",
//     tag: "Readiness verifier",
//     title: "Verify event readiness",
//     desc: "Service checks and readiness status (green / amber / red) across event zones.",
//     points: ["Readiness workflow", "Service checks", "Zone verification", "Operational sign-off"],
//     cta: "Join as verifier",
//   },
// ];

// const CLIENT_FLOW = [
//   { n: "1 · Account", t: "Create CLIENT account", d: "Register as CLIENT → App opens Workspace." },
//   { n: "2 · Event", t: "Create event", d: "Title, type, date, city, guests, currency." },
//   { n: "3 · Operate", t: "Guests, tasks, budget", d: "RSVPs, checklist, planned vs actual spend." },
//   { n: "4 · Book", t: "Vendors & escrow", d: "Select listings; pay into escrow until fulfilment." },
// ];

// const FAQ = [
//   ["I am planning a wedding or conference — where do I go?", "Choose Plan an event (CLIENT). After sign-in you enter the client workspace and create your event."],
//   ["I provide catering, venue, or security — where do I go?", "Choose Sell event services (VENDOR). Add business name, complete KYC, then publish listings."],
//   ["What does a verifier do?", "VERIFIER accounts work with readiness and service checks. Use Join as verifier for operational sign-off."],
//   ["Password rules?", "API requires 12+ characters with uppercase, lowercase, number, and symbol."],
// ];

// export default function LandingPage({ onLoginSuccess }: LandingPageProps) {
//   const [menu, setMenu] = useState(false);
//   const [modal, setModal] = useState<null | "signin" | "register">(null);
//   const [regRole, setRegRole] = useState<PortalRole>("CLIENT");
//   const [busy, setBusy] = useState(false);
//   const [err, setErr] = useState("");
//   const [form, setForm] = useState({ name: "", email: "", password: "", businessName: "", country: "NG", currency: "NGN" });
//   const [wizStep, setWizStep] = useState(0);
//   const [draft, setDraft] = useState({
//     title: "",
//     type: "PERSONAL" as (typeof EVENT_TYPES)[number],
//     date: "",
//     city: "",
//     country: "NG",
//     guests: "",
//     currency: "NGN",
//   });

//   useEffect(() => {
//     if (!menu && !modal) return;
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === "Escape") { setMenu(false); setModal(null); }
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [menu, modal]);

//   const go = (id: string) => {
//     setMenu(false);
//     setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
//   };

//   const openRegister = (role: PortalRole) => {
//     setRegRole(role);
//     setErr("");
//     setMenu(false);
//     setModal("register");
//   };

//   const openSignIn = () => {
//     setErr("");
//     setMenu(false);
//     setModal("signin");
//   };

//   const saveDraft = () => {
//     try { localStorage.setItem("ess:eventDraft", JSON.stringify(draft)); } catch { /* */ }
//   };

//   const continueClientWizard = () => {
//     if (wizStep < 2) { setWizStep((s) => s + 1); return; }
//     saveDraft();
//     openRegister("CLIENT");
//   };

//   const submitAuth = async () => {
//     setErr("");
//     if (modal === "register") {
//       const pw = form.password;
//       if (pw.length < 12 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw) || !/[^A-Za-z\d]/.test(pw)) {
//         setErr("Password needs 12+ characters with uppercase, lowercase, number, and symbol.");
//         return;
//       }
//       if (form.name.trim().length < 2) { setErr("Enter your full name."); return; }
//       if (regRole === "VENDOR" && form.businessName.trim().length < 2) {
//         setErr("Business name is required for vendors.");
//         return;
//       }
//     }
//     setBusy(true);
//     try {
//       const path = modal === "signin" ? "login" : "register";
//       const body =
//         modal === "signin"
//           ? { email: form.email.trim().toLowerCase(), password: form.password }
//           : {
//               name: form.name.trim(),
//               email: form.email.trim().toLowerCase(),
//               password: form.password,
//               role: regRole,
//               country: form.country || undefined,
//               currency: form.currency || "NGN",
//               ...(regRole === "VENDOR" ? { businessName: form.businessName.trim() } : {}),
//             };
//       const res = await fetch(`/api/v1/auth/${path}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(body),
//       });
//       const data = await res.json().catch(() => ({}));
//       if (!res.ok) {
//         const field = data?.error?.details?.fieldErrors;
//         throw new Error(
//           (field && (Object.values(field).flat()[0] as string)) ||
//             data?.error?.message ||
//             "Request failed. Check details and try again."
//         );
//       }
//       if (modal === "register" && regRole === "CLIENT") saveDraft();
//       onLoginSuccess(data as AuthPayload);
//     } catch (e: unknown) {
//       setErr(e instanceof Error ? e.message : "Request failed");
//       setBusy(false);
//     }
//   };

//   return (
//     <div className="ess">
//       <style>{CSS}</style>

//       <header className="ess-nav">
//         <div className="ess-wrap ess-nav-inner">
//           <button type="button" className="ess-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
//             <span className="ess-mark">EPHINTA</span>
//             <span><strong>EPHINTA</strong><span>Plan · Vendor · Verify</span></span>
//           </button>
//           <nav className="ess-nav-links" aria-label="Primary">
//             <button type="button" onClick={() => go("portals")}>Portals</button>
//             <button type="button" onClick={() => go("wizard")}>Event wizard</button>
//             <button type="button" onClick={() => go("flow")}>How it works</button>
//             <button type="button" onClick={() => go("faq")}>FAQ</button>
//           </nav>
//           <div className="ess-nav-actions">
//             <button type="button" className="ess-btn ess-btn-ghost hide-m" onClick={openSignIn}>Sign in</button>
//             <button type="button" className="ess-btn ess-btn-primary" onClick={() => openRegister("CLIENT")}>Plan an event</button>
//             <button type="button" className="ess-burger" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>
//               <i /><i /><i />
//             </button>
//           </div>
//         </div>
//       </header>

//       {menu && (
//         <div className="ess-drawer" onClick={() => setMenu(false)} role="presentation">
//           <div className="ess-drawer-panel" role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
//             <button type="button" className="row" style={{ fontSize: 22, textAlign: "right" }} onClick={() => setMenu(false)} aria-label="Close">×</button>
//             <button type="button" className="row" onClick={() => go("portals")}>Portals</button>
//             <button type="button" className="row" onClick={() => go("wizard")}>Event wizard</button>
//             <button type="button" className="row" onClick={() => go("flow")}>How it works</button>
//             <button type="button" className="row" onClick={() => go("faq")}>FAQ</button>
//             <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
//               <button type="button" className="ess-btn ess-btn-ghost" onClick={openSignIn}>Sign in</button>
//               <button type="button" className="ess-btn ess-btn-primary" onClick={() => openRegister("CLIENT")}>Client portal</button>
//               <button type="button" className="ess-btn ess-btn-ghost" onClick={() => openRegister("VENDOR")}>Vendor portal</button>
//               <button type="button" className="ess-btn ess-btn-ghost" onClick={() => openRegister("VERIFIER")}>Verifier portal</button>
//             </div>
//           </div>
//         </div>
//       )}

//       <section className="ess-hero">
//         <div className="ess-wrap ess-hero-grid">
//           <div>
//             <div className="ess-kicker">Operational entry — matches live App routes</div>
//             <h1>Enter the correct portal for how you use ESS</h1>
//             <p className="lead">
//               Customers plan in the client workspace. Vendors list and fulfil services.
//               Verifiers run readiness checks. After login, App.tsx routes you by role.
//             </p>
//             <div className="ess-hero-ctas">
//               <button type="button" className="ess-btn ess-btn-primary" onClick={() => go("wizard")}>Customer: event wizard</button>
//               <button type="button" className="ess-btn ess-btn-ghost" onClick={() => go("portals")}>All portals</button>
//               <button type="button" className="ess-btn ess-btn-soft" onClick={openSignIn}>I already have an account</button>
//             </div>
//             <div className="ess-mini">
//               <span><b>CLIENT</b> → Workspace</span>
//               <span><b>VENDOR</b> → Vendor portal</span>
//               <span><b>VERIFIER</b> → Workspace + readiness</span>
//             </div>
//           </div>

//           <div className="ess-panel" id="wizard">
//             <h2>Customer event starter</h2>
//             <p className="hint">Questions mirror the workspace Create event form. Draft is saved before CLIENT registration.</p>
//             <div className="ess-steps" aria-hidden>
//               <span className={wizStep >= 0 ? "on" : ""} />
//               <span className={wizStep >= 1 ? "on" : ""} />
//               <span className={wizStep >= 2 ? "on" : ""} />
//             </div>
//             {wizStep === 0 && (
//               <>
//                 <label className="ess-label">Event title
//                   <input className="ess-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Adebayo family wedding" />
//                 </label>
//                 <label className="ess-label">Event type
//                   <div className="ess-chips">
//                     {EVENT_TYPES.map((t) => (
//                       <button key={t} type="button" className={draft.type === t ? "on" : ""} onClick={() => setDraft({ ...draft, type: t })}>{t}</button>
//                     ))}
//                   </div>
//                 </label>
//               </>
//             )}
//             {wizStep === 1 && (
//               <div className="ess-row2">
//                 <label className="ess-label">Date
//                   <input className="ess-input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
//                 </label>
//                 <label className="ess-label">Expected guests
//                   <input className="ess-input" type="number" min={1} value={draft.guests} onChange={(e) => setDraft({ ...draft, guests: e.target.value })} />
//                 </label>
//                 <label className="ess-label">City
//                   <input className="ess-input" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Lagos" />
//                 </label>
//                 <label className="ess-label">Country
//                   <input className="ess-input" maxLength={2} value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })} />
//                 </label>
//               </div>
//             )}
//             {wizStep === 2 && (
//               <>
//                 <label className="ess-label">Budget currency
//                   <select className="ess-select" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })}>
//                     <option value="NGN">NGN</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option>
//                   </select>
//                 </label>
//                 <p className="hint">Next: create a <b>CLIENT</b> account → client workspace for guests, tasks, budget, vendors.</p>
//               </>
//             )}
//             <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
//               {wizStep > 0 && <button type="button" className="ess-btn ess-btn-ghost" onClick={() => setWizStep((s) => s - 1)}>Back</button>}
//               <button type="button" className="ess-btn ess-btn-accent" style={{ flex: 1 }} onClick={continueClientWizard}>
//                 {wizStep < 2 ? "Continue" : "Create client account"}
//               </button>
//             </div>
//           </div>
//         </div>
//       </section>

//       <section className="ess-sec" id="portals" style={{ background: "#fff", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
//         <div className="ess-wrap">
//           <h2>Choose your portal</h2>
//           <p className="sub">Register sends the correct role to /api/v1/auth/register. App routes by role after login.</p>
//           <div className="ess-portals">
//             {PORTALS.map((p) => (
//               <div key={p.role} className="ess-portal">
//                 <div className="tag">{p.tag} · {p.role}</div>
//                 <h3>{p.title}</h3>
//                 <p>{p.desc}</p>
//                 <ul>{p.points.map((x) => <li key={x}>{x}</li>)}</ul>
//                 <button type="button" className={`ess-btn ${p.role === "CLIENT" ? "ess-btn-primary" : "ess-btn-ghost"}`} onClick={() => openRegister(p.role)}>{p.cta}</button>
//               </div>
//             ))}
//           </div>
//           <div className="ess-split" style={{ marginTop: 14 }}>
//             <div className="ess-card">
//               <h3>Consultant</h3>
//               <p>CONSULTANT accounts use workspace tools without vendor listings.</p>
//               <button type="button" className="ess-btn ess-btn-ghost" style={{ marginTop: 10 }} onClick={() => openRegister("CONSULTANT")}>Register consultant</button>
//             </div>
//             <div className="ess-card">
//               <h3>Affiliate</h3>
//               <p>AFFILIATE accounts for referral-oriented use.</p>
//               <button type="button" className="ess-btn ess-btn-ghost" style={{ marginTop: 10 }} onClick={() => openRegister("AFFILIATE")}>Register affiliate</button>
//             </div>
//           </div>
//         </div>
//       </section>

//       <section className="ess-sec" id="flow">
//         <div className="ess-wrap">
//           <h2>Client path (after register)</h2>
//           <p className="sub">Real Workspace sequence — not brochure copy.</p>
//           <div className="ess-flow">
//             {CLIENT_FLOW.map((s) => (
//               <article key={s.n}><div className="n">{s.n}</div><h3>{s.t}</h3><p>{s.d}</p></article>
//             ))}
//           </div>
//           <div className="ess-split" style={{ marginTop: 20 }}>
//             <div className="ess-card">
//               <h3>Vendor path</h3>
//               <p>Register VENDOR → business name → profile → KYC → listings → fulfil when clients book.</p>
//             </div>
//             <div className="ess-card">
//               <h3>Verifier path</h3>
//               <p>Register VERIFIER → readiness and service checks (green / amber / red). Operational, not party planning.</p>
//             </div>
//           </div>
//         </div>
//       </section>

//       <section className="ess-sec" id="faq" style={{ background: "#fff", borderTop: "1px solid var(--line)" }}>
//         <div className="ess-wrap" style={{ maxWidth: 720 }}>
//           <h2>FAQ</h2>
//           <p className="sub">Tied to how this codebase routes users.</p>
//           <div className="ess-faq">
//             {FAQ.map(([q, a]) => (
//               <details key={q}><summary>{q}</summary><p>{a}</p></details>
//             ))}
//           </div>
//         </div>
//       </section>

//       <footer className="ess-ft">
//         <div className="ess-wrap">
//           <div className="ess-ft-grid">
//             <div>
//               <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
//                 <span className="ess-mark">EPHINTA</span>
//                 <strong style={{ color: "var(--ink)" }}>EPHINTA</strong>
//               </div>
//               <p style={{ margin: 0 }}>Event planning workspace, vendor marketplace, escrow, readiness verification.</p>
//             </div>
//             <div>
//               <h4>Enter</h4>
//               <button type="button" onClick={openSignIn}>Sign in</button>
//               <button type="button" onClick={() => openRegister("CLIENT")}>Client</button>
//               <button type="button" onClick={() => openRegister("VENDOR")}>Vendor</button>
//               <button type="button" onClick={() => openRegister("VERIFIER")}>Verifier</button>
//             </div>
//             <div>
//               <h4>On this page</h4>
//               <button type="button" onClick={() => go("portals")}>Portals</button>
//               <button type="button" onClick={() => go("wizard")}>Wizard</button>
//               <button type="button" onClick={() => go("flow")}>Flow</button>
//               <button type="button" onClick={() => go("faq")}>FAQ</button>
//             </div>
//           </div>
//           <div>© {new Date().getFullYear()} EPHINTA</div>
//         </div>
//       </footer>

//       {modal && (
//         <div className="ess-modal" onClick={() => setModal(null)} role="presentation">
//           <div className="ess-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
//             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
//               <h2>{modal === "signin" ? "Sign in" : "Create account"}</h2>
//               <button type="button" className="ess-btn ess-btn-ghost" style={{ padding: "4px 10px" }} onClick={() => setModal(null)} aria-label="Close">×</button>
//             </div>
//             {modal === "register" && (
//               <>
//                 <label className="ess-label">Account type
//                   <div className="ess-roles">
//                     {(["CLIENT", "VENDOR", "VERIFIER", "CONSULTANT", "AFFILIATE"] as PortalRole[]).map((r) => (
//                       <button key={r} type="button" className={regRole === r ? "on" : ""} onClick={() => setRegRole(r)}>{r}</button>
//                     ))}
//                   </div>
//                 </label>
//                 <label className="ess-label">Full name
//                   <input className="ess-input" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
//                 </label>
//                 {regRole === "VENDOR" && (
//                   <label className="ess-label">Business name (required)
//                     <input className="ess-input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
//                   </label>
//                 )}
//                 <div className="ess-row2">
//                   <label className="ess-label">Country
//                     <input className="ess-input" maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
//                   </label>
//                   <label className="ess-label">Currency
//                     <select className="ess-select" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
//                       <option value="NGN">NGN</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option>
//                     </select>
//                   </label>
//                 </div>
//               </>
//             )}
//             <label className="ess-label">Email
//               <input className="ess-input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
//             </label>
//             <label className="ess-label">Password{modal === "register" ? " (12+, upper, lower, number, symbol)" : ""}
//               <input className="ess-input" type="password" autoComplete={modal === "signin" ? "current-password" : "new-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submitAuth()} />
//             </label>
//             {err && <p className="ess-err" role="alert">{err}</p>}
//             <button type="button" className="ess-btn ess-btn-primary" style={{ width: "100%" }} disabled={busy} onClick={submitAuth}>
//               {busy ? "Please wait…" : modal === "signin" ? "Sign in to portal" : `Create ${regRole} account`}
//             </button>
//             <p style={{ textAlign: "center", fontSize: 13, color: "var(--mute)", margin: "14px 0 0" }}>
//               {modal === "signin" ? "Need an account? " : "Already registered? "}
//               <button type="button" style={{ background: "none", border: 0, color: "var(--accent2)", fontWeight: 700, padding: 0 }} onClick={() => { setErr(""); setModal(modal === "signin" ? "register" : "signin"); }}>
//                 {modal === "signin" ? "Register" : "Sign in"}
//               </button>
//             </p>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
