import React, { useEffect, useRef, useState } from 'react';
import { api, apiUrl } from '../lib/api';
import { checkPassword, PASSWORD_HELPER, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../lib/passwordRule';
import { applyEphintaTheme } from '../lib/ephintaTheme';
import { roleLabel, SELF_REGISTER_ROLES, type SelfRegisterRole } from '../lib/roleLabels';


type AuthPayload = {

  accessToken: string;

  refreshToken: string;

  user: { id: string; email: string; name: string; role: string; organizationMode?: 'EVENT_PLANNING' | 'SERVICE_PROVIDER' | null };

};



interface LandingPageProps {

  onLoginSuccess?: (payload: AuthPayload) => void;

  onOpenAuth?: (mode: AuthMode, role: AccountRole) => void;

  onStartBuilder?: () => void;

  onExploreMarketplace?: () => void;

}



type AuthMode = 'signin' | 'signup' | 'forgot';

type ThemeMode = 'dark' | 'light' | 'colorful';
type PlatformMode = 'demo' | 'test' | 'live';

type AccountRole = SelfRegisterRole;

type EventDraft = {

  type: string;

  guests: string;

  date: string;

  vibe: string;

  services: string[];

};



const eventTypes = ['Wedding', 'Birthday', 'Naming ceremony', 'Corporate event', 'Graduation', 'Remembrance', 'Burial'];

const vibes = ['Modern', 'Classic', 'Traditional', 'Garden', 'Luxury', 'Intimate'];

const serviceOptions = ['Venue', 'Catering', 'Photography', 'Decor', 'Music', 'Cake', 'AV & staging', 'Security'];

function friendlyAuthError(path: string, status: number, error: unknown): string {
  const payload = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = typeof payload.code === 'string' ? payload.code : '';
  const mode = path === 'register' ? 'signup' : path === 'forgot-password' ? 'forgot' : 'signin';
  if (code === 'INVALID_CREDENTIALS' || (status === 401 && mode === 'signin')) {
    return 'That email and password do not match. Check your details or use Forgot password to reset your password.';
  }
  if (code === 'ALREADY_EXISTS' || status === 409) {
    return 'An account with this email or phone number already exists. Sign in with that account, or use a different email or phone number.';
  }
  if (code === 'ACCOUNT_DISABLED') return 'This account is currently unavailable. Please contact support for help.';
  if (status === 429) return 'Too many attempts. Please wait a few minutes before trying again.';
  if (status >= 500) return 'We could not complete your request because of a server problem. Please try again shortly.';
  if (code === 'VALIDATION_ERROR' || status === 400 || status === 422) {
    const fieldErrors = payload.details && typeof payload.details === 'object'
      ? (payload.details as Record<string, unknown>).fieldErrors
      : undefined;
    const firstFieldError = fieldErrors && typeof fieldErrors === 'object'
      ? Object.values(fieldErrors as Record<string, unknown>).flat().find((value) => typeof value === 'string')
      : undefined;
    if (typeof firstFieldError === 'string' && !/internal|exception|prisma|stack|undefined|null/i.test(firstFieldError)) {
      return firstFieldError;
    }
    if (mode === 'signup') return 'Some registration details are missing or invalid. Review the fields and try again.';
    if (mode === 'forgot') return 'Enter a valid email address and try again.';
    return 'Please check your email address and password, then try again.';
  }
  return mode === 'signup'
    ? 'We could not create your account. Check your details and connection, then try again.'
    : mode === 'forgot'
      ? 'We could not send the reset instructions. Check your connection and try again.'
      : 'We could not sign you in. Check your connection and try again.';
}

async function sendAuth(path: string, body: Record<string, unknown>) {
  const response = await fetch(apiUrl(`/auth/${path}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(friendlyAuthError(path, response.status, data?.error));
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

const MARKETPLACE_SPOTLIGHTS = [
  { id: 'venues', icon: '⌂', eyebrow: 'VENUES & SPACES', title: 'Find a setting that fits your occasion', description: 'Explore event spaces, halls, outdoor venues and locations for gatherings of every size.' },
  { id: 'catering', icon: '✦', eyebrow: 'FOOD & EXPERIENCES', title: 'Bring everyone together around the table', description: 'Discover catering teams, cakes, drinks and hospitality services for your event.' },
  { id: 'photography', icon: '◉', eyebrow: 'PHOTO & VIDEO', title: 'Keep the moments worth remembering', description: 'Find photographers, videographers and creative teams to capture your occasion.' },
  { id: 'production', icon: '◇', eyebrow: 'DECOR & PRODUCTION', title: 'Give your ideas a memorable finish', description: 'Browse décor, rentals, sound, lighting, staging and event production services.' },
] as const;

export default function PublicLanding({

  onLoginSuccess,

  onOpenAuth,

  onStartBuilder,

  onExploreMarketplace,

}: LandingPageProps) {

  const isNativeApp = Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

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

  const [platformMode, setPlatformMode] = useState<PlatformMode | ''>('');
  const [platformModeLoading, setPlatformModeLoading] = useState(true);
  const [platformModeMessage, setPlatformModeMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<{ paymentMode: PlatformMode }>('/runtime/config')
      .then((result) => {
        if (!cancelled && ['demo', 'test', 'live'].includes(result.paymentMode)) {
          setPlatformMode(result.paymentMode);
        }
      })
      .catch(() => {
        if (!cancelled) setPlatformModeMessage('Sign in as an administrator to manage the platform mode.');
      })
      .finally(() => {
        if (!cancelled) setPlatformModeLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function changePlatformMode(nextMode: PlatformMode) {
    if (!platformMode || nextMode === platformMode) return;
    if (nextMode === 'live') {
      if (!window.confirm('Switch the entire EPHINTA platform to LIVE? Real payments and withdrawals may be initiated.')) return;
      if (window.prompt('Type LIVE to confirm production mode.') !== 'LIVE') return;
    }
    setPlatformModeMessage('Applying platform mode…');
    try {
      const result = await api<{ paymentMode: PlatformMode }>('/admin/runtime/payment-mode', {
        method: 'PATCH',
        body: JSON.stringify({ paymentMode: nextMode }),
      });
      setPlatformMode(result.paymentMode);
      setPlatformModeMessage(`Platform mode is now ${result.paymentMode.toUpperCase()}.`);
    } catch (cause) {
      setPlatformModeMessage(cause instanceof Error
        ? cause.message
        : 'Only an authorized administrator can change the platform mode.');
    }
  }

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {

    try {

      const saved = localStorage.getItem('ephinta:theme');

      return saved === 'dark' || saved === 'light' || saved === 'colorful' ? saved : 'colorful';

    } catch { return 'colorful'; }

  });

  const [marketingFocus, setMarketingFocus] = useState<'discover' | 'plan' | 'celebrate'>('discover');

  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  const [registrationStep, setRegistrationStep] = useState(0);

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


  useEffect(() => {
    let cancelled = false;

    fetch(apiUrl('/billing/public-promotions'))
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
    try { localStorage.setItem('ess:eventDraft', JSON.stringify(draft)); } catch { /* storage may be disabled */ }

  }, [draft]);



  useEffect(() => {

    try { localStorage.setItem('ess:eventDraft', JSON.stringify(draft)); } catch { /* storage may be disabled */ }

  }, [draft]);

  useEffect(() => {
    const passwordInput = document.getElementById('eph-password') as HTMLInputElement | null;
    passwordInput?.setCustomValidity('');
  }, [authMode]);

  useEffect(() => {
    applyEphintaTheme(themeMode);
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
    setPassword('');
    setName('');
    setBusinessName('');
    setRegistrationStep(0);
    if (onOpenAuth) {
      onOpenAuth(mode, requestedRole);
      return;
    }
    if (mode === 'signup') {
      window.location.assign(requestedRole === 'CLIENT' ? '/plan' : `/join/${requestedRole.toLowerCase()}`);
      return;
    }
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
    if (busy) return;
    if (authMode === 'signup' && !checkPassword(password).ok) {
      setError(PASSWORD_HELPER);
      return;
    }

    setBusy(true);    setError('');

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
      setError(e instanceof TypeError
        ? 'We could not reach EPHINTA. Check your internet connection and try again.'
        : e instanceof Error
          ? e.message
          : 'We could not complete your request. Please try again.');
    } finally {

      setBusy(false);

    }

  }



  function startPlanning() {
    // Planning navigation must never start or restart event music. Music remains
    // controlled by the user's separate consent and player controls.
    try { localStorage.setItem('ess:eventDraft', JSON.stringify(draft)); } catch { /* storage may be disabled */ }
    const musicCategory = /burial|remembrance/i.test(draft.type)
      ? 'burial'
      : /naming/i.test(draft.type)
        ? 'naming'
        : 'wedding';
    try { localStorage.setItem('ephinta:music-category', musicCategory); } catch { /* storage may be disabled */ }
    window.dispatchEvent(new CustomEvent('ephinta:music-category-change', { detail: musicCategory }));
    setMenuOpen(false);
    if (onStartBuilder) {
      onStartBuilder();
      return;
    }
    window.location.assign('/plan');
  }

  function exploreMarketplace() {
    setMenuOpen(false);
    if (onExploreMarketplace) {
      onExploreMarketplace();
      return;
    }
    window.location.assign('/marketplace');
  }



  return (

    <div className="eph-landing" data-theme={themeMode} data-native={isNativeApp ? "true" : "false"}>

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

        /* Keep marketplace promotion headings legible on the dark campaign surface in every theme. */
        .eph-landing[data-theme="colorful"] .eph-promo-shell.eph-marketplace-advertising .eph-promo-heading h2{color:#fff!important}

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

        .eph-vendor-invite{padding-top:34px;padding-bottom:84px}
        .eph-vendor-invite__content{width:min(100%,920px);margin:0 auto;padding:clamp(30px,5vw,58px) clamp(22px,5vw,64px);display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;border:1px solid rgba(151,117,205,.22);border-radius:28px;background:radial-gradient(ellipse at 12% 100%,rgba(255,224,170,.46),transparent 42%),radial-gradient(ellipse at 90% 0%,rgba(237,190,224,.42),transparent 44%),linear-gradient(120deg,#fffafd 0%,#f4efff 55%,#fff9ee 100%);box-shadow:0 22px 58px rgba(56,38,91,.09)}
        .eph-vendor-invite__eyebrow{color:#7951b5;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
        .eph-vendor-invite h2{max-width:760px;margin:0;color:#211735}
        .eph-vendor-invite__content>p{max-width:660px;margin:0;color:#625a70;font-size:15px;line-height:1.8}
        .eph-vendor-invite__actions{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:12px;margin-top:8px}
        .eph-vendor-invite__organization{background:rgba(255,255,255,.72);color:#4e3b70;border:1px solid rgba(117,91,166,.28)}
        .eph-landing[data-theme="dark"] .eph-vendor-invite__content{background:radial-gradient(ellipse at 12% 100%,rgba(151,111,62,.2),transparent 42%),radial-gradient(ellipse at 90% 0%,rgba(111,68,151,.34),transparent 44%),linear-gradient(120deg,#17172b 0%,#201b32 55%,#24202b 100%);border-color:rgba(180,157,226,.3)}
        .eph-landing[data-theme="dark"] .eph-vendor-invite__eyebrow{color:#d8baff}
        .eph-landing[data-theme="dark"] .eph-vendor-invite__content>p{color:#d5cfe4}
        .eph-landing[data-theme="dark"] .eph-vendor-invite__organization{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(210,190,245,.35)}
        @media(max-width:760px){.eph-vendor-invite{padding-top:18px;padding-bottom:58px}.eph-vendor-invite__content{border-radius:22px;padding:30px 20px}.eph-vendor-invite__actions{width:100%;flex-direction:column}.eph-vendor-invite__actions .eph-btn{width:100%;max-width:360px}}
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


        /* Customer-journey polish: clearer brand, softer promotional surfaces,
           centred authentication and predictable small-screen layouts. */
        .eph-landing .eph-brand { gap: 12px; }
        .eph-landing .eph-brand img { width: 44px; height: 44px; }
        .eph-landing .eph-brand span { font-size: clamp(19px, 2vw, 24px); letter-spacing: .14em; }
        .eph-landing .eph-title { font-size: clamp(3rem, 6.2vw, 5.25rem); line-height: 1.02; }
        .eph-landing .eph-subtitle { font-size: clamp(17px, 1.45vw, 20px); line-height: 1.75; }
        /* Promotional cards retain their dark campaign surface, so their
           headings and supporting copy stay high-contrast at every breakpoint. */
        .eph-landing .eph-promo-shell { background: linear-gradient(135deg,#0f172a,#1f2a46) !important; color: #fff !important; border: 1px solid rgba(255,255,255,.12) !important; box-shadow: 0 18px 30px rgba(15,23,42,.15) !important; }
        .eph-landing .eph-promo-shell h2 { color: #fff !important; }
        .eph-landing .eph-promo-shell p, .eph-landing .eph-promo-shell .eph-promo-placeholder { color: #dce5ff !important; }
        .eph-landing .eph-promo-marketplace-cta { color: #fff !important; background: var(--purple) !important; }
        .eph-landing .eph-promo-kicker {
          color: var(--purple) !important; -webkit-text-fill-color: currentColor !important;
          opacity: 1 !important; text-shadow: none !important; font-weight: 900 !important;
        }
        .eph-landing .eph-promo-footer,
        .eph-landing .eph-promo-footer span {
          color: var(--muted) !important; -webkit-text-fill-color: currentColor !important;
          opacity: 1 !important; text-shadow: none !important;
        }
        .eph-landing .ephinta-marketing-zone p,
        .eph-landing .ephinta-marketing-zone .ephinta-human-proof {
          color: var(--muted) !important; -webkit-text-fill-color: currentColor !important;
          opacity: 1 !important; text-shadow: none !important;
        }
        .eph-landing .ephinta-marketing-zone .ephinta-right-copy-visible {
          color: #55586d !important; -webkit-text-fill-color: #55586d !important;
          opacity: 1 !important; text-shadow: none !important;
        }
        .eph-landing .ephinta-marketing-zone .ephinta-marketing-zone__eyebrow {
          color: #5b36b8 !important; -webkit-text-fill-color: #5b36b8 !important;
          opacity: 1 !important; text-shadow: none !important;
        }


        .eph-landing .eph-ad-card {
          background: rgba(255,255,255,.88) !important;
          border: 1px solid var(--line) !important;
          color: var(--ink) !important;
          box-shadow: 0 10px 26px rgba(30,18,48,.07) !important;
        }
        .eph-landing .eph-ad-card strong,
        .eph-landing .eph-ad-card small,
        .eph-landing .eph-ad-card p,
        .eph-landing .eph-ad-card .eph-ad-meta span {
          color: var(--ink) !important;
          -webkit-text-fill-color: currentColor !important;
          text-shadow: none !important;
          opacity: 1 !important;
        }
        .eph-landing .eph-ad-card small { color: var(--purple) !important; }
        .eph-landing .eph-ad-card p { color: var(--muted) !important; line-height: 1.55; }
        .eph-landing .eph-ad-card button { color: #fff !important; background: var(--purple) !important; }
        .eph-landing .eph-brand img { width: 50px !important; height: 50px !important; }
        .eph-landing .eph-brand span { font-size: clamp(22px, 2.2vw, 26px) !important; letter-spacing: .16em !important; }

        .eph-landing .ephinta-marketing-zone { color: var(--ink) !important; background: transparent !important; background-image: none !important; border: 1px solid var(--line) !important; box-shadow: none !important; isolation: isolate; }
        .eph-landing .ephinta-marketing-zone h2 { color: var(--ink) !important; }
        .eph-landing .ephinta-marketing-zone p, .eph-landing .ephinta-marketing-zone .ephinta-human-proof { color: var(--muted) !important; -webkit-text-fill-color: currentColor !important; text-shadow: none !important; }
        .eph-landing .ephinta-marketing-zone .ephinta-marketing-zone__eyebrow { color: var(--purple) !important; -webkit-text-fill-color: currentColor !important; text-shadow: none !important; }
        .eph-landing .eph-modal-backdrop { display: grid; place-items: center; align-items: center; padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; }
        .eph-landing .eph-modal { width: min(100%, 480px); margin: auto; max-height: min(92dvh, 900px); overflow-y: auto; }
        .eph-landing .ephinta-marketing-zone__cta { border: 0; cursor: pointer; font: inherit; min-height: 48px; }
        @media (max-width: 700px) {
          .eph-landing .eph-nav { min-height: 72px; height: auto; padding-block: 10px; gap: 12px; }
          .eph-landing .eph-brand img { width: 38px; height: 38px; }
          .eph-landing .eph-brand span { font-size: 18px; }
          .eph-landing .eph-title { font-size: clamp(2.65rem, 12vw, 4rem); }
          .eph-landing .eph-modal { padding: 22px 18px; max-height: 90dvh; }
          .eph-landing .eph-promo-shell { padding: 18px 16px; }
        }

        @media (max-width: 390px) {
          .eph-landing .eph-nav { padding-inline: 12px; gap: 8px; }
          .eph-landing .eph-brand { gap: 7px; }
          .eph-landing .eph-brand img { width: 36px !important; height: 36px !important; }
          .eph-landing .eph-brand span { display: inline !important; font-size: 17px !important; letter-spacing: .12em !important; }
          .eph-landing .eph-nav-actions { gap: 8px; }
          .eph-landing .eph-nav-actions .eph-btn { padding: 9px 9px !important; font-size: 11px !important; }
        }


        /* Front-page polish: stronger identity, calmer surfaces and resilient layouts. */
        .eph-landing .eph-nav{min-height:84px;height:auto;padding-top:12px;padding-bottom:12px;gap:clamp(12px,2vw,28px)}
        .eph-landing .eph-brand{gap:12px}
        .eph-landing .eph-brand img{width:42px;height:42px;flex:0 0 42px;border-radius:12px}
        .eph-landing .eph-brand span{font-size:18px;letter-spacing:.16em}
        .eph-landing .eph-title{font-size:clamp(42px,5.6vw,78px);line-height:1.02;letter-spacing:-.055em;overflow-wrap:anywhere}
        .eph-landing .eph-title em{white-space:normal}
        .eph-landing .eph-subtitle{font-size:clamp(15px,1.35vw,18px);line-height:1.75}
        .eph-landing .eph-hero{background:radial-gradient(ellipse at 82% 14%,#eadfff 0,transparent 36%),radial-gradient(ellipse at 12% 92%,#fff0d7 0,transparent 30%),linear-gradient(125deg,#fff 0%,#f8f5ff 52%,#fffaf3 100%)}
        .eph-landing[data-theme="colorful"] .eph-hero{background:radial-gradient(ellipse at 84% 8%,#f7d8ea 0,transparent 36%),radial-gradient(ellipse at 12% 90%,#ffedc9 0,transparent 32%),linear-gradient(120deg,#fffafd,#f7f1ff 55%,#fffaf2)}
        .eph-landing .eph-planner{box-shadow:0 22px 64px rgba(43,31,76,.10);border-color:rgba(117,91,166,.18)}
        .eph-landing .eph-section{background:linear-gradient(180deg,rgba(248,246,252,.72),rgba(255,255,255,.96))}
        .eph-landing .eph-nav-actions .eph-btn{white-space:nowrap}
        .eph-landing .eph-btn:focus-visible,.eph-landing a:focus-visible,.eph-landing button:focus-visible{outline:3px solid #ffbd43;outline-offset:3px}
        @media(max-width:980px){
          .eph-landing .eph-nav{flex-wrap:wrap}
          .eph-landing .eph-hero-grid{grid-template-columns:minmax(0,1fr) minmax(0,.92fr);gap:28px}
          .eph-landing .eph-title{font-size:clamp(40px,6vw,60px)}
        }
        @media(max-width:760px){
          .eph-landing .eph-nav{min-height:72px;padding:10px 16px}
          .eph-landing .eph-brand img{width:36px;height:36px;flex-basis:36px}
          .eph-landing .eph-brand span{font-size:15px}
          .eph-landing .eph-hero-grid{grid-template-columns:minmax(0,1fr);gap:30px}
          .eph-landing .eph-hero{padding:42px 18px 54px;min-height:0}
          .eph-landing .eph-title{font-size:clamp(38px,10vw,58px);max-width:100%}
          .eph-landing .eph-hero-cta{display:grid;grid-template-columns:1fr;align-items:stretch}
          .eph-landing .eph-hero-cta .eph-btn{width:100%;min-height:48px}
          .eph-landing .eph-planner{padding:20px}
        }
        @media(max-width:390px){
          .eph-landing .eph-brand span{display:inline!important;font-size:17px!important;letter-spacing:.1em!important}
          .eph-landing .eph-brand img{width:32px;height:32px;flex-basis:32px}
          .eph-landing .eph-nav-actions .eph-btn{font-size:10px!important;padding:10px 8px!important}
          .eph-landing .eph-title{font-size:38px}
        }
        @media(prefers-reduced-motion:reduce){.eph-landing *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}

        /* Landing marketing panel + authentication dialog: final theme-aware contrast contract. */
        .eph-landing {
          --eph-marketing-surface: #ffffff;
          --eph-marketing-ink: #21162f;
          --eph-marketing-muted: #51445f;
          --eph-marketing-accent: #5424a8;
          --eph-marketing-border: #d6c9e5;
        }
        .eph-landing[data-theme="light"] {
          --eph-marketing-surface: #ffffff;
          --eph-marketing-ink: #111827;
          --eph-marketing-muted: #374151;
          --eph-marketing-accent: #3730a3;
          --eph-marketing-border: #cbd5e1;
        }
        .eph-landing[data-theme="dark"] {
          --eph-marketing-surface: #202039;
          --eph-marketing-ink: #f8fafc;
          --eph-marketing-muted: #d5deee;
          --eph-marketing-accent: #c4b5fd;
          --eph-marketing-border: #46536c;
        }
        .eph-landing[data-theme="colorful"] {
          --eph-marketing-surface: #ffffff;
          --eph-marketing-ink: #21112b;
          --eph-marketing-muted: #4d3b57;
          --eph-marketing-accent: #6b279b;
          --eph-marketing-border: #d8c5df;
        }

        /* The full marketing block: headings, copy, labels, captions and links. */
        .eph-landing .ephinta-marketing-zone {
          color: var(--eph-marketing-ink) !important;
          background: var(--eph-marketing-surface) !important;
          background-image: none !important;
          border: 1px solid var(--eph-marketing-border) !important;
        }
        .eph-landing .ephinta-marketing-zone :where(h1,h2,h3,h4,h5,strong,b) {
          color: var(--eph-marketing-ink) !important;
          -webkit-text-fill-color: currentColor !important;
          opacity: 1 !important;
          text-shadow: none !important;
        }
        .eph-landing .ephinta-marketing-zone :where(p,li,small,span,label,figcaption,.ephinta-human-proof,.ephinta-right-copy-visible) {
          color: var(--eph-marketing-muted) !important;
          -webkit-text-fill-color: currentColor !important;
          opacity: 1 !important;
          text-shadow: none !important;
        }
        .eph-landing .ephinta-marketing-zone :where(a,.ephinta-marketing-zone__eyebrow) {
          color: var(--eph-marketing-accent) !important;
          -webkit-text-fill-color: currentColor !important;
          opacity: 1 !important;
        }
        .eph-landing .ephinta-marketing-zone :where(button,.ephinta-marketing-zone__cta) {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          background: var(--purple) !important;
          border-color: var(--purple) !important;
        }

        /* Marketing/auth modal must keep readable copy and controls in all 3 themes. */
        .eph-landing .eph-modal {
          color: var(--eph-marketing-ink) !important;
          background: var(--eph-marketing-surface) !important;
          border: 1px solid var(--eph-marketing-border) !important;
        }
        .eph-landing .eph-modal :where(h1,h2,h3,h4,strong,b,label,.eph-field-title) {
          color: var(--eph-marketing-ink) !important;
          -webkit-text-fill-color: currentColor !important;
          opacity: 1 !important;
        }
        .eph-landing .eph-modal :where(p,small,.eph-auth-switch) {
          color: var(--eph-marketing-muted) !important;
          -webkit-text-fill-color: currentColor !important;
          opacity: 1 !important;
        }
        .eph-landing .eph-modal :where(input,select,textarea) {
          color: var(--eph-marketing-ink) !important;
          -webkit-text-fill-color: var(--eph-marketing-ink) !important;
          background: var(--eph-marketing-surface) !important;
          border-color: var(--eph-marketing-border) !important;
        }
        .eph-landing .eph-modal :where(input,textarea)::placeholder {
          color: var(--eph-marketing-muted) !important;
          -webkit-text-fill-color: var(--eph-marketing-muted) !important;
          opacity: 1 !important;
        }
        .eph-landing .eph-modal .eph-close {
          color: var(--eph-marketing-ink) !important;
          background: color-mix(in srgb, var(--eph-marketing-muted) 12%, var(--eph-marketing-surface)) !important;
        }
        .eph-landing .eph-modal .eph-text-btn,
        .eph-landing .eph-modal .eph-auth-switch button {
          color: var(--eph-marketing-accent) !important;
          -webkit-text-fill-color: currentColor !important;
        }

        /* Remove the previous fixed grey text override that failed on dark mode. */
        .eph-landing .ephinta-marketing-zone .ephinta-right-copy-visible {
          color: var(--eph-marketing-muted) !important;
          -webkit-text-fill-color: currentColor !important;
        }


        /* Final landing navigation/footer contrast and restrained brand gradients. */
        .eph-landing .eph-nav {
          background: linear-gradient(112deg, #11152d 0%, #211b45 56%, #173746 100%) !important;
          color: #fff !important;
          border-bottom: 1px solid rgba(211, 197, 255, .22);
          box-shadow: 0 8px 26px rgba(14, 12, 38, .18);
        }
        .eph-landing .eph-nav .eph-brand,
        .eph-landing .eph-nav .eph-signin,
        .eph-landing .eph-nav .eph-menu { color: #fff !important; }
        .eph-landing .eph-nav .eph-links {
          background: linear-gradient(145deg, #171a36 0%, #29214d 62%, #183746 100%) !important;
          border: 1px solid rgba(219, 207, 255, .24);
          box-shadow: 0 22px 44px rgba(8, 10, 28, .32);
        }
        .eph-landing .eph-nav .eph-links > a {
          color: #f7f5ff !important;
          opacity: 1 !important;
          font-weight: 750;
        }
        .eph-landing .eph-nav .eph-links > a:hover,
        .eph-landing .eph-nav .eph-links > a:focus-visible {
          color: #ffe2a0 !important;
          background: rgba(255,255,255,.075);
          border-radius: 8px;
        }
        .eph-landing .eph-nav .eph-menu-label { color: #e1d4ff !important; }
        .eph-landing .eph-nav .eph-menu-portals button {
          color: #fff !important;
          background: rgba(255,255,255,.09);
          border-color: rgba(255,255,255,.2);
        }
        .eph-landing .eph-nav .eph-menu-portals button:hover,
        .eph-landing .eph-nav .eph-menu-portals button:focus-visible {
          background: rgba(255,255,255,.16);
          border-color: rgba(255,211,112,.7);
        }
        .eph-landing .eph-nav .eph-btn-gold,
        .eph-landing .eph-hero .eph-btn-gold {
          color: #21162f !important;
          background: linear-gradient(110deg, #ffdc83 0%, #ffb86b 100%) !important;
          box-shadow: 0 8px 22px rgba(255,184,107,.2);
        }
        .eph-landing .eph-footer {
          background: linear-gradient(112deg, #11152d 0%, #211b45 56%, #173746 100%) !important;
          color: #f7f5ff !important;
          border-top: 1px solid rgba(211,197,255,.22);
        }
        .eph-landing .eph-footer .eph-brand,
        .eph-landing .eph-footer .eph-brand span,
        .eph-landing .eph-footer small,
        .eph-landing .eph-footer a {
          color: #f7f5ff !important;
          opacity: 1 !important;
          -webkit-text-fill-color: currentColor !important;
        }
        .eph-landing .eph-footer .eph-footer-copy {
          display: grid;
          gap: 5px;
          min-width: 0;
        }
        .eph-landing .eph-footer .eph-footer-copyright {
          color: #e0d9f5 !important;
          font-size: 11px;
          line-height: 1.5;
          font-weight: 650;
        }
        .eph-landing .eph-footer-links a {
          text-decoration: none;
          text-underline-offset: 4px;
        }
        .eph-landing .eph-footer-links a:hover,
        .eph-landing .eph-footer-links a:focus-visible {
          color: #ffdc83 !important;
          text-decoration: underline;
        }
        @media (max-width: 760px) {
          .eph-landing .eph-footer { align-items: flex-start; gap: 12px; }
          .eph-landing .eph-footer .eph-footer-copy { width: 100%; }
          .eph-landing .eph-footer .eph-footer-copyright { overflow-wrap: anywhere; }
        }

      `}</style>



      <header className="eph-nav">

        <a className="eph-brand" href="#home" aria-label="Ephinta home">

          <img src="/brand/ephinta_logo4.png?v=20261010-092247" alt="EPHINTA" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />

          <span>EPHINTA</span>

        </a>

        <label className="eph-theme-select" aria-label="Colour theme"><select value={themeMode} onChange={e => setThemeMode(e.target.value as ThemeMode)} aria-label="Colour theme">

              <option value="dark">Dark</option><option value="light">Light</option><option value="colorful">Multicolor</option>            </select>

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

          <div className="ephinta-theme-menu-control ephinta-experience-menu-control">
            <label htmlFor="ephinta-platform-mode">Payment mode</label>
            <select
              id="ephinta-platform-mode"
              value={platformMode}
              disabled={platformModeLoading || !platformMode}
              onChange={(event) => void changePlatformMode(event.target.value as PlatformMode)}
              aria-describedby="ephinta-platform-mode-status"
            >
              <option value="" disabled>{platformModeLoading ? 'Loading…' : 'Unavailable'}</option>
              <option value="demo">DEMO</option>
              <option value="test">TEST</option>
              <option value="live">LIVE</option>
            </select>
            <small id="ephinta-platform-mode-status" role="status" aria-live="polite">
              {platformModeMessage || (platformMode ? `Current: ${platformMode.toUpperCase()}` : 'Mode status unavailable')}
            </small>
          </div>

          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>

          <a href="#vendors" onClick={() => setMenuOpen(false)}>Vendors</a>

          <a href="#safety" onClick={() => setMenuOpen(false)}>Safety</a>

          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>



          <div className="eph-menu-portals">

             <span className="eph-menu-label">PORTALS & ACCOUNTS</span>

             <button type="button" className="eph-menu-primary" onClick={() => { setMenuOpen(false); startPlanning(); }}><img src="/brand/ephinta_logo4.png?v=20261010-092247" alt="" />Start Planner <span aria-hidden="true">→</span></button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signin'); }}>Sign in to your account</button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signup', 'CLIENT'); }}>Create customer account</button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signup', 'VENDOR'); }}>Create vendor account</button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signup', 'ORGANIZATION'); }}>Create organizer account</button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signup', 'AFFILIATE'); }}>Create affiliate account</button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signup', 'VERIFIER'); }}>Create verifier account</button>

            <button type="button" onClick={() => { setMenuOpen(false); openAuth('signup', 'CONSULTANT'); }}>Create consultant account</button>

          </div>

