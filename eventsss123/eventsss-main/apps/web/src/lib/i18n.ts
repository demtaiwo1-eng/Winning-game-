/**
 * Lightweight i18n + multi-currency foundation for ESS.
 * Expand dictionaries as locales are added. Defaults to en-NG.
 */

export type LocaleCode = "en" | "fr" | "es" | "pt" | "ar" | "sw";
export type CurrencyCode =
  | "NGN"
  | "USD"
  | "EUR"
  | "GBP"
  | "GHS"
  | "KES"
  | "ZAR"
  | "CAD"
  | "AED";

export const LOCALES: { code: LocaleCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "sw", label: "Swahili", native: "Kiswahili" },
];

export const CURRENCIES: {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number;
}[] = [
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", decimals: 2 },
  { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi", decimals: 2 },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", decimals: 2 },
  { code: "ZAR", symbol: "R", name: "South African Rand", decimals: 2 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2 },
];

export const COUNTRIES: { code: string; name: string; currency: CurrencyCode; locale: LocaleCode }[] = [
  { code: "NG", name: "Nigeria", currency: "NGN", locale: "en" },
  { code: "GH", name: "Ghana", currency: "GHS", locale: "en" },
  { code: "KE", name: "Kenya", currency: "KES", locale: "en" },
  { code: "ZA", name: "South Africa", currency: "ZAR", locale: "en" },
  { code: "US", name: "United States", currency: "USD", locale: "en" },
  { code: "GB", name: "United Kingdom", currency: "GBP", locale: "en" },
  { code: "CA", name: "Canada", currency: "CAD", locale: "en" },
  { code: "FR", name: "France", currency: "EUR", locale: "fr" },
  { code: "ES", name: "Spain", currency: "EUR", locale: "es" },
  { code: "PT", name: "Portugal", currency: "EUR", locale: "pt" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", locale: "ar" },
  { code: "TZ", name: "Tanzania", currency: "KES", locale: "sw" },
];

const dict: Record<LocaleCode, Record<string, string>> = {
  en: {
    "nav.signIn": "Sign in",
    "nav.getStarted": "Get started free",
    "auth.create": "Create your workspace",
    "auth.signIn": "Sign in",
    "auth.reset": "Reset your password",
    "wallet.title": "Wallet & escrow",
    "wallet.available": "Available balance",
    "wallet.held": "In escrow",
    "wallet.pending": "Pending release",
    "marketplace.title": "Marketplace",
    "marketplace.search": "Search venues, caterers, creatives…",
    "empty.events": "No events yet",
    "empty.listings": "No listings yet",
    "empty.jobs": "No delivery jobs",
    "cta.createEvent": "Create first event",
    "cta.addListing": "Add your first listing",
  },
  fr: {
    "nav.signIn": "Connexion",
    "nav.getStarted": "Commencer gratuitement",
    "auth.create": "Créer votre espace",
    "auth.signIn": "Connexion",
    "auth.reset": "Réinitialiser le mot de passe",
    "wallet.title": "Portefeuille et séquestre",
    "wallet.available": "Solde disponible",
    "wallet.held": "En séquestre",
    "wallet.pending": "En attente de libération",
    "marketplace.title": "Marketplace",
    "marketplace.search": "Rechercher lieux, traiteurs…",
    "empty.events": "Aucun événement",
    "empty.listings": "Aucune annonce",
    "empty.jobs": "Aucune livraison",
    "cta.createEvent": "Créer un événement",
    "cta.addListing": "Ajouter une annonce",
  },
  es: {
    "nav.signIn": "Iniciar sesión",
    "nav.getStarted": "Empezar gratis",
    "auth.create": "Crear tu espacio",
    "auth.signIn": "Iniciar sesión",
    "auth.reset": "Restablecer contraseña",
    "wallet.title": "Cartera y depósito",
    "wallet.available": "Saldo disponible",
    "wallet.held": "En depósito",
    "wallet.pending": "Pendiente de liberación",
    "marketplace.title": "Marketplace",
    "marketplace.search": "Buscar venues, catering…",
    "empty.events": "Sin eventos aún",
    "empty.listings": "Sin anuncios aún",
    "empty.jobs": "Sin trabajos de entrega",
    "cta.createEvent": "Crear primer evento",
    "cta.addListing": "Añadir primer anuncio",
  },
  pt: {
    "nav.signIn": "Entrar",
    "nav.getStarted": "Começar grátis",
    "auth.create": "Criar seu espaço",
    "auth.signIn": "Entrar",
    "auth.reset": "Redefinir senha",
    "wallet.title": "Carteira e escrow",
    "wallet.available": "Saldo disponível",
    "wallet.held": "Em escrow",
    "wallet.pending": "Aguardando liberação",
    "marketplace.title": "Marketplace",
    "marketplace.search": "Buscar locais, buffet…",
    "empty.events": "Nenhum evento ainda",
    "empty.listings": "Nenhum anúncio",
    "empty.jobs": "Nenhuma entrega",
    "cta.createEvent": "Criar primeiro evento",
    "cta.addListing": "Adicionar anúncio",
  },
  ar: {
    "nav.signIn": "تسجيل الدخول",
    "nav.getStarted": "ابدأ مجانًا",
    "auth.create": "إنشاء مساحة العمل",
    "auth.signIn": "تسجيل الدخول",
    "auth.reset": "إعادة تعيين كلمة المرور",
    "wallet.title": "المحفظة والضمان",
    "wallet.available": "الرصيد المتاح",
    "wallet.held": "في الضمان",
    "wallet.pending": "في انتظار الإفراج",
    "marketplace.title": "السوق",
    "marketplace.search": "ابحث عن أماكن وموردين…",
    "empty.events": "لا توجد فعاليات بعد",
    "empty.listings": "لا توجد قوائم",
    "empty.jobs": "لا توجد توصيلات",
    "cta.createEvent": "إنشاء أول فعالية",
    "cta.addListing": "إضافة أول قائمة",
  },
  sw: {
    "nav.signIn": "Ingia",
    "nav.getStarted": "Anza bure",
    "auth.create": "Unda nafasi yako",
    "auth.signIn": "Ingia",
    "auth.reset": "Weka upya nenosiri",
    "wallet.title": "Pochi na escrow",
    "wallet.available": "Salio linalopatikana",
    "wallet.held": "Katika escrow",
    "wallet.pending": "Inasubiri kutolewa",
    "marketplace.title": "Soko",
    "marketplace.search": "Tafuta mahali, chakula…",
    "empty.events": "Hakuna matukio bado",
    "empty.listings": "Hakuna orodha",
    "empty.jobs": "Hakuna kazi za uwasilishaji",
    "cta.createEvent": "Unda tukio la kwanza",
    "cta.addListing": "Ongeza orodha ya kwanza",
  },
};

export function t(locale: LocaleCode, key: string): string {
  return dict[locale]?.[key] ?? dict.en[key] ?? key;
}

/** Format minor-unit amount (string or number) for display */
export function formatMoney(
  minor: string | number | bigint,
  currency: CurrencyCode,
  locale: LocaleCode = "en",
): string {
  const meta = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
  const n =
    typeof minor === "bigint"
      ? Number(minor)
      : typeof minor === "string"
        ? Number(minor)
        : minor;
  const major = n / Math.pow(10, meta.decimals);
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar" : "en", {
      style: "currency",
      currency: meta.code,
      maximumFractionDigits: meta.decimals,
    }).format(major);
  } catch {
    return `${meta.symbol}${major.toFixed(meta.decimals)}`;
  }
}

export function passwordStrength(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
} {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Too weak", "Weak", "Fair", "Strong", "Excellent"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#059669"];
  return { score: clamped, label: labels[clamped], color: colors[clamped] };
}
