import React, { useEffect, useState } from 'react';

type AuthPayload = { accessToken: string; refreshToken: string; user: { id: string; email: string; name: string; role: string } };
interface LandingPageProps { onLoginSuccess: (payload: AuthPayload) => void; }

async function auth({ path, body }: { path: 'login' | 'register'; body: unknown; }): Promise<AuthPayload> {
  const res = await fetch(`/api/v1/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    const f = d?.error?.details?.fieldErrors;
    throw new Error((f && (Object.values(f).flat()[0] as string)) || d?.error?.message || 'Request failed. Try again.');
  }
  return d;
}

const NEEDS: Record<string, string[]> = {
  Wedding: ['Venue', 'Catering', 'Photography', 'Decor', 'Music'],
  Birthday: ['Venue', 'Catering', 'Cake', 'Entertainment'],
  'Naming ceremony': ['Venue', 'Catering', 'Decor', 'Photography'],
  'Corporate event': ['Venue', 'AV and staging', 'Catering', 'Security'],
  Graduation: ['Venue', 'Catering', 'Photography', 'Music'],
  Remembrance: ['Venue', 'Catering', 'Transport', 'Security'],
};
const VIBES = ['Classic', 'Modern', 'Traditional', 'Garden', 'Luxury', 'Intimate'];
const FAQ = [
  ['Is it really free?', 'Yes. Planning and booking carry no platform fee. Vendors set their own prices.'],
  ['How does escrow protect me?', 'Your payment is held and only released to a vendor once the service is delivered, so a no-show does not cost you.'],
  ['Who are the vendors?', 'Every service provider completes identity and business verification before their listings go live.'],
  ['Which countries are covered?', 'Events can be planned in many regions, with local tax shown on each booking.'],
];

const CSS = `
.pl{--bg:#f4f7fb;--ink:#12203a;--mute:#5a6b86;--line:#d8e0ec;--blue:#2f4bff;--coral:#ff6a4d;--card:#fff;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh}
.pl *{box-sizing:border-box}.pl h1,.pl h2,.pl h3{margin:0;font-weight:800;letter-spacing:-.025em;line-height:1.08}.pl button{font:inherit;color:inherit;cursor:pointer}.pl :focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.pl-w{max-width:1160px;margin:0 auto;padding:0 24px}
.pl-nav{position:sticky;top:0;z-index:30;background:rgba(244,247,251,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}.pl-nav .pl-w{display:flex;align-items:center;gap:22px;height:66px}
.pl-logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;background:none;border:0;padding:0}.pl-mk{width:34px;height:34px;border-radius:50% 50% 50% 8px;background:var(--blue);color:#fff;display:grid;place-items:center;font-size:14px}
.pl-lk{display:flex;gap:22px;flex:1;margin-left:18px}.pl-lk a{color:var(--mute);text-decoration:none;font-weight:500}.pl-lk a:hover{color:var(--ink)}
.pl-b{padding:11px 20px;border-radius:999px;border:1.5px solid var(--ink);background:transparent;font-weight:700;font-size:15px}.pl-b.p{background:var(--blue);border-color:var(--blue);color:#fff}.pl-b.p:hover{background:#2339d6}.pl-b.c{background:var(--coral);border-color:var(--coral);color:#fff}.pl-b:disabled{opacity:.6}
.pl-t{background:none;border:0;font-weight:600;padding:0}.pl-burger{display:none;margin-left:auto;width:44px;height:44px;border-radius:12px;border:1.5px solid var(--ink);background:none;place-items:center}
.pl-dr{position:fixed;inset:0;z-index:40;background:rgba(18,32,58,.5)}.pl-dr nav{position:absolute;right:0;top:0;bottom:0;width:min(86vw,330px);background:#fff;padding:20px;display:flex;flex-direction:column;gap:4px;animation:pli .22s ease-out}
.pl-dr a{padding:14px 10px;border-radius:12px;color:var(--ink);text-decoration:none;font-size:18px;font-weight:600}.pl-dr a:hover{background:var(--bg)}@keyframes pli{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
.pl-hero{padding:64px 0 72px}.pl-hero .pl-w{display:grid;grid-template-columns:1.05fr .95fr;gap:52px;align-items:center}
.pl-hero h1{font-size:clamp(2.5rem,5.6vw,4.6rem);margin-bottom:20px}.pl-hero h1 em{font-style:normal;color:var(--blue)}.pl-hero p{color:var(--mute);font-size:19px;max-width:520px;margin:0 0 26px}
.pl-trust{display:flex;gap:22px;flex-wrap:wrap;margin-top:28px;color:var(--mute);font-size:14px;font-weight:600}
.pl-brief{background:var(--card);border:1.5px solid var(--ink);border-radius:24px;padding:26px;box-shadow:8px 8px 0 var(--ink)}
.pl-brief h2{font-size:22px;margin-bottom:16px}.pl-brief label{display:block;font-size:13px;font-weight:700;color:var(--mute);margin-bottom:12px}.pl-brief label>*{margin-top:6px}
.pl-in{width:100%;padding:11px 13px;border:1.5px solid var(--line);border-radius:12px;font:inherit;background:#fff;color:var(--ink)}.pl-g{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pl-ch{display:flex;flex-wrap:wrap;gap:7px}.pl-ch button{padding:7px 13px;border-radius:999px;border:1.5px solid var(--line);background:#fff;font-size:14px;font-weight:600}.pl-ch button[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:#fff}
.pl-sum{margin-top:14px;padding:14px;border-radius:14px;background:var(--bg);font-size:14px}.pl-sum b{display:block;font-size:17px;margin-bottom:4px}
.pl-s{padding:76px 0}.pl-s h2{font-size:clamp(1.8rem,3.6vw,2.7rem);margin-bottom:12px}.pl-sb{color:var(--mute);max-width:600px;margin:0 0 36px;font-size:17px}
.pl-st{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.pl-card{background:var(--card);border:1.5px solid var(--line);border-radius:20px;padding:24px}.pl-card h3{font-size:20px;margin:10px 0 8px}.pl-card p{margin:0;color:var(--mute)}
.pl-n{width:36px;height:36px;border-radius:50%;background:var(--coral);color:#fff;display:grid;place-items:center;font-weight:800}
.pl-ls{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.pl-li{background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:6px}.pl-li small{color:var(--mute)}.pl-li strong{font-size:17px;line-height:1.3}
.pl-pr{font-size:22px;font-weight:800;margin-top:6px}.pl-dark{background:var(--ink);color:#fff}.pl-dark .pl-sb{color:#b8c4da}.pl-dark .pl-card{background:#1b2d4e;border-color:#2c426c}.pl-dark .pl-card p{color:#b8c4da}
.pl-tr{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.pl-fq{max-width:760px}.pl-fq details{border-bottom:1.5px solid var(--line);padding:16px 0}.pl-fq summary{font-weight:700;font-size:18px;cursor:pointer}.pl-fq p{color:var(--mute);margin:10px 0 0}
.pl-ft{border-top:1.5px solid var(--line);padding:28px 0;text-align:center;color:var(--mute);font-size:13px}
.pl-md{position:fixed;inset:0;z-index:60;background:rgba(18,32,58,.6);display:grid;place-items:center;padding:16px}.pl-dl{width:100%;max-width:440px;max-height:92vh;overflow:auto;background:#fff;border-radius:22px;padding:26px}
.pl-dl label{display:block;font-size:13px;font-weight:700;color:var(--mute);margin-bottom:12px}.pl-dl label>*{margin-top:6px}.pl-er{color:#c62828;font-size:14px;margin:0 0 12px}
@media(max-width:960px){.pl-lk,.pl-d{display:none}.pl-burger{display:grid}.pl-hero .pl-w{grid-template-columns:1fr}.pl-ls{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.pl-st,.pl-tr,.pl-ls,.pl-g{grid-template-columns:1fr}.pl-w{padding:0 16px}.pl-brief{box-shadow:5px 5px 0 var(--ink)}}
@media(prefers-reduced-motion:reduce){.pl *{animation:none!important;transition:none!important}}
`;

export default function LandingPage({ onLoginSuccess }: LandingPageProps) {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<null | 'signin' | 'register'>(null);
  const [role, setRole] = useState<'customer' | 'vendor' | 'organization'>('customer');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [d, setD] = useState({ type: '', guests: '', date: '', vibe: '' });

  useEffect(() => { if (!modal && !menu) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && (setModal(null), setMenu(false)); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [modal, menu]);

  const go = (id: string) => { setMenu(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 30); };
  const open = (m: 'signin' | 'register', r?: typeof role) => { if (r) setRole(r); setErr(''); setMenu(false); setModal(m); };
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const saveDraft = () => { try { localStorage.setItem('ess:eventDraft', JSON.stringify(d)); } catch { /* storage unavailable */ } };
  const submit = async () => {
    setErr('');
    if (modal === 'register' && form.password.length < 12) return setErr('Use a password with at least 12 characters.');
    setBusy(true);
    try { onLoginSuccess(modal === 'signin' ? await auth({ path: 'login', body: { email: form.email, password: form.password } }) : await auth({ path: 'register', body: { ...form, ...(role === 'vendor' ? { role: 'VENDOR' } : {}) } })); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  };
  const nice = d.date ? new Date(d.date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : 'date to be decided';

  return (
    <div className="pl">
      <style>{CSS}</style>
      <header className="pl-nav"><div className="pl-w">
        <button className="pl-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span className="pl-mk">EP</span>EPHINTA</button>
        <nav className="pl-lk" aria-label="Main"><a href="#how" onClick={(e) => { e.preventDefault(); go('how'); }}>How it works</a><a href="#vendors" onClick={(e) => { e.preventDefault(); go('vendors'); }}>Vendors</a><a href="#trust" onClick={(e) => { e.preventDefault(); go('trust'); }}>Safety</a><a href="#faq" onClick={(e) => { e.preventDefault(); go('faq'); }}>FAQ</a></nav>
        <button className="pl-t pl-d" onClick={() => open('signin')}>Sign in</button><button className="pl-b p pl-d" onClick={() => open('register')}>Create account</button>
        <button className="pl-burger" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14" /></svg></button>
      </div></header>

      {menu && <div className="pl-dr" onClick={() => setMenu(false)}><nav aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <button className="pl-t" style={{ alignSelf: 'flex-end', fontSize: 28 }} aria-label="Close menu" onClick={() => setMenu(false)}>×</button>
        {([['how', 'How it works'], ['vendors', 'Vendors'], ['trust', 'Safety'], ['faq', 'FAQ']] as const).map(([id, l]) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); go(id); }}>{l}</a>)}
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}><button className="pl-b" onClick={() => open('signin')}>Sign in</button><button className="pl-b p" onClick={() => open('register')}>Create account</button><button className="pl-b" onClick={() => open('register', 'vendor')}>Offer your services</button></div>
      </nav></div>}

      <section className="pl-hero"><div className="pl-w">
        <div>
          <h1>Plan the event you imagine. <em>Book people you can trust.</em></h1>
          <p>Design your event in a minute, then find verified vendors and pay safely through escrow. No planner fees, no surprises.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><button className="pl-b p" onClick={() => open('register')}>Create free account</button><button className="pl-b" onClick={() => go('how')}>See how it works</button></div>
          <div className="pl-trust"><span>✓ Verified vendors</span><span>✓ Escrow payments</span><span>✓ No platform fees</span></div>
        </div>
        <div className="pl-brief" aria-label="Design your event">
          <h2>Design your event</h2>
          <label>What are you planning?<div className="pl-ch">{Object.keys(NEEDS).map((t) => <button key={t} aria-pressed={d.type === t} onClick={() => setD({ ...d, type: t })}>{t}</button>)}</div></label>
          <div className="pl-g"><label>Guests<input className="pl-in" type="number" min={1} value={d.guests} onChange={(e) => setD({ ...d, guests: e.target.value })} /></label><label>Date<input className="pl-in" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></label></div>
          <label>Style<div className="pl-ch">{VIBES.map((v) => <button key={v} aria-pressed={d.vibe === v} onClick={() => setD({ ...d, vibe: v })}>{v}</button>)}</div></label>
          <div className="pl-sum" aria-live="polite">{d.type ? <><b>{[d.vibe, d.type.toLowerCase()].filter(Boolean).join(' ')}</b>{d.guests ? `${d.guests} guests` : 'Guest count not set yet'}, {nice}.<br />You will need: {(NEEDS[d.type] ?? []).join(', ')}.</> : 'Choose what you are planning and we will list the services you need.'}</div>
          <button className="pl-b c" disabled={!d.type} style={{ width: '100%', marginTop: 14 }} onClick={() => { saveDraft(); open('register', 'customer'); }}>Save my design and find vendors</button>
        </div>
      </div></section>

      <section className="pl-s" id="how"><div className="pl-w">
        <h2>From idea to booked in three steps</h2><p className="pl-sb">Each step builds on the last, so nothing gets lost between planning and paying.</p>
        <div className="pl-st">{[['Design', 'Tell us the occasion, guest count, date and style. We list every service you will need.'], ['Match', 'Browse verified vendors for each service and compare prices and ratings side by side.'], ['Book safely', 'Pay into escrow. Money is released only when the vendor delivers.']].map(([t, p], i) => <div className="pl-card" key={t}><div className="pl-n">{i + 1}</div><h3>{t}</h3><p>{p}</p></div>)}</div>
      </div></section>

      <section className="pl-s pl-dark" id="trust"><div className="pl-w">
        <h2>Safe for you and for vendors</h2><p className="pl-sb">Trust is built into how money and identity are handled.</p>
        <div className="pl-tr">{[['Verified vendors', 'Identity and business documents are checked before a listing goes live.'], ['Escrow payments', 'Your money is held until the service is delivered, then released.'], ['Secure card handling', 'Payments follow PCI-DSS standards, and card details never sit on our servers.']].map(([t, p]) => <div className="pl-card" key={t}><h3>{t}</h3><p>{p}</p></div>)}</div>
      </div></section>

      <section className="pl-s" id="vendors"><div className="pl-w" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div><h2>Do you provide event services?</h2><p className="pl-sb" style={{ marginBottom: 0 }}>Get verified once and reach customers planning events right now.</p></div>
        <button className="pl-b c" onClick={() => open('register', 'vendor')}>Become a vendor</button>
      </div></section>

      <section className="pl-s" id="faq" style={{ paddingTop: 0 }}><div className="pl-w pl-fq"><h2 style={{ marginBottom: 18 }}>Questions</h2>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>

      <footer className="pl-ft">&copy; {new Date().getFullYear()} EPHINTA. All rights reserved.</footer>

      {modal && <div className="pl-md" onClick={() => setModal(null)}><div className="pl-dl" role="dialog" aria-modal="true" aria-label={modal === 'signin' ? 'Sign in' : 'Create account'} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><h2 style={{ fontSize: 26 }}>{modal === 'signin' ? 'Sign in' : 'Create your account'}</h2><button className="pl-t" aria-label="Close" style={{ fontSize: 26 }} onClick={() => setModal(null)}>×</button></div>
        {modal === 'register' && <><label>Who are you registering as?<div className="pl-ch">{([['customer', 'Customer'], ['vendor', 'Service provider'], ['organization', 'Organization']] as const).map(([k, l]) => <button key={k} aria-pressed={role === k} onClick={() => setRole(k)}>{l}</button>)}</div></label><label>Full name<input className="pl-in" autoComplete="name" value={form.name} onChange={f('name')} /></label></>}
        <label>Email<input className="pl-in" type="email" autoComplete="email" value={form.email} onChange={f('email')} /></label>
        <label>Password{modal === 'register' ? ' (12 or more characters)' : ''}<input className="pl-in" type="password" autoComplete={modal === 'signin' ? 'current-password' : 'new-password'} value={form.password} onChange={f('password')} onKeyDown={(e) => e.key === 'Enter' && submit()} /></label>
        {err && <p className="pl-er" role="alert">{err}</p>}
        <button className="pl-b p" style={{ width: '100%' }} disabled={busy} onClick={submit}>{busy ? 'Please wait…' : modal === 'signin' ? 'Sign in' : 'Create account'}</button>
        <p style={{ textAlign: 'center', color: 'var(--mute)', fontSize: 14, marginBottom: 0 }}>{modal === 'signin' ? 'New here? ' : 'Already registered? '}<button className="pl-t" style={{ color: 'var(--blue)' }} onClick={() => open(modal === 'signin' ? 'register' : 'signin')}>{modal === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
      </div></div>}
    </div>
  );
}