</nav>

        <div className="eph-nav-actions">

          <button className="eph-btn eph-btn-gold" onClick={startPlanning}>Start Planner <span aria-hidden="true">→</span></button>

          <button ref={menuButtonRef} type="button" className="eph-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-controls="eph-information-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
            <span className="eph-menu-bars" aria-hidden="true"><span /><span /><span /></span>
          </button>

        </div>

      </header>



      <section className="eph-promotions" aria-label="EPHINTA Marketplace and featured vendor promotions">
        <div className="eph-promo-shell eph-marketplace-advertising">
          <div className="eph-promo-heading">
            <div>
              <span className="eph-promo-kicker">DISCOVER THE EPHINTA MARKETPLACE</span>
              <h2>Find the people and services behind your next big moment.</h2>
              <p>{isNativeApp ? "Browse event venues, catering, photography, décor and trusted local event professionals." : "Browse event venues, catering, photography, décor and trusted event professionals. Featured vendor campaigns appear here when approved and active."}</p>
            </div>
            <button type="button" className="eph-promo-marketplace-cta" onClick={() => exploreMarketplace()}>
              Explore marketplace <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="eph-ad-scroll" role="list" aria-label="Horizontally scrollable marketplace categories and sponsored offers">
            {(!isNativeApp ? promotions : []).map((promotion) => (
              <article className="eph-ad-card eph-ad-card-sponsored" role="listitem" key={promotion.id}>
                <small>Sponsored · Featured vendor</small>
                <strong>{promotion.title}</strong>
                <p>{promotion.description || `${promotion.vendorName} is sharing a featured event service on EPHINTA.`}</p>
                <div className="eph-ad-meta">
                  <span>{promotion.vendorName}</span>
                  {promotion.listingTitle && <span>{promotion.listingTitle}</span>}
                  {formatPromotionLocation(promotion.city, promotion.country) && <span>{formatPromotionLocation(promotion.city, promotion.country)}</span>}
                </div>
                <button type="button" onClick={() => exploreMarketplace()}>View marketplace offer →</button>
              </article>
            ))}
            {MARKETPLACE_SPOTLIGHTS.map((item) => (
              <article className="eph-ad-card eph-ad-card-marketplace" role="listitem" key={item.id}>
                <span className="eph-ad-icon" aria-hidden="true">{item.icon}</span>
                <small>{item.eyebrow}</small>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <button type="button" onClick={() => exploreMarketplace()}>Explore services →</button>
              </article>
            ))}
          </div>
          <div className="eph-promo-footer">
            <span>{promotions.length ? `${promotions.length} approved vendor promotion${promotions.length === 1 ? "" : "s"} currently featured` : "Marketplace categories are ready to explore. Vendor promotions will appear here after approval."}</span>
            <span className="eph-promo-scroll-hint">Swipe or scroll to see more <span aria-hidden="true">→</span></span>
          </div>
        </div>
      </section>

      <main id="home">

        <section className="eph-hero">

          <div className="eph-hero-grid">

            <div>

              <div className="eph-eyebrow"><i /> Your event. Your vision. One platform.</div>

              <h1 className="eph-title ephinta-bright-headline">Plan the event<br /><span className="ephinta-marker-phrase">you <span className="ephinta-marker-word"><em>imagine.</em></span></span></h1>

              <p className="eph-subtitle">From the first idea to the final guest, bring every detail together. Discover event professionals, organize your plans and build an occasion that feels unmistakably yours.</p>

              <div className="eph-hero-cta">

                <button className="eph-btn eph-btn-purple" onClick={startPlanning}>Start Planner <span aria-hidden="true">→</span></button>

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

  <button type="button" className="ephinta-marketing-zone__cta" onClick={startPlanning}>Plan your event <span aria-hidden="true">→</span></button>

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





        <section className="eph-section eph-vendor-invite" id="vendors" aria-labelledby="eph-vendor-invite-title">
          <div className="eph-vendor-invite__content">
            <span className="eph-vendor-invite__eyebrow">FOR EVENT PROFESSIONALS & ORGANIZATIONS</span>
            <h2 id="eph-vendor-invite-title">Make your talent part of the moment.</h2>
            <p>Are you an event professional or an organization? Create the appropriate account to get started with EPHINTA.</p>
            <div className="eph-vendor-invite__actions">
              <button className="eph-btn eph-btn-gold" onClick={() => openAuth('signup', 'VENDOR')}>Join as a vendor <span aria-hidden="true">→</span></button>
              <button className="eph-btn eph-vendor-invite__organization" onClick={() => openAuth('signup', 'ORGANIZATION')}>Create an organization account</button>
            </div>
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

        <div className="eph-footer-copy"><small>Plan thoughtfully. Celebrate fully.</small><small className="eph-footer-copyright">© Dublu Ve Entertainment, Todysec IS. 2026. Since 2022.</small></div>

        <div className="eph-footer-links"><a href="#how-it-works">How it works</a><a href="#vendors">Vendors</a><a href="#safety">Safety</a><a href="#faq">FAQ</a></div>

      </footer>



      {authMode && <div className="eph-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setAuthMode(null); }}>

        <section id="eph-auth-dialog" className="eph-modal" role="dialog" aria-modal="true" aria-labelledby="eph-auth-title">

          <div className="eph-modal-brand"><img src="/brand/ephinta_logo2.png" alt="" /><span>EPHINTA</span></div>
          <div className="eph-modal-top"><div><h2 id="eph-auth-title">{authMode === 'signin' ? 'Welcome back' : authMode === 'forgot' ? 'Reset your password' : ['Create your EPHINTA account', 'Choose your account type', 'Confirm your details'][registrationStep]}</h2><p>{authMode === 'signin' ? 'Sign in to continue planning.' : authMode === 'forgot' ? 'Enter your email and we\'ll send reset instructions if an account exists.' : ['Start with your contact details.', 'Choose how you will use EPHINTA.', 'Check your information before creating your account.'][registrationStep]}</p></div><button className="eph-close" onClick={() => setAuthMode(null)} aria-label="Close dialog">&times;</button></div>

          {error && <div className="eph-auth-error" role="alert" aria-live="assertive">{error}</div>}

          {notice && <div className="eph-auth-notice" role="status">{notice}</div>}

          {authMode === 'signup' && (
            <div className="eph-registration-progress" aria-label={`Registration step ${registrationStep + 1} of 3`}>
              <div className="eph-registration-progress-copy">
                <strong>Step {registrationStep + 1} of 3</strong>
                <span>{['Your details', 'Account type', 'Review'][registrationStep]}</span>
              </div>
              <div className="eph-registration-progress-track"><span style={{ width: `${((registrationStep + 1) / 3) * 100}%` }} /></div>
            </div>
          )}

          <form onSubmit={submitAuth}>
            {authMode === 'signup' && registrationStep === 0 && (
              <div className="eph-field">
                <label htmlFor="eph-name">Full name</label>
                <input id="eph-name" className="eph-control" autoComplete="name" required minLength={2} value={name} onChange={e => setName(e.target.value)} />
              </div>
            )}

            {(authMode !== 'signup' || registrationStep === 0) && (
              <>
                <div className="eph-field">
                  <label htmlFor="eph-email">Email address</label>
                  <input id="eph-email" className="eph-control" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                {authMode !== 'forgot' && (
                  <div className="eph-field">
                    <label htmlFor="eph-password">Password</label>
                    <div className="eph-password-wrap">
                      <input id="eph-password" className="eph-control" type={showPassword ? 'text' : 'password'} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} required minLength={authMode === 'signup' ? PASSWORD_MIN_LENGTH : undefined} maxLength={PASSWORD_MAX_LENGTH} value={password} onChange={e => { setPassword(e.target.value); e.currentTarget.setCustomValidity(authMode === 'signup' && e.target.value && !checkPassword(e.target.value).ok ? PASSWORD_HELPER : ''); }} />
                      <button className="eph-text-btn" type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
                    </div>
                    {authMode === 'signup' && <small style={{ color: '#77788d' }}>{PASSWORD_HELPER}</small>}
                  </div>
                )}
              </>
            )}

            {authMode === 'signup' && registrationStep === 1 && (
              <>
                <div className="eph-field">
                  <label htmlFor="eph-role">Account type</label>
                  <select id="eph-role" className="eph-control" value={role} onChange={e => setRole(e.target.value as AccountRole)}>
                  {SELF_REGISTER_ROLES.map((accountRole) => (
                    <option key={accountRole} value={accountRole}>{roleLabel(accountRole)}</option>
                  ))}
                  </select>
                </div>
                {(role === 'VENDOR' || role === 'ORGANIZATION') ? (
                  <div className="eph-field">
                    <label htmlFor="eph-business">Business / organization name</label>
                    <input id="eph-business" className="eph-control" required minLength={2} value={businessName} onChange={e => setBusinessName(e.target.value)} />
                  </div>
                ) : (
                  <div className="eph-registration-note">
                    <strong>{roleLabel(role)} account</strong>
                    <span>{role === 'CLIENT'
                      ? 'No business details are required. Your account will open the event-planning workspace.'
                      : role === 'AFFILIATE'
                        ? 'Your account will open referral tools for sharing services and following referral activity.'
                        : role === 'VERIFIER'
                          ? 'Your account will open readiness tools for assigned service checks and event milestones.'
                          : 'Your account will open your event operations workspace.'}</span>
                  </div>
                )}
              </>
            )}

            {authMode === 'signup' && registrationStep === 2 && (
              <div className="eph-registration-review">
                <p className="eph-registration-review-kicker">Ready to join EPHINTA?</p>
                <h3>Review your account</h3>
                <dl>
                  <div><dt>Name</dt><dd>{name || '—'}</dd></div>
                  <div><dt>Email</dt><dd>{email || '—'}</dd></div>
                  <div><dt>Account type</dt><dd>{roleLabel(role)}</dd></div>
                  {(role === 'VENDOR' || role === 'ORGANIZATION') && <div><dt>Business</dt><dd>{businessName || '—'}</dd></div>}
                </dl>
                <p className="eph-registration-review-note">Your details will be used to create your EPHINTA account. You can complete additional profile and verification details after signing in.</p>
              </div>
            )}

            {authMode === 'signup' ? (
              <div className="eph-registration-navigation">
                <button type="button" className="eph-btn eph-btn-outline" onClick={() => registrationStep > 0 ? setRegistrationStep(step => Math.max(0, step - 1)) : setAuthMode(null)}>Back</button>
                {registrationStep < 2 ? (
                  <button type="button" className="eph-btn eph-btn-purple eph-planner-submit" onClick={event => {
                    const formElement = event.currentTarget.form;
                    if (formElement?.reportValidity()) setRegistrationStep(step => Math.min(2, step + 1));
                  }}>Next <span aria-hidden="true">→</span></button>
                ) : (
                  <button className="eph-btn eph-btn-purple eph-planner-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : 'Create account'}</button>
                )}
              </div>
            ) : (
              <button className="eph-btn eph-btn-purple eph-planner-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Send reset instructions'}</button>
            )}
          </form>

          <div className="eph-auth-switch">{authMode === 'signin' ? <>Forgot password? <button onClick={() => { setAuthMode('forgot'); setRegistrationStep(0); setPassword(''); setError(''); setNotice(''); }}>Reset it</button><br />New to EPHINTA? <button onClick={() => { setAuthMode('signup'); setRegistrationStep(0); setPassword(''); setError(''); setNotice(''); }}>Create an account</button></> : <>Already have an account? <button onClick={() => { setAuthMode('signin'); setRegistrationStep(0); setPassword(''); setError(''); setNotice(''); }}>Sign in</button></>}</div>

        </section>

      </div>}

    </div>

  );

}