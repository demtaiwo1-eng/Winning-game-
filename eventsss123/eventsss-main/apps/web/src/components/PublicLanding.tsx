import React, { useEffect, useMemo, useRef, useState } from 'react';



type AuthPayload = {

  accessToken: string;

  refreshToken: string;

  user: { id: string; email: string; name: string; role: string; organizationMode?: 'EVENT_PLANNING' | 'SERVICE_PROVIDER' | null };

};



interface LandingPageProps {

  onLoginSuccess?: (payload: AuthPayload) => void;


  onStartBuilder?: () => void;

}



type AuthMode = 'signin' | 'signup' | 'forgot';

type ThemeMode = 'dark' | 'light' | 'colorful';

type AccountRole = 'CLIENT' | 'VENDOR' | 'ORGANIZATION';

type EventDraft = {

  type: string;

  guests: string;

  date: string;

  vibe: string;

  services: string[];

};



const eventTypes = ['Wedding', 'Birthday', 'Naming ceremony', 'Corporate event', 'Graduation', 'Remembrance'];

const vibes = ['Modern', 'Classic', 'Traditional', 'Garden', 'Luxury', 'Intimate'];

const serviceOptions = ['Venue', 'Catering', 'Photography', 'Decor', 'Music', 'Cake', 'AV & staging', 'Security'];

const googleAdMobEnabled = (() => {
  const value = import.meta.env?.VITE_GOOGLE_ADMOB_ENABLED;
  return value === true || value === 'true' || value === '1';
})();

const googleAdMobClient = (import.meta.env?.VITE_GOOGLE_ADMOB_CLIENT || '').trim();
const googleAdMobSlot = (import.meta.env?.VITE_GOOGLE_ADMOB_SLOT || '').trim();

const defaultAdCollections = [
  {
    title: 'Wedding & celebration picks',
    subtitle: 'Explore what planners are booking this season',
    items: [
      { label: 'Garden weddings', value: 'Luxury floral setups', cta: 'See inspiration' },
      { label: 'Intimate dining', value: 'Private dining & ambience', cta: 'View packages' },
      { label: 'Photo stories', value: 'Candid coverage & albums', cta: 'Book a session' },
      { label: 'Music nights', value: 'Live bands & DJ sets', cta: 'Explore acts' },
    ],
  },
  {
    title: 'Trusted event services',
    subtitle: 'Popular vendor categories for your next plan',
    items: [
      { label: 'Venue teams', value: 'Hotels, halls & gardens', cta: 'Browse offers' },
      { label: 'Catering', value: 'Private chefs & menus', cta: 'Compare menus' },
      { label: 'Decor', value: 'Styled themes & setup', cta: 'Start styling' },
      { label: 'Logistics', value: 'Transport & guest flow', cta: 'View options' },
    ],
  },
  {
    title: 'Planner essentials',
    subtitle: 'Everything to keep the day moving smoothly',
    items: [
      { label: 'Timeline tools', value: 'Guest flow & decisions', cta: 'Build plan' },
      { label: 'Checklists', value: 'Tasks, reminders & progress', cta: 'Open toolkit' },
      { label: 'Wedding checklists', value: 'Vendor and guest prep', cta: 'Get started' },
      { label: 'Budget guidance', value: 'Track spend in one place', cta: 'Review budget' },
    ],
  },
];

const adCollections = defaultAdCollections;

function GoogleAdBanner() {
  const enabled = googleAdMobEnabled && !!googleAdMobClient && !!googleAdMobSlot;

  useEffect(() => {
    if (!enabled) return;
    const win = window as typeof window & { adsbygoogle?: unknown[] };
    win.adsbygoogle = win.adsbygoogle || [];
    win.adsbygoogle.push({});
  }, [enabled]);

  if (!enabled) return null;

  return (
    <section className="eph-section eph-admob-wrap" aria-label="Sponsored content">
      <div className="eph-section-head">
        <span className="eph-section-kicker">Sponsorship</span>
        <h2>Marketplace opportunities</h2>
        <p>Partner content and brand placements for planners, vendors and organizers.</p>
      </div>
      <div className="eph-admob-banner">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: 90 }}
          data-ad-client={googleAdMobClient}
          data-ad-slot={googleAdMobSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </section>
  );
}

async function sendAuth(path: string, body: Record<string, unknown>) {

  const response = await fetch(`/api/v1/auth/${path}`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    credentials: 'include',

    body: JSON.stringify(body),

  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {

    const fieldErrors = data?.error?.details?.fieldErrors;

    const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined;

    throw new Error(String(firstFieldError || data?.error?.message || data?.message || 'Request failed. Please try again.'));

  }

  return data;

}



const initialDraft: EventDraft = {

  type: 'Wedding',

  guests: '150',

  date: '',

  vibe: 'Modern',

  services: ['Venue', 'Catering', 'Photography'],

};

type PublicPromotion = {
  id: string;
  title: string;
  vendorName: string;
  listingTitle?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  startsAt: string;
  endsAt: string;
  currency: string;
  budgetMinor: string;
};

function formatPromotionLocation(city?: string | null, country?: string | null) {
  return [city, country].filter(Boolean).join(', ');
}

export default function PublicLanding({

  onLoginSuccess,


  onStartBuilder,

}: LandingPageProps) {

  const [draft, setDraft] = useState<EventDraft>(() => {

    try {

      const saved = localStorage.getItem('ess:eventDraft');

      return saved ? { ...initialDraft, ...JSON.parse(saved) } : initialDraft;

    } catch {

      return initialDraft;

    }

  });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !menuButtonRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {

    try {

      const saved = localStorage.getItem('ephinta:theme');

      return saved === 'dark' || saved === 'light' || saved === 'colorful' ? saved : 'colorful';

    } catch { return 'colorful'; }

  });

  const [marketingFocus, setMarketingFocus] = useState<'discover' | 'plan' | 'celebrate'>('discover');

  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  const [role, setRole] = useState<AccountRole>('CLIENT');

  const [name, setName] = useState('');

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [businessName, setBusinessName] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');

  const [notice, setNotice] = useState('');

  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);

  const [activePromotionIndex, setActivePromotionIndex] = useState(0);

  const [isPromotionHovered, setIsPromotionHovered] = useState(false);

  const [isPromotionFocused, setIsPromotionFocused] = useState(false);

  const marketplaceCollections = useMemo(() => {
    if (!promotions.length) return adCollections;

    const mappedItems = promotions.slice(0, 4).map((promotion) => ({
      label: promotion.vendorName,
      value: promotion.listingTitle || promotion.title,
      cta: 'Explore offer',
    }));

    return [
      {
        title: 'Marketplace picks',
        subtitle: 'Fresh, high-intent offers from trusted vendors and service partners.',
        items: mappedItems,
      },
      {
        title: 'Top services this week',
        subtitle: 'Popular categories planners are comparing right now.',
        items: [
          { label: 'Venues', value: 'Private halls & gardens', cta: 'View venues' },
          { label: 'Catering', value: 'Signature menus & hospitality', cta: 'Compare menus' },
          { label: 'Decoration', value: 'Styled setups & floral stories', cta: 'Book styling' },
          { label: 'Production', value: 'AV, lighting & guest flow', cta: 'Get quote' },
        ],
      },
    ];
  }, [promotions]);



  useEffect(() => {
    let cancelled = false;

    fetch('/api/v1/billing/public-promotions')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load featured promotions.');
        const payload = await response.json();
        if (!cancelled) setPromotions(Array.isArray(payload.items) ? payload.items : []);
      })
      .catch(() => {
        if (!cancelled) setPromotions([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (promotions.length <= 1) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || isPromotionHovered || isPromotionFocused || document.hidden) return;

    const timer = window.setInterval(() => {
      setActivePromotionIndex((current) => (current + 1) % promotions.length);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [promotions, isPromotionHovered, isPromotionFocused]);



  useEffect(() => {
    if (!promotions.length) return;
    setActivePromotionIndex((current) => Math.min(current, promotions.length - 1));
  }, [promotions.length]);



  useEffect(() => {
    if (!promotions.length) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        setIsPromotionHovered(false);
        setIsPromotionFocused(false);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [promotions.length]);



  useEffect(() => {
    if (!promotions.length) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const handleVisibility = () => {
      if (document.hidden) setIsPromotionHovered(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [promotions.length]);



  useEffect(() => {
    try { localStorage.setItem('ess:eventDraft', JSON.stringify(draft)); } catch { /* storage may be disabled */ }

  }, [draft]);



  useEffect(() => {

    try { localStorage.setItem('ess:eventDraft', JSON.stringify(draft)); } catch { /* storage may be disabled */ }

  }, [draft]);

  useEffect(() => {

    try { localStorage.setItem('ephinta:theme', themeMode); } catch { /* storage may be disabled */ }

    document.documentElement.dataset.ephintaTheme = themeMode;

  }, [themeMode]);



  useEffect(() => {

    const onKeyDown = (event: KeyboardEvent) => {

      if (event.key === 'Escape') { setAuthMode(null); setMenuOpen(false); }

    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);

  }, []);



  function openAuth(mode: AuthMode, requestedRole: AccountRole = 'CLIENT') {

    setError('');

    setNotice('');

    setRole(requestedRole);

    setAuthMode(mode);

    setMenuOpen(false);


  }



  function updateDraft<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {

    setDraft(previous => ({ ...previous, [key]: value }));

  }



  function toggleService(service: string) {

    setDraft(previous => ({

      ...previous,

      services: previous.services.includes(service)

        ? previous.services.filter(item => item !== service)

        : [...previous.services, service],

    }));

  }



  async function submitAuth(event: React.FormEvent) {

    event.preventDefault();

    setBusy(true);

    setError('');

    setNotice('');

    try {

      if (authMode === 'forgot') {

        await sendAuth('forgot-password', { email });

        setNotice('If an account exists for that email, a reset link has been sent.');

        return;

      }

      if (authMode === 'signup') {

        const body: Record<string, unknown> = { name: name.trim(), email: email.trim().toLowerCase(), password, role };

        if (role === 'VENDOR') body.businessName = businessName.trim();

        if (role === 'ORGANIZATION') {

          body.organizationMode = 'EVENT_PLANNING';

          body.registrationCategory = 'EVENT_PLANNING';

          body.businessName = businessName.trim();

        }

        const payload = await sendAuth('register', body);

        // Registration already returns access and refresh tokens. Continue the
        // same session immediately instead of forcing the user through a
        // second sign-in before they can reach their event workspace.
        if (onLoginSuccess) {
          onLoginSuccess(payload as AuthPayload);
          return;
        }

        setNotice('Account created. You can now sign in.');
        setAuthMode('signin');
        setPassword('');
        return;

      }

      const payload = await sendAuth('login', { email: email.trim().toLowerCase(), password });

      onLoginSuccess?.(payload as AuthPayload);

      if (!onLoginSuccess) {

        setNotice('Signed in successfully, but the app did not provide an onLoginSuccess handler.');

      }

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');

    } finally {

      setBusy(false);

    }

  }



  function startPlanning() {

    try { localStorage.setItem('ess:eventDraft', JSON.stringify(draft)); } catch { /* storage may be disabled */ }

    if (onStartBuilder) onStartBuilder();

    else openAuth('signup', 'CLIENT');

  }



  return (

    <div className="eph-landing" data-theme={themeMode}>

      <style>{`



        .eph-landing[data-theme="dark"]{--navy:#11152d;--navy2:#1c2242;--purple:#9c7aff;--purple2:#c0aaff;--gold:#ffbd43;--cream:#151629;--ink:#f6f4ff;--muted:#b9b8cc;--line:#34344e;background:#151629;color:#f6f4ff}

        .eph-landing[data-theme="dark"] .eph-hero{background:radial-gradient(ellipse at 82% 14%,#332650 0,transparent 33%),radial-gradient(ellipse at 15% 95%,#352a25 0,transparent 28%),linear-gradient(125deg,#17172b 0%,#201b32 48%,#24202b 100%)}

        .eph-landing[data-theme="dark"] .eph-planner,.eph-landing[data-theme="dark"] .eph-card,.eph-landing[data-theme="dark"] .eph-strip,.eph-landing[data-theme="dark"] .eph-modal{background:#202039;border-color:#3a3856;color:#f6f4ff}

        .eph-landing[data-theme="dark"] .eph-planner h2,.eph-landing[data-theme="dark"] .eph-card h3,.eph-landing[data-theme="dark"] .eph-stat strong,.eph-landing[data-theme="dark"] .eph-section h2,.eph-landing[data-theme="dark"] .eph-modal h2{color:#fff}

        .eph-landing[data-theme="dark"] .eph-subtitle,.eph-landing[data-theme="dark"] .eph-planner p,.eph-landing[data-theme="dark"] .eph-card p,.eph-landing[data-theme="dark"] .eph-stat span,.eph-landing[data-theme="dark"] .eph-section-head p,.eph-landing[data-theme="dark"] .eph-modal p{color:#c2bfd6}

        .eph-landing[data-theme="dark"] .eph-chip,.eph-landing[data-theme="dark"] .eph-service,.eph-landing[data-theme="dark"] .eph-control{background:#292943;color:#f8f5ff;border-color:#484563}

        .eph-landing[data-theme="dark"] .eph-chip.active,.eph-landing[data-theme="dark"] .eph-service.active{background:#3c2d60;border-color:#9c7aff;color:#fff}

        .eph-landing[data-theme="dark"] .eph-btn-outline{background:#25253c;color:#fff;border-color:#4a4764}

        .eph-landing[data-theme="dark"] .eph-section{background:#151629}

        .eph-landing[data-theme="dark"] .eph-role-scroll-card{background:#202039;border-color:#3a3856;color:#f6f4ff}

        .eph-landing[data-theme="dark"] .eph-faq summary{color:#fff}

        .eph-landing[data-theme="light"]{background:#fff;color:#17172d}

        .eph-landing[data-theme="colorful"]{--navy:#171332;--navy2:#2b2053;--purple:#e34291;--purple2:#9b2fca;--gold:#ffbd43;--cream:#fff6fc;--ink:#21162f;--muted:#716078;--line:#f0ddec}

        .eph-landing[data-theme="colorful"] .eph-hero{background:radial-gradient(ellipse at 84% 8%,#f7c9e5 0,transparent 34%),radial-gradient(ellipse at 12% 90%,#ffdf9d 0,transparent 32%),linear-gradient(120deg,#fff8fd,#f2e9ff 55%,#fff7e9)}

        .eph-theme-select{display:flex;align-items:center;gap:8px;color:#f3f0ff;font-size:12px;font-weight:750}

        .eph-theme-select select{border:1px solid #ffffff36;border-radius:10px;padding:9px 10px;background:#24223d;color:#fff;max-width:126px}

        @media(max-width:760px){.eph-theme-select{padding:12px 0}.eph-theme-select select{flex:1;max-width:none}}



        .eph-landing{--navy:#11152d;--navy2:#1c2242;--purple:#6d42d8;--purple2:#512bb5;--gold:#ffbd43;--cream:#fbf9ff;--ink:#17172d;--muted:#6f7185;--line:#e8e5f1;color:var(--ink);background:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;overflow:hidden}

        .eph-landing *{box-sizing:border-box}.eph-landing button,.eph-landing input,.eph-landing select{font:inherit}.eph-landing button{cursor:pointer}

        .eph-nav{height:78px;background:var(--navy);color:white;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,5.8vw,84px);gap:28px;position:relative;z-index:5}

        .eph-brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:white;flex-shrink:0}.eph-brand img{width:24px;height:24px;object-fit:contain;border-radius:5px}.eph-brand span{font-size:14px;font-weight:900;letter-spacing:.12em}

        .eph-links{display:flex;align-items:center;gap:30px;margin-right:auto;margin-left:24px}.eph-links a{color:#f5f3ff;text-decoration:none;font-size:13px;font-weight:750;opacity:.92}.eph-links a:hover{color:var(--gold)}

        .eph-nav-actions{display:flex;align-items:center;gap:20px}.eph-signin{border:0;background:transparent;color:#fff;font-weight:700;padding:12px 4px}.eph-btn{border:0;border-radius:14px;padding:15px 22px;font-weight:850;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}.eph-btn:hover{transform:translateY(-2px)}.eph-btn-gold{background:var(--gold);color:#17152a;box-shadow:0 8px 22px #ffbd4338}.eph-btn-purple{background:var(--purple);color:#fff;box-shadow:0 12px 24px #6d42d82c}.eph-btn-outline{background:#fff;border:1px solid var(--line);color:var(--navy)}

        .eph-menu{display:none;border:1px solid #ffffff35;background:#ffffff10;color:white;border-radius:10px;padding:9px 12px}
        .eph-menu-bars{display:grid;gap:4px;width:18px}
        .eph-menu-bars span{display:block;width:18px;height:2px;border-radius:2px;background:currentColor}

        .eph-hero{position:relative;background:radial-gradient(ellipse at 82% 14%,#e9ddff 0,transparent 33%),radial-gradient(ellipse at 15% 95%,#fff0ce 0,transparent 28%),linear-gradient(125deg,#fbfaff 0%,#f4f0ff 48%,#fffaf0 100%);padding:68px clamp(20px,6vw,88px) 76px;min-height:590px}

        .eph-hero-grid{max-width:1260px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.04fr) minmax(400px,.96fr);gap:clamp(36px,6vw,90px);align-items:center}

        .eph-eyebrow{display:inline-flex;align-items:center;gap:9px;border:1px solid #e5dbff;background:#fffaf2;color:var(--purple2);border-radius:99px;padding:9px 14px;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.eph-eyebrow i{width:7px;height:7px;background:var(--gold);border-radius:50%;display:inline-block}

        .eph-title{font-size:clamp(44px,5.2vw,76px);line-height:.99;letter-spacing:-.065em;font-weight:950;max-width:650px;margin:24px 0 20px;color:var(--navy)}.eph-title em{font-style:normal;color:var(--purple);position:relative;white-space:nowrap}.eph-title em:after{content:"";position:absolute;left:0;bottom:-5px;width:100%;height:7px;border-radius:99px;background:var(--gold);opacity:.8;transform:rotate(-1.5deg)}

        .eph-subtitle{font-size:17px;line-height:1.8;color:#5d6077;max-width:555px;margin:0 0 27px}.eph-hero-cta{display:flex;flex-wrap:wrap;align-items:center;gap:12px}.eph-proof{display:flex;align-items:center;gap:12px;margin-top:30px;color:#666980;font-size:12px;font-weight:650}.eph-proof-dots{display:flex;padding-left:3px}.eph-proof-dots span{width:27px;height:27px;border-radius:50%;border:2px solid #fff;background:#d9c7ff;margin-left:-4px;display:grid;place-items:center;font-size:11px;color:var(--navy)}.eph-proof strong{color:var(--navy)}

        .eph-planner{background:#fff;border:1px solid #e8e3f3;border-radius:26px;padding:30px;box-shadow:0 28px 75px #30215a17;position:relative}.eph-planner:before{content:"";position:absolute;inset:12px -12px -12px 12px;border:1px solid #d9c8ff;border-radius:26px;z-index:0;pointer-events:none}.eph-planner>*{position:relative;z-index:1}.eph-planner-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:24px}.eph-planner h2{font-size:24px;line-height:1.2;letter-spacing:-.04em;color:var(--navy);margin:0 0 8px;font-weight:900}.eph-planner p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}.eph-planner-icon{width:44px;height:44px;border-radius:14px;background:#f1eaff;color:var(--purple);display:grid;place-items:center;font-size:23px}

        .eph-field{display:flex;flex-direction:column;gap:9px;margin-bottom:18px}.eph-field label,.eph-field-title{font-size:12px;font-weight:850;color:#34364f}.eph-chips{display:flex;flex-wrap:wrap;gap:8px}.eph-chip{border:1px solid #e6e2ef;border-radius:11px;padding:10px 12px;background:white;color:#55566d;font-size:12px;font-weight:700}.eph-chip.active{border-color:var(--purple);background:#f3edff;color:var(--purple2);box-shadow:inset 0 0 0 1px #6d42d826}

        .eph-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.eph-control{width:100%;border:1px solid #e6e2ef;border-radius:11px;background:#fff;color:var(--ink);padding:12px 13px;min-width:0;outline:none}.eph-control:focus{border-color:var(--purple);box-shadow:0 0 0 3px #6d42d81c}.eph-services{display:flex;flex-wrap:wrap;gap:8px}.eph-service{border:1px solid #ece8f4;background:#fff;color:#606176;border-radius:99px;padding:8px 11px;font-size:11px;font-weight:750}.eph-service.active{background:#f1eaff;border-color:#d4c1ff;color:var(--purple2)}.eph-planner-submit{width:100%;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:10px}.eph-secure-note{text-align:center;color:#85869a;font-size:10px;margin-top:12px}

        .eph-strip{display:grid;grid-template-columns:repeat(4,1fr);max-width:1110px;margin:-25px auto 0;position:relative;z-index:2;background:#fff;border:1px solid #eeeaf5;border-radius:20px;box-shadow:0 16px 45px #15152c0d;padding:22px 26px}.eph-stat{padding:5px 20px;border-right:1px solid var(--line)}.eph-stat:last-child{border:0}.eph-stat strong{display:block;color:var(--navy);font-size:22px;letter-spacing:-.04em}.eph-stat span{display:block;color:var(--muted);font-size:11px;margin-top:4px}

        .eph-section{padding:88px clamp(20px,6vw,88px);max-width:1440px;margin:0 auto}.eph-section-head{text-align:center;max-width:680px;margin:0 auto 40px}.eph-section-kicker{color:var(--purple);font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:900}.eph-section h2{font-size:clamp(30px,3.5vw,46px);letter-spacing:-.055em;line-height:1.1;color:var(--navy);margin:12px 0}.eph-section-head p{color:var(--muted);line-height:1.8;margin:0}

        .eph-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.eph-card{border:1px solid var(--line);border-radius:20px;padding:25px;background:#fff;box-shadow:0 12px 35px #17172d06}.eph-card-icon{width:47px;height:47px;border-radius:15px;display:grid;place-items:center;background:#f0e9ff;color:var(--purple);font-size:22px}.eph-card h3{color:var(--navy);font-size:17px;margin:18px 0 9px;letter-spacing:-.025em}.eph-card p{color:var(--muted);font-size:13px;line-height:1.75;margin:0}

        .eph-vendor-band{margin:0 clamp(20px,6vw,88px) 80px;border-radius:28px;padding:40px clamp(24px,5vw,62px);background:linear-gradient(120deg,var(--navy),#28234e);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:28px}.eph-vendor-band h2{font-size:clamp(25px,3vw,38px);letter-spacing:-.05em;margin:0 0 10px}.eph-vendor-band p{color:#d3d0e5;line-height:1.7;margin:0;max-width:650px;font-size:14px}

        .eph-faq{max-width:820px;margin:0 auto}.eph-faq details{border-bottom:1px solid var(--line);padding:19px 0}.eph-faq summary{font-weight:800;color:var(--navy);cursor:pointer}.eph-faq p{color:var(--muted);font-size:13px;line-height:1.8}

        .eph-footer{background:#11152d;color:#fff;padding:34px clamp(20px,6vw,88px);display:flex;align-items:center;justify-content:space-between;gap:20px}.eph-footer small{color:#c6c4d8}.eph-footer-links{display:flex;gap:20px;flex-wrap:wrap}.eph-footer a{color:#e7e3f5;text-decoration:none;font-size:12px}

        .eph-modal-backdrop{position:fixed;inset:0;background:#0e1023b8;backdrop-filter:blur(7px);z-index:20;display:grid;place-items:center;padding:18px;overflow:auto}.eph-modal{background:#fff;width:min(100%,460px);border-radius:22px;padding:28px;box-shadow:0 30px 100px #0004;max-height:calc(100vh - 36px);overflow:auto}.eph-modal-top{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.eph-modal h2{margin:0 0 8px;color:var(--navy);font-size:25px;letter-spacing:-.04em}.eph-modal p{margin:0 0 22px;color:var(--muted);font-size:13px;line-height:1.6}.eph-close{border:0;background:#f3f0fa;border-radius:10px;width:36px;height:36px;font-size:20px;color:var(--navy)}.eph-modal .eph-field{margin-bottom:14px}.eph-password-wrap{display:flex;gap:8px}.eph-password-wrap input{flex:1;min-width:0}.eph-text-btn{border:0;background:transparent;color:var(--purple);font-weight:800;font-size:12px}.eph-auth-error{background:#fff0f0;color:#a32232;padding:11px;border-radius:10px;font-size:12px;margin-bottom:13px}.eph-auth-notice{background:#effaf3;color:#1c7042;padding:11px;border-radius:10px;font-size:12px;margin-bottom:13px}.eph-auth-switch{text-align:center;margin-top:17px;color:var(--muted);font-size:12px}.eph-auth-switch button{border:0;background:transparent;color:var(--purple);font-weight:850}

        .eph-promotions{margin:36px auto 0;max-width:1260px;padding:0 clamp(20px,6vw,88px)}.eph-promo-shell{border:1px solid var(--line);border-radius:26px;background:linear-gradient(135deg,#0f172a,#1f2a46);color:#fff;padding:26px 28px;box-shadow:0 18px 30px rgba(15,23,42,.15)}.eph-promo-shell h2{margin:0 0 8px;font-size:clamp(28px,4vw,42px);letter-spacing:-.06em}.eph-promo-shell p{margin:0;color:#dce5ff}.eph-promo-carousel{margin-top:20px;display:grid;grid-template-columns:42px 1fr 42px;align-items:center;gap:12px}.eph-promo-arrow{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;border-radius:12px;width:42px;height:42px;font-size:24px;display:grid;place-items:center}.eph-promo-card{border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px 20px;background:rgba(255,255,255,.04);min-height:180px;display:flex;flex-direction:column;justify-content:space-between}.eph-promo-card small{color:#d8e5ff;letter-spacing:.12em;text-transform:uppercase}.eph-promo-card h3{margin:8px 0 6px;font-size:clamp(22px,2.5vw,32px);letter-spacing:-.05em}.eph-promo-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.eph-promo-meta span{border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 10px;font-size:11px;color:#eff6ff}.eph-promo-placeholder{padding:18px 0 6px;color:#dce5ff}

        .eph-landing :focus-visible{outline:3px solid var(--gold);outline-offset:3px}

        @media(max-width:980px){.eph-nav{padding-inline:24px}.eph-links{gap:17px;margin-left:5px}.eph-hero{padding-top:52px}.eph-hero-grid{grid-template-columns:minmax(0,1fr) minmax(350px,.9fr);gap:28px}.eph-title{font-size:clamp(42px,5.5vw,60px)}.eph-planner{padding:24px}.eph-strip{margin-inline:22px}.eph-stat{padding-inline:12px}}

        @media(max-width:760px){.eph-nav{height:70px;padding-inline:18px}.eph-brand img{width:30px;height:30px}.eph-brand span{font-size:14px}.eph-menu{display:block}.eph-links{display:none;position:absolute;left:0;right:0;top:70px;background:var(--navy);padding:12px 20px 22px;margin:0;flex-direction:column;align-items:stretch;gap:0}.eph-links.open{display:flex}.eph-links a{padding:14px 3px;border-bottom:1px solid #ffffff18}.eph-nav-actions{gap:10px}.eph-nav-actions .eph-signin{display:none}.eph-nav-actions .eph-btn{padding:12px 13px;font-size:12px}.eph-hero{padding:42px 18px 54px}.eph-hero-grid{grid-template-columns:1fr;gap:36px}.eph-title{font-size:clamp(43px,11vw,66px);max-width:620px}.eph-subtitle{font-size:15px}.eph-planner{padding:23px;border-radius:21px}.eph-planner:before{inset:7px -6px -7px 6px;border-radius:21px}.eph-strip{grid-template-columns:1fr 1fr;margin:-14px 18px 0;padding:13px;border-radius:16px}.eph-stat{padding:14px;border-right:0;border-bottom:1px solid var(--line)}.eph-stat:nth-child(odd){border-right:1px solid var(--line)}.eph-stat:nth-last-child(-n+2){border-bottom:0}.eph-stat strong{font-size:20px}.eph-section{padding:65px 18px}.eph-cards{grid-template-columns:1fr;gap:12px}.eph-card{padding:22px}.eph-vendor-band{margin:0 18px 55px;padding:28px 23px;flex-direction:column;align-items:flex-start}.eph-footer{padding:28px 20px;align-items:flex-start;flex-direction:column}.eph-form-grid{gap:10px}}

        @media(max-width:390px){.eph-brand span{display:none}.eph-nav-actions .eph-btn{padding:11px 10px}.eph-title{font-size:42px}.eph-form-grid{grid-template-columns:1fr}.eph-planner{padding:19px}.eph-hero-cta .eph-btn{width:100%}}

        @media(prefers-reduced-motion:reduce){.eph-landing *{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}



        .eph-menu-portals{border-top:1px solid #ffffff22;margin-top:8px;padding-top:12px;display:flex;flex-direction:column;gap:6px}

        .eph-menu-label{font-size:10px;letter-spacing:.12em;font-weight:900;color:#c7b9ff;padding:6px 4px}

        .eph-menu-portals button{width:100%;text-align:left;border:1px solid #ffffff1a;border-radius:9px;background:#ffffff0d;color:#fff;padding:10px 11px;font-size:12px;font-weight:750;display:flex;align-items:center;gap:10px}

        .eph-menu-portals button:hover{background:#ffffff1c}

        .eph-menu-portals img{width:22px;height:22px;object-fit:contain;flex:0 0 22px}

        .eph-menu-brand{display:flex;align-items:center;gap:9px;padding:8px 4px 12px;border-bottom:1px solid #ffffff22;color:#fff;font-size:13px;font-weight:900;letter-spacing:.1em}

        .eph-menu-brand img{width:26px;height:26px;object-fit:contain}

        .eph-nav{position:relative}

        .eph-menu{display:inline-flex;align-items:center;justify-content:center;min-width:42px;min-height:42px}

        .eph-links{display:none;position:absolute;right:clamp(16px,5vw,76px);left:auto;top:calc(100% - 1px);z-index:30;min-width:250px;max-width:min(360px,calc(100vw - 28px));padding:12px 16px 16px;margin:0;flex-direction:column;align-items:stretch;gap:0;border:1px solid #ffffff20;border-radius:0 0 16px 16px;box-shadow:0 22px 40px #0003;background:var(--navy)}
        .eph-menu-brand img{width:20px;height:20px;object-fit:contain}
        .eph-menu-primary img{width:16px;height:16px;object-fit:contain}
        .eph-nav-actions{gap:12px}

        .eph-links.open{display:flex}

        .eph-links>a{padding:13px 4px;border-bottom:1px solid #ffffff18}

        @media(max-width:760px){.eph-links{left:12px;right:12px;max-width:none}.eph-nav-actions .eph-signin{display:none}}



        /* Ephinta contrast hardening: foreground/background pairs are deliberately distinct. */

        .eph-landing{color:#21162f;background:#fff}

        .eph-landing[data-theme="dark"]{--ink:#f8fafc;--muted:#d5deee;--line:#46536c;--cream:#101626;color:#f8fafc;background:#0b1020}

        .eph-landing[data-theme="dark"] .eph-hero,

        .eph-landing[data-theme="dark"] .eph-section,

        .eph-landing[data-theme="dark"] .eph-strip{color:#f8fafc}

        .eph-landing[data-theme="dark"] .eph-planner,

        .eph-landing[data-theme="dark"] .eph-card,

        .eph-landing[data-theme="dark"] .eph-strip,

        .eph-landing[data-theme="dark"] .eph-modal{background:#151d32!important;color:#f8fafc!important;border-color:#46536c!important}

        .eph-landing[data-theme="dark"] p,

        .eph-landing[data-theme="dark"] li,

        .eph-landing[data-theme="dark"] label,

        .eph-landing[data-theme="dark"] small,

        .eph-landing[data-theme="dark"] .eph-subtitle,

        .eph-landing[data-theme="dark"] .eph-section-head p{color:#d5deee}

        .eph-landing[data-theme="dark"] h1,

        .eph-landing[data-theme="dark"] h2,

        .eph-landing[data-theme="dark"] h3,

        .eph-landing[data-theme="dark"] strong{color:#fff}

        .eph-landing[data-theme="dark"] input,

        .eph-landing[data-theme="dark"] select,

        .eph-landing[data-theme="dark"] textarea{background:#0b1020!important;color:#fff!important;border-color:#687894!important}

        .eph-landing[data-theme="dark"] input::placeholder,

        .eph-landing[data-theme="dark"] textarea::placeholder{color:#b9c5d9!important;opacity:1}

        .eph-landing[data-theme="light"]{--ink:#111827;--muted:#374151;--line:#cbd5e1;color:#111827;background:#f8fafc}

        .eph-landing[data-theme="light"] p,

        .eph-landing[data-theme="light"] li,

        .eph-landing[data-theme="light"] label,

        .eph-landing[data-theme="light"] small,

        .eph-landing[data-theme="light"] .eph-subtitle{color:#374151}

        .eph-landing[data-theme="light"] h1,

        .eph-landing[data-theme="light"] h2,

        .eph-landing[data-theme="light"] h3,

        .eph-landing[data-theme="light"] strong{color:#111827}

        .eph-landing[data-theme="light"] .eph-planner,

        .eph-landing[data-theme="light"] .eph-card,

        .eph-landing[data-theme="light"] .eph-strip,

        .eph-landing[data-theme="light"] .eph-modal,

        .eph-landing[data-theme="light"] .eph-role-scroll-card{background:#fff!important;color:#111827!important;border-color:#cbd5e1!important}

        .eph-landing[data-theme="light"] input,

        .eph-landing[data-theme="light"] select,

        .eph-landing[data-theme="light"] textarea{background:#fff!important;color:#111827!important;border-color:#64748b!important}

        .eph-landing[data-theme="light"] input::placeholder,

        .eph-landing[data-theme="light"] textarea::placeholder{color:#4b5563!important;opacity:1}

        .eph-landing[data-theme="colorful"]{--ink:#21112b;--muted:#4d3b57;--line:#d8c5df;color:#21112b;background:#fff7fc}

        .eph-landing[data-theme="colorful"] p,

        .eph-landing[data-theme="colorful"] li,

        .eph-landing[data-theme="colorful"] label,

        .eph-landing[data-theme="colorful"] small,

        .eph-landing[data-theme="colorful"] .eph-subtitle{color:#4d3b57}

        .eph-landing[data-theme="colorful"] h1,

        .eph-landing[data-theme="colorful"] h2,

        .eph-landing[data-theme="colorful"] h3,

        .eph-landing[data-theme="colorful"] strong{color:#21112b}

        .eph-landing[data-theme="colorful"] .eph-planner,

        .eph-landing[data-theme="colorful"] .eph-card,

        .eph-landing[data-theme="colorful"] .eph-strip,

        .eph-landing[data-theme="colorful"] .eph-modal,

        .eph-landing[data-theme="colorful"] .eph-role-scroll-card{background:#fff!important;color:#21112b!important;border-color:#d8c5df!important}

        .eph-landing[data-theme="colorful"] input,

        .eph-landing[data-theme="colorful"] select,

        .eph-landing[data-theme="colorful"] textarea{background:#fff!important;color:#21112b!important;border-color:#8d719b!important}

        .eph-landing[data-theme="colorful"] input::placeholder,

        .eph-landing[data-theme="colorful"] textarea::placeholder{color:#5f4a68!important;opacity:1}

        .eph-landing :focus-visible{outline:3px solid #0b63ce!important;outline-offset:3px}

        .eph-landing button:disabled{opacity:.65;cursor:not-allowed}

        .eph-ad-scroll{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,1fr);overflow-x:auto;scroll-snap-type:x proximity;gap:18px;padding:10px 0 8px;scrollbar-width:thin}

        .eph-ad-card{border:1px solid var(--line);border-radius:22px;padding:20px;background:linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,.06));box-shadow:0 14px 32px rgba(17,21,45,.08);scroll-snap-align:start;min-height:170px;display:flex;flex-direction:column;gap:10px}

        .eph-ad-card small{font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}

        .eph-ad-card strong{font-size:1.1rem;line-height:1.3}

        .eph-ad-card p{margin:0;line-height:1.45;color:var(--muted)}

        .eph-ad-card button{margin-top:auto;align-self:flex-start;border:none;border-radius:999px;background:var(--purple);color:white;padding:9px 13px;font-weight:800}

        .eph-admob-wrap{padding-top:10px}

        .eph-admob-banner{display:flex;justify-content:center;align-items:center;min-height:120px;padding:18px 20px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(135deg, rgba(109,66,216,.12), rgba(255,189,67,.12));box-shadow:0 14px 32px rgba(17,21,45,.08)}

        .eph-admob-banner .adsbygoogle{width:min(100%, 960px);border-radius:16px;overflow:hidden}

      `}</style>



      <header className="eph-nav">

        <a className="eph-brand" href="#home" aria-label="Ephinta home">

          <img src="/brand/ephinta_logo4.png?v=20261010-092247" alt="EPHINTA" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />

          <span>EPHINTA</span>

        </a>

        <label className="eph-theme-select" aria-label="Colour theme"><select value={themeMode} onChange={e => setThemeMode(e.target.value as ThemeMode)} aria-label="Colour theme">

              <option value="dark">Dark</option><option value="light">Light</option><option value="colorful">Multicolor</option>

            </select>

          </label>

          <nav ref={menuRef} id="eph-information-menu" className={`eph-links ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">

          <div className="eph-menu-brand"><img src="/brand/ephinta_logo4.png?v=20261010-092247" alt="" />EPHINTA</div>

          <div className="ephinta-theme-menu-control">

            <label htmlFor="ephinta-theme-select">Appearance</label>

            <select id="ephinta-theme-select" value={themeMode} onChange={(event) => setThemeMode(event.target.value as ThemeMode)}>

              <option value="dark">Dark</option>

              <option value="light">Light</option>

              <option value="colorful">Multicolour</option>

            </select>

          </div>



          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>

          <a href="#vendors" onClick={() => setMenuOpen(false)}>Vendors</a>

          <a href="#safety" onClick={() => setMenuOpen(false)}>Safety</a>

          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>



          <div className="eph-menu-portals">

             <span className="eph-menu-label">PORTALS & ACCOUNTS</span>

             <button type="button" className="eph-menu-primary" onClick={() => { setMenuOpen(false); startPlanning(); }}><img src="/brand/ephinta_logo4.png?v=20261010-092247" alt="" />Plan your next event here <span aria-hidden="true">→</span></button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signin'); }}>Sign in to your account</button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signup', 'CLIENT'); }}>Create customer account</button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signup', 'VENDOR'); }}>Vendor portal</button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signup', 'ORGANIZATION'); }}>Organizer portal</button>

          </div>

</nav>

        <div className="eph-nav-actions">

          <button className="eph-btn eph-btn-gold" onClick={startPlanning}>Plan your next event here <span aria-hidden="true">→</span></button>

          <button ref={menuButtonRef} type="button" className="eph-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-controls="eph-information-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
            <span className="eph-menu-bars" aria-hidden="true"><span /><span /><span /></span>
          </button>

        </div>

      </header>



      {promotions.length > 0 && (
        <section className="eph-promotions" aria-label="Featured promotions">
          <div className="eph-promo-shell" onMouseEnter={() => setIsPromotionHovered(true)} onMouseLeave={() => setIsPromotionHovered(false)} onFocus={() => setIsPromotionFocused(true)} onBlur={() => setIsPromotionFocused(false)}>
            <h2>Featured promotion</h2>
            <p>Curated, active offers from trusted local vendors and service providers.</p>
            {promotions.length > 0 && (
              <div className="eph-promo-carousel" aria-live="polite">
                <button type="button" className="eph-promo-arrow" aria-label="Previous promotion" onClick={() => setActivePromotionIndex((current) => (current - 1 + promotions.length) % promotions.length)}>‹</button>
                <article className="eph-promo-card" aria-roledescription="carousel" aria-label={`Featured promotion ${activePromotionIndex + 1} of ${promotions.length}`}>
                  <div>
                    <small>Active offer</small>
                    <h3>{promotions[activePromotionIndex].title}</h3>
                    <p>{promotions[activePromotionIndex].description || `${promotions[activePromotionIndex].vendorName} is currently offering a featured event service.`}</p>
                  </div>
                  <div className="eph-promo-meta">
                    <span>{promotions[activePromotionIndex].vendorName}</span>
                    {promotions[activePromotionIndex].listingTitle && <span>{promotions[activePromotionIndex].listingTitle}</span>}
                    {formatPromotionLocation(promotions[activePromotionIndex].city, promotions[activePromotionIndex].country) && <span>{formatPromotionLocation(promotions[activePromotionIndex].city, promotions[activePromotionIndex].country)}</span>}
                  </div>
                </article>
                <button type="button" className="eph-promo-arrow" aria-label="Next promotion" onClick={() => setActivePromotionIndex((current) => (current + 1) % promotions.length)}>›</button>
              </div>
            )}
          </div>
        </section>
      )}

      <main id="home">

        <section className="eph-hero">

          <div className="eph-hero-grid">

            <div>

              <div className="eph-eyebrow"><i /> Your event. Your vision. One platform.</div>

              <h1 className="eph-title ephinta-bright-headline">Plan the event<br /><span className="ephinta-marker-phrase">you <span className="ephinta-marker-word"><em>imagine.</em></span></span></h1>

              <p className="eph-subtitle">From the first idea to the final guest, bring every detail together. Discover event professionals, organize your plans and build an occasion that feels unmistakably yours.</p>

              <div className="eph-hero-cta">

                <button className="eph-btn eph-btn-purple" onClick={startPlanning}>Start planning <span aria-hidden="true">→</span></button>

                <button className="eph-btn eph-btn-outline" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>Explore how it works</button>

              </div>

              <div className="eph-proof">

                <div className="eph-proof-dots ephinta-right-panel-contrast-target" aria-hidden="true"><span>✓</span><span>♥</span><span>✦</span></div>

                <span>One clear plan. <strong>More room to enjoy the moment.</strong></span>

              </div>

            </div>



            <section className="ephinta-marketing-zone">

  <p className="ephinta-marketing-zone__eyebrow ephinta-force-visible-eyebrow ephinta-copy-eyebrow-force">ONE PLATFORM. EVERY DETAIL.</p>

  <h2>{marketingFocus === 'discover' ? 'Meet the people who make moments memorable.' : marketingFocus === 'plan' ? 'Your vision deserves a brilliant plan.' : 'More joy. Less event-day stress.'}</h2>

  <p className="ephinta-right-copy-visible ephinta-force-visible-description ephinta-copy-description-force">{marketingFocus === 'discover' ? 'Explore trusted event professionals and find the right people to bring your ideas to life.' : marketingFocus === 'plan' ? 'Keep ideas, suppliers, budgets and details together in one clear planning journey.' : 'Spend less time chasing details and more time enjoying the moments that matter.'}</p>

  <div className="ephinta-human-faces" aria-label="Friendly EPHINTA community">

    <img src="/brand/people/happy-face-1.svg" alt="Smiling customer" loading="lazy" />

    <img src="/brand/people/happy-face-2.svg" alt="Smiling event professional" loading="lazy" />

    <img src="/brand/people/happy-face-3.svg" alt="Smiling event host" loading="lazy" />

  </div>

  <p className="ephinta-human-proof ephinta-right-copy-visible ephinta-force-visible-tagline ephinta-copy-tagline-force">Made for real people, meaningful occasions and unforgettable moments.</p>

  <div className="ephinta-marketing-zone__switches" aria-label="Explore EPHINTA">

    <button type="button" aria-pressed={marketingFocus === 'discover'} onClick={() => setMarketingFocus('discover')}>Find professionals</button>

    <button type="button" aria-pressed={marketingFocus === 'plan'} onClick={() => setMarketingFocus('plan')}>Plan with confidence</button>

    <button type="button" aria-pressed={marketingFocus === 'celebrate'} onClick={() => setMarketingFocus('celebrate')}>Enjoy the moment</button>

  </div>

  <a className="ephinta-marketing-zone__cta" href="/plan">Plan your event <span aria-hidden="true">→</span></a>

</section>

          </div>

        </section>



        <section className="eph-strip" aria-label="Platform highlights">

          <div className="eph-stat"><strong>One place</strong><span>Bring your plans together</span></div>

          <div className="eph-stat"><strong>Your choice</strong><span>Explore services your way</span></div>

          <div className="eph-stat"><strong>Clear steps</strong><span>Keep details organized</span></div>

          <div className="eph-stat"><strong>More moments</strong><span>Spend time on what matters</span></div>

        </section>



        <section className="eph-section" id="how-it-works">

          <div className="eph-section-head"><span className="eph-section-kicker">Simple by design</span><h2><span className="ephinta-bright-slogan">Big moments. Better organized.</span></h2><p>Turn a big idea into a clear plan, connect with the services you need and keep your event details within reach.</p></div>

          <div className="eph-cards">

            <article className="eph-card"><div className="eph-card-icon" aria-hidden="true">✓</div><h3>01. Shape your vision</h3><p>Choose your event type, guest range, date and style. Your starting brief helps you organize the next steps.</p></article>

            <article className="eph-card"><div className="eph-card-icon" aria-hidden="true">✦</div><h3>02. Explore services</h3><p>Identify the vendors and event services that fit your plan. Review details before making a booking decision.</p></article>

            <article className="eph-card"><div className="eph-card-icon" aria-hidden="true">✓</div><h3>03. Keep it moving</h3><p>Keep your planning details together and return to your saved draft as your event takes shape.</p></article>

          </div>

        </section>



        {marketplaceCollections.map((collection) => (
          <section key={collection.title} className="eph-section" aria-label={collection.title}>
            <div className="eph-section-head">
              <span className="eph-section-kicker">Featured</span>
              <h2>{collection.title}</h2>
              <p>{collection.subtitle}</p>
            </div>
            <div className="eph-ad-scroll">
              {collection.items.map((item) => (
                <article key={`${collection.title}-${item.label}`} className="eph-ad-card">
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                  <p>{item.label} designed for memorable occasions and stress-free planning.</p>
                  <button type="button" onClick={() => openAuth('signup', 'CLIENT')}>{item.cta}</button>
                </article>
              ))}
            </div>
          </section>
        ))}

        <GoogleAdBanner />

        <section className="eph-section" id="vendors" style={{ paddingTop: 0 }}>

          <div><h2>Make your talent part of the moment.</h2><p>Are you an event professional or an organization? Create the appropriate account to get started with EPHINTA.</p></div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>

            <button className="eph-btn eph-btn-gold" onClick={() => openAuth('signup', 'VENDOR')}>Join as a vendor →</button>

            <button className="eph-btn" style={{ background: '#ffffff18', color: '#fff', border: '1px solid #ffffff3d' }} onClick={() => openAuth('signup', 'ORGANIZATION')}>Organization account</button>

          </div>

        </section>



        <section className="eph-section" id="safety" style={{ paddingTop: 0 }}>

          <div className="eph-section-head"><span className="eph-section-kicker">Plan with clarity</span><h2>Know what happens next.</h2><p>Review provider details, booking terms, prices and cancellation policies before committing. Platform protections depend on the services enabled for your account and booking.</p></div>

          <div className="eph-cards">

            <article className="eph-card"><div className="eph-card-icon" aria-hidden="true">◌</div><h3>Review provider details</h3><p>Check the provider's profile, service description and terms before you proceed.</p></article>

            <article className="eph-card"><div className="eph-card-icon" aria-hidden="true">◇</div><h3>Understand the booking</h3><p>Confirm what is included, payment timing and cancellation terms before paying.</p></article>

            <article className="eph-card"><div className="eph-card-icon" aria-hidden="true">♥</div><h3>Get help when needed</h3><p>Use the support options available in your account if you need assistance with a booking.</p></article>

          </div>

        </section>



        <section className="eph-section" id="faq" style={{ paddingTop: 0 }}>

          <div className="eph-section-head"><span className="eph-section-kicker">Questions, answered</span><h2>A clearer way to get started.</h2></div>

          <div className="eph-faq">

            <details><summary>Can I start planning before creating an account?</summary><p>Yes. You can begin with the planning form. Continuing to the next stage may ask you to create an account so the app can connect your plan to your profile.</p></details>

            <details><summary>Can I change my event details later?</summary><p>Your current draft is saved in this browser. Make sure to sign in and use the application's planning flow to keep information associated with your account.</p></details>

            <details><summary>How do vendor bookings and payments work?</summary><p>Available payment methods, provider terms and booking protections depend on the features enabled in the application. Review the details shown for each booking before paying.</p></details>

            <details><summary>How do I join as a vendor or organization?</summary><p>Choose the relevant account type above, then complete the registration form. Additional business information may be required.</p></details>

          </div>

        </section>

      </main>



      <footer className="eph-footer">

        <a className="eph-brand" href="#home"><img src="/brand/ephinta_logo4.png?v=20261010-092247" alt="" /><span>EPHINTA</span></a>

        <small>Plan thoughtfully. Celebrate fully.</small>

        <div className="eph-footer-links"><a href="#how-it-works">How it works</a><a href="#vendors">Vendors</a><a href="#safety">Safety</a><a href="#faq">FAQ</a></div>

      </footer>



      {authMode && <div className="eph-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setAuthMode(null); }}>

        <section className="eph-modal" role="dialog" aria-modal="true" aria-labelledby="eph-auth-title">

          <div className="eph-modal-brand"><img src="/brand/ephinta_logo2.png" alt="" /><span>EPHINTA</span></div>
          <div className="eph-modal-top"><div><h2 id="eph-auth-title">{authMode === 'signin' ? 'Welcome back' : authMode === 'forgot' ? 'Reset your password' : 'Create your EPHINTA account'}</h2><p>{authMode === 'signin' ? 'Sign in to continue planning.' : authMode === 'forgot' ? 'Enter your email and we\'ll send reset instructions if an account exists.' : 'A few details to get you started.'}</p></div><button className="eph-close" onClick={() => setAuthMode(null)} aria-label="Close dialog">&times;</button></div>

          {error && <div className="eph-auth-error" role="alert">{error}</div>}

          {notice && <div className="eph-auth-notice" role="status">{notice}</div>}

          <form onSubmit={submitAuth}>

            {authMode === 'signup' && <>

              <div className="eph-field"><label htmlFor="eph-name">Full name</label><input id="eph-name" className="eph-control" autoComplete="name" required minLength={2} value={name} onChange={e => setName(e.target.value)} /></div>

              <div className="eph-field"><label htmlFor="eph-role">Account type</label><select id="eph-role" className="eph-control" value={role} onChange={e => setRole(e.target.value as AccountRole)}><option value="CLIENT">Event planner / customer</option><option value="VENDOR">Vendor / service provider</option><option value="ORGANIZATION">Event organization</option></select></div>

              {(role === 'VENDOR' || role === 'ORGANIZATION') && <div className="eph-field"><label htmlFor="eph-business">Business / organization name</label><input id="eph-business" className="eph-control" required value={businessName} onChange={e => setBusinessName(e.target.value)} /></div>}

            </>}

            <div className="eph-field"><label htmlFor="eph-email">Email address</label><input id="eph-email" className="eph-control" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>

            {authMode !== 'forgot' && <div className="eph-field"><label htmlFor="eph-password">Password</label><div className="eph-password-wrap"><input id="eph-password" className="eph-control" type={showPassword ? 'text' : 'password'} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} required minLength={authMode === 'signup' ? 12 : 1} value={password} onChange={e => setPassword(e.target.value)} /><button className="eph-text-btn" type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Hide' : 'Show'}</button></div>{authMode === 'signup' && <small style={{ color: '#77788d' }}>Use at least 12 characters and meet the password rules shown by the application.</small>}</div>}

            <button className="eph-btn eph-btn-purple eph-planner-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : authMode === 'forgot' ? 'Send reset instructions' : 'Create account'}</button>

          </form>

          <div className="eph-auth-switch">{authMode === 'signin' ? <>Forgot password? <button onClick={() => { setAuthMode('forgot'); setError(''); setNotice(''); }}>Reset it</button><br />New to EPHINTA? <button onClick={() => { setAuthMode('signup'); setError(''); setNotice(''); }}>Create an account</button></> : <>Already have an account? <button onClick={() => { setAuthMode('signin'); setError(''); setNotice(''); }}>Sign in</button>

      <section className="ephinta-faq" aria-labelledby="ephinta-faq-title">

        <p className="ephinta-faq__eyebrow">Help centre</p>

        <h2 id="ephinta-faq-title">Questions, answered.</h2>

        <p className="ephinta-faq__intro">Clear guidance for planning, booking, account security and payments on EPHINTA.</p>

        <div className="ephinta-faq__grid">

          <details><summary>How do I create an account?</summary><p>Choose the account type that matches your role, complete the required fields and use an email address you control. Never share your password or one-time verification codes.</p></details>

          <details><summary>How do I find the right portal?</summary><p>Sign in with your account. Your permissions should determine the portal you can access. If you land on the wrong dashboard, sign out and contact support rather than creating a duplicate account.</p></details>

          <details><summary>How are payments protected?</summary><p>Use only the payment methods shown in the official checkout. Payment status must be confirmed by the payment provider and the server; a browser success message alone is not proof of payment.</p></details>

          <details><summary>Does EPHINTA store my card details?</summary><p>Card details should be entered only in a PCI-compliant payment provider's secure checkout or hosted fields. EPHINTA should not ask you to submit a full card number, CVV, PIN or banking password in a normal form.</p></details>

          <details><summary>What if a booking or transaction looks wrong?</summary><p>Keep your transaction reference and contact support through the official channel. Do not send passwords, CVV, PINs or one-time codes to support staff.</p></details>

          <details><summary>How do I protect my account?</summary><p>Use a unique strong password, sign out on shared devices, verify the site address before paying, and report suspicious activity immediately.</p></details>

        </div>

      </section>



</>}</div>

        </section>

      </div>}

    </div>

  );

}
