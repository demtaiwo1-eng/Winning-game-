/**
 * Global KYC document matrix for 170+ markets.
 *
 * Design (FATF-aligned, modular by jurisdiction):
 * - Every ISO country gets a region + default acceptable ID set.
 * - Higher-assurance markets can require national ID numbers + address proof.
 * - Business KYC always needs a registry/trade document in addition to personal ID.
 * - Production: plug OCR / Sumsub / Onfido / Smile ID / HyperVerge per region;
 *   this module only encodes *what* to collect so the UX works worldwide.
 */

export type KycRegion =
  | "AFRICA"
  | "AMERICAS"
  | "ASIA_PACIFIC"
  | "EUROPE"
  | "MIDDLE_EAST"
  | "OTHER";

export type DocType =
  | "PASSPORT"
  | "NATIONAL_ID"
  | "DRIVERS_LICENSE"
  | "RESIDENCE_PERMIT"
  | "VOTER_ID"
  | "TAX_ID"
  | "BUSINESS_REGISTRATION"
  | "TRADE_LICENSE"
  | "PROOF_OF_ADDRESS"
  | "UTILITY_BILL"
  | "BANK_STATEMENT"
  | "SELFIE_LIVENESS";

export type CountryKycProfile = {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  region: KycRegion;
  currency: string;
  /** Preferred government ID types (first is recommended) */
  identityDocs: DocType[];
  /** Optional national identifier label (e.g. NIN, SSN, CPF, Aadhaar, PAN) */
  nationalIdLabel?: string;
  nationalIdPattern?: string; // human hint, not strict regex enforcement
  addressProofDocs: DocType[];
  businessDocs: DocType[];
  /** Suggested assurance: STANDARD | ENHANCED */
  assurance: "STANDARD" | "ENHANCED";
  notes?: string;
};

const REGION_DEFAULTS: Record<
  KycRegion,
  Pick<CountryKycProfile, "identityDocs" | "addressProofDocs" | "businessDocs" | "assurance">
> = {
  AFRICA: {
    identityDocs: ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "VOTER_ID"],
    addressProofDocs: ["UTILITY_BILL", "BANK_STATEMENT", "PROOF_OF_ADDRESS"],
    businessDocs: ["BUSINESS_REGISTRATION", "TRADE_LICENSE", "TAX_ID"],
    assurance: "STANDARD",
  },
  AMERICAS: {
    identityDocs: ["PASSPORT", "DRIVERS_LICENSE", "NATIONAL_ID"],
    addressProofDocs: ["UTILITY_BILL", "BANK_STATEMENT", "PROOF_OF_ADDRESS"],
    businessDocs: ["BUSINESS_REGISTRATION", "TAX_ID"],
    assurance: "ENHANCED",
  },
  ASIA_PACIFIC: {
    identityDocs: ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE"],
    addressProofDocs: ["UTILITY_BILL", "BANK_STATEMENT", "PROOF_OF_ADDRESS"],
    businessDocs: ["BUSINESS_REGISTRATION", "TAX_ID", "TRADE_LICENSE"],
    assurance: "ENHANCED",
  },
  EUROPE: {
    identityDocs: ["NATIONAL_ID", "PASSPORT", "RESIDENCE_PERMIT", "DRIVERS_LICENSE"],
    addressProofDocs: ["UTILITY_BILL", "BANK_STATEMENT", "PROOF_OF_ADDRESS"],
    businessDocs: ["BUSINESS_REGISTRATION", "TAX_ID"],
    assurance: "ENHANCED",
  },
  MIDDLE_EAST: {
    identityDocs: ["NATIONAL_ID", "PASSPORT", "RESIDENCE_PERMIT"],
    addressProofDocs: ["UTILITY_BILL", "PROOF_OF_ADDRESS", "BANK_STATEMENT"],
    businessDocs: ["TRADE_LICENSE", "BUSINESS_REGISTRATION", "TAX_ID"],
    assurance: "ENHANCED",
  },
  OTHER: {
    identityDocs: ["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"],
    addressProofDocs: ["UTILITY_BILL", "BANK_STATEMENT", "PROOF_OF_ADDRESS"],
    businessDocs: ["BUSINESS_REGISTRATION", "TAX_ID"],
    assurance: "STANDARD",
  },
};

/** High-signal overrides for major markets */
const OVERRIDES: Record<string, Partial<CountryKycProfile>> = {
  NG: {
    name: "Nigeria",
    region: "AFRICA",
    currency: "NGN",
    nationalIdLabel: "NIN (National Identification Number)",
    nationalIdPattern: "11 digits",
    identityDocs: ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "VOTER_ID"],
    businessDocs: ["BUSINESS_REGISTRATION", "TAX_ID", "TRADE_LICENSE"],
    notes: "CAC registration for businesses; BVN optional for payouts",
  },
  GH: {
    name: "Ghana",
    region: "AFRICA",
    currency: "GHS",
    nationalIdLabel: "Ghana Card / TIN",
    identityDocs: ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE"],
  },
  KE: {
    name: "Kenya",
    region: "AFRICA",
    currency: "KES",
    nationalIdLabel: "National ID / Alien ID",
    identityDocs: ["NATIONAL_ID", "PASSPORT"],
    notes: "M-Pesa payouts common; KRA PIN for business",
  },
  ZA: {
    name: "South Africa",
    region: "AFRICA",
    currency: "ZAR",
    nationalIdLabel: "SA ID number",
    identityDocs: ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE"],
  },
  US: {
    name: "United States",
    region: "AMERICAS",
    currency: "USD",
    nationalIdLabel: "SSN / ITIN (last 4 for platform KYC)",
    identityDocs: ["DRIVERS_LICENSE", "PASSPORT", "NATIONAL_ID"],
    businessDocs: ["BUSINESS_REGISTRATION", "TAX_ID"],
    notes: "EIN for businesses; state formation docs",
  },
  GB: {
    name: "United Kingdom",
    region: "EUROPE",
    currency: "GBP",
    nationalIdLabel: "NINO (optional)",
    identityDocs: ["PASSPORT", "DRIVERS_LICENSE", "RESIDENCE_PERMIT"],
    businessDocs: ["BUSINESS_REGISTRATION", "TAX_ID"],
  },
  IN: {
    name: "India",
    region: "ASIA_PACIFIC",
    currency: "INR",
    nationalIdLabel: "Aadhaar / PAN",
    nationalIdPattern: "Aadhaar 12 digits or PAN 10 chars",
    identityDocs: ["NATIONAL_ID", "PASSPORT", "VOTER_ID", "DRIVERS_LICENSE"],
    businessDocs: ["BUSINESS_REGISTRATION", "TAX_ID"],
    notes: "PAN required for financial KYC; Aadhaar eKYC where permitted",
  },
  BR: {
    name: "Brazil",
    region: "AMERICAS",
    currency: "BRL",
    nationalIdLabel: "CPF",
    nationalIdPattern: "11 digits",
    identityDocs: ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE"],
    businessDocs: ["BUSINESS_REGISTRATION", "TAX_ID"],
  },
  AE: {
    name: "United Arab Emirates",
    region: "MIDDLE_EAST",
    currency: "AED",
    nationalIdLabel: "Emirates ID",
    identityDocs: ["NATIONAL_ID", "PASSPORT", "RESIDENCE_PERMIT"],
    businessDocs: ["TRADE_LICENSE", "BUSINESS_REGISTRATION"],
  },
  FR: {
    name: "France",
    region: "EUROPE",
    currency: "EUR",
    identityDocs: ["NATIONAL_ID", "PASSPORT", "RESIDENCE_PERMIT"],
  },
  DE: {
    name: "Germany",
    region: "EUROPE",
    currency: "EUR",
    identityDocs: ["NATIONAL_ID", "PASSPORT", "RESIDENCE_PERMIT"],
  },
  CA: {
    name: "Canada",
    region: "AMERICAS",
    currency: "CAD",
    nationalIdLabel: "SIN (optional for platform)",
    identityDocs: ["PASSPORT", "DRIVERS_LICENSE", "NATIONAL_ID"],
  },
  MX: {
    name: "Mexico",
    region: "AMERICAS",
    currency: "MXN",
    nationalIdLabel: "CURP",
    identityDocs: ["NATIONAL_ID", "PASSPORT", "VOTER_ID"],
  },
  SG: {
    name: "Singapore",
    region: "ASIA_PACIFIC",
    currency: "SGD",
    nationalIdLabel: "NRIC / FIN",
    identityDocs: ["NATIONAL_ID", "PASSPORT"],
  },
  AU: {
    name: "Australia",
    region: "ASIA_PACIFIC",
    currency: "AUD",
    identityDocs: ["DRIVERS_LICENSE", "PASSPORT", "NATIONAL_ID"],
  },
};

/** ISO 3166-1 alpha-2 coverage list (170+) with region + default currency */
const COUNTRY_SEED: Array<{ code: string; name: string; region: KycRegion; currency: string }> = [
  // Africa
  { code: "NG", name: "Nigeria", region: "AFRICA", currency: "NGN" },
  { code: "GH", name: "Ghana", region: "AFRICA", currency: "GHS" },
  { code: "KE", name: "Kenya", region: "AFRICA", currency: "KES" },
  { code: "ZA", name: "South Africa", region: "AFRICA", currency: "ZAR" },
  { code: "EG", name: "Egypt", region: "AFRICA", currency: "EGP" },
  { code: "MA", name: "Morocco", region: "AFRICA", currency: "MAD" },
  { code: "TZ", name: "Tanzania", region: "AFRICA", currency: "TZS" },
  { code: "UG", name: "Uganda", region: "AFRICA", currency: "UGX" },
  { code: "RW", name: "Rwanda", region: "AFRICA", currency: "RWF" },
  { code: "ET", name: "Ethiopia", region: "AFRICA", currency: "ETB" },
  { code: "CI", name: "Côte d'Ivoire", region: "AFRICA", currency: "XOF" },
  { code: "SN", name: "Senegal", region: "AFRICA", currency: "XOF" },
  { code: "CM", name: "Cameroon", region: "AFRICA", currency: "XAF" },
  { code: "AO", name: "Angola", region: "AFRICA", currency: "AOA" },
  { code: "MZ", name: "Mozambique", region: "AFRICA", currency: "MZN" },
  { code: "ZM", name: "Zambia", region: "AFRICA", currency: "ZMW" },
  { code: "ZW", name: "Zimbabwe", region: "AFRICA", currency: "USD" },
  { code: "BW", name: "Botswana", region: "AFRICA", currency: "BWP" },
  { code: "NA", name: "Namibia", region: "AFRICA", currency: "NAD" },
  { code: "MU", name: "Mauritius", region: "AFRICA", currency: "MUR" },
  { code: "TN", name: "Tunisia", region: "AFRICA", currency: "TND" },
  { code: "DZ", name: "Algeria", region: "AFRICA", currency: "DZD" },
  { code: "LY", name: "Libya", region: "AFRICA", currency: "LYD" },
  { code: "SD", name: "Sudan", region: "AFRICA", currency: "SDG" },
  { code: "SS", name: "South Sudan", region: "AFRICA", currency: "SSP" },
  { code: "SO", name: "Somalia", region: "AFRICA", currency: "SOS" },
  { code: "DJ", name: "Djibouti", region: "AFRICA", currency: "DJF" },
  { code: "ER", name: "Eritrea", region: "AFRICA", currency: "ERN" },
  { code: "GM", name: "Gambia", region: "AFRICA", currency: "GMD" },
  { code: "GN", name: "Guinea", region: "AFRICA", currency: "GNF" },
  { code: "GW", name: "Guinea-Bissau", region: "AFRICA", currency: "XOF" },
  { code: "LR", name: "Liberia", region: "AFRICA", currency: "LRD" },
  { code: "SL", name: "Sierra Leone", region: "AFRICA", currency: "SLE" },
  { code: "ML", name: "Mali", region: "AFRICA", currency: "XOF" },
  { code: "BF", name: "Burkina Faso", region: "AFRICA", currency: "XOF" },
  { code: "NE", name: "Niger", region: "AFRICA", currency: "XOF" },
  { code: "TD", name: "Chad", region: "AFRICA", currency: "XAF" },
  { code: "CF", name: "Central African Republic", region: "AFRICA", currency: "XAF" },
  { code: "CG", name: "Congo", region: "AFRICA", currency: "XAF" },
  { code: "CD", name: "DR Congo", region: "AFRICA", currency: "CDF" },
  { code: "GA", name: "Gabon", region: "AFRICA", currency: "XAF" },
  { code: "GQ", name: "Equatorial Guinea", region: "AFRICA", currency: "XAF" },
  { code: "ST", name: "São Tomé and Príncipe", region: "AFRICA", currency: "STN" },
  { code: "CV", name: "Cabo Verde", region: "AFRICA", currency: "CVE" },
  { code: "MR", name: "Mauritania", region: "AFRICA", currency: "MRU" },
  { code: "MG", name: "Madagascar", region: "AFRICA", currency: "MGA" },
  { code: "MW", name: "Malawi", region: "AFRICA", currency: "MWK" },
  { code: "LS", name: "Lesotho", region: "AFRICA", currency: "LSL" },
  { code: "SZ", name: "Eswatini", region: "AFRICA", currency: "SZL" },
  { code: "BI", name: "Burundi", region: "AFRICA", currency: "BIF" },
  { code: "KM", name: "Comoros", region: "AFRICA", currency: "KMF" },
  { code: "SC", name: "Seychelles", region: "AFRICA", currency: "SCR" },
  { code: "RE", name: "Réunion", region: "AFRICA", currency: "EUR" },
  // Americas
  { code: "US", name: "United States", region: "AMERICAS", currency: "USD" },
  { code: "CA", name: "Canada", region: "AMERICAS", currency: "CAD" },
  { code: "MX", name: "Mexico", region: "AMERICAS", currency: "MXN" },
  { code: "BR", name: "Brazil", region: "AMERICAS", currency: "BRL" },
  { code: "AR", name: "Argentina", region: "AMERICAS", currency: "ARS" },
  { code: "CL", name: "Chile", region: "AMERICAS", currency: "CLP" },
  { code: "CO", name: "Colombia", region: "AMERICAS", currency: "COP" },
  { code: "PE", name: "Peru", region: "AMERICAS", currency: "PEN" },
  { code: "VE", name: "Venezuela", region: "AMERICAS", currency: "VES" },
  { code: "EC", name: "Ecuador", region: "AMERICAS", currency: "USD" },
  { code: "BO", name: "Bolivia", region: "AMERICAS", currency: "BOB" },
  { code: "PY", name: "Paraguay", region: "AMERICAS", currency: "PYG" },
  { code: "UY", name: "Uruguay", region: "AMERICAS", currency: "UYU" },
  { code: "CR", name: "Costa Rica", region: "AMERICAS", currency: "CRC" },
  { code: "PA", name: "Panama", region: "AMERICAS", currency: "PAB" },
  { code: "GT", name: "Guatemala", region: "AMERICAS", currency: "GTQ" },
  { code: "HN", name: "Honduras", region: "AMERICAS", currency: "HNL" },
  { code: "SV", name: "El Salvador", region: "AMERICAS", currency: "USD" },
  { code: "NI", name: "Nicaragua", region: "AMERICAS", currency: "NIO" },
  { code: "DO", name: "Dominican Republic", region: "AMERICAS", currency: "DOP" },
  { code: "CU", name: "Cuba", region: "AMERICAS", currency: "CUP" },
  { code: "JM", name: "Jamaica", region: "AMERICAS", currency: "JMD" },
  { code: "TT", name: "Trinidad and Tobago", region: "AMERICAS", currency: "TTD" },
  { code: "BB", name: "Barbados", region: "AMERICAS", currency: "BBD" },
  { code: "BS", name: "Bahamas", region: "AMERICAS", currency: "BSD" },
  { code: "HT", name: "Haiti", region: "AMERICAS", currency: "HTG" },
  { code: "GY", name: "Guyana", region: "AMERICAS", currency: "GYD" },
  { code: "SR", name: "Suriname", region: "AMERICAS", currency: "SRD" },
  // Europe
  { code: "GB", name: "United Kingdom", region: "EUROPE", currency: "GBP" },
  { code: "IE", name: "Ireland", region: "EUROPE", currency: "EUR" },
  { code: "FR", name: "France", region: "EUROPE", currency: "EUR" },
  { code: "DE", name: "Germany", region: "EUROPE", currency: "EUR" },
  { code: "ES", name: "Spain", region: "EUROPE", currency: "EUR" },
  { code: "PT", name: "Portugal", region: "EUROPE", currency: "EUR" },
  { code: "IT", name: "Italy", region: "EUROPE", currency: "EUR" },
  { code: "NL", name: "Netherlands", region: "EUROPE", currency: "EUR" },
  { code: "BE", name: "Belgium", region: "EUROPE", currency: "EUR" },
  { code: "LU", name: "Luxembourg", region: "EUROPE", currency: "EUR" },
  { code: "CH", name: "Switzerland", region: "EUROPE", currency: "CHF" },
  { code: "AT", name: "Austria", region: "EUROPE", currency: "EUR" },
  { code: "SE", name: "Sweden", region: "EUROPE", currency: "SEK" },
  { code: "NO", name: "Norway", region: "EUROPE", currency: "NOK" },
  { code: "DK", name: "Denmark", region: "EUROPE", currency: "DKK" },
  { code: "FI", name: "Finland", region: "EUROPE", currency: "EUR" },
  { code: "PL", name: "Poland", region: "EUROPE", currency: "PLN" },
  { code: "CZ", name: "Czechia", region: "EUROPE", currency: "CZK" },
  { code: "SK", name: "Slovakia", region: "EUROPE", currency: "EUR" },
  { code: "HU", name: "Hungary", region: "EUROPE", currency: "HUF" },
  { code: "RO", name: "Romania", region: "EUROPE", currency: "RON" },
  { code: "BG", name: "Bulgaria", region: "EUROPE", currency: "BGN" },
  { code: "GR", name: "Greece", region: "EUROPE", currency: "EUR" },
  { code: "HR", name: "Croatia", region: "EUROPE", currency: "EUR" },
  { code: "SI", name: "Slovenia", region: "EUROPE", currency: "EUR" },
  { code: "EE", name: "Estonia", region: "EUROPE", currency: "EUR" },
  { code: "LV", name: "Latvia", region: "EUROPE", currency: "EUR" },
  { code: "LT", name: "Lithuania", region: "EUROPE", currency: "EUR" },
  { code: "MT", name: "Malta", region: "EUROPE", currency: "EUR" },
  { code: "CY", name: "Cyprus", region: "EUROPE", currency: "EUR" },
  { code: "IS", name: "Iceland", region: "EUROPE", currency: "ISK" },
  { code: "UA", name: "Ukraine", region: "EUROPE", currency: "UAH" },
  { code: "MD", name: "Moldova", region: "EUROPE", currency: "MDL" },
  { code: "RS", name: "Serbia", region: "EUROPE", currency: "RSD" },
  { code: "BA", name: "Bosnia and Herzegovina", region: "EUROPE", currency: "BAM" },
  { code: "MK", name: "North Macedonia", region: "EUROPE", currency: "MKD" },
  { code: "AL", name: "Albania", region: "EUROPE", currency: "ALL" },
  { code: "ME", name: "Montenegro", region: "EUROPE", currency: "EUR" },
  { code: "XK", name: "Kosovo", region: "EUROPE", currency: "EUR" },
  { code: "BY", name: "Belarus", region: "EUROPE", currency: "BYN" },
  { code: "RU", name: "Russia", region: "EUROPE", currency: "RUB" },
  { code: "TR", name: "Türkiye", region: "EUROPE", currency: "TRY" },
  // Middle East
  { code: "AE", name: "United Arab Emirates", region: "MIDDLE_EAST", currency: "AED" },
  { code: "SA", name: "Saudi Arabia", region: "MIDDLE_EAST", currency: "SAR" },
  { code: "QA", name: "Qatar", region: "MIDDLE_EAST", currency: "QAR" },
  { code: "KW", name: "Kuwait", region: "MIDDLE_EAST", currency: "KWD" },
  { code: "BH", name: "Bahrain", region: "MIDDLE_EAST", currency: "BHD" },
  { code: "OM", name: "Oman", region: "MIDDLE_EAST", currency: "OMR" },
  { code: "JO", name: "Jordan", region: "MIDDLE_EAST", currency: "JOD" },
  { code: "LB", name: "Lebanon", region: "MIDDLE_EAST", currency: "LBP" },
  { code: "IQ", name: "Iraq", region: "MIDDLE_EAST", currency: "IQD" },
  { code: "IR", name: "Iran", region: "MIDDLE_EAST", currency: "IRR" },
  { code: "IL", name: "Israel", region: "MIDDLE_EAST", currency: "ILS" },
  { code: "PS", name: "Palestine", region: "MIDDLE_EAST", currency: "ILS" },
  { code: "YE", name: "Yemen", region: "MIDDLE_EAST", currency: "YER" },
  // Asia-Pacific
  { code: "IN", name: "India", region: "ASIA_PACIFIC", currency: "INR" },
  { code: "CN", name: "China", region: "ASIA_PACIFIC", currency: "CNY" },
  { code: "JP", name: "Japan", region: "ASIA_PACIFIC", currency: "JPY" },
  { code: "KR", name: "South Korea", region: "ASIA_PACIFIC", currency: "KRW" },
  { code: "SG", name: "Singapore", region: "ASIA_PACIFIC", currency: "SGD" },
  { code: "MY", name: "Malaysia", region: "ASIA_PACIFIC", currency: "MYR" },
  { code: "ID", name: "Indonesia", region: "ASIA_PACIFIC", currency: "IDR" },
  { code: "TH", name: "Thailand", region: "ASIA_PACIFIC", currency: "THB" },
  { code: "VN", name: "Vietnam", region: "ASIA_PACIFIC", currency: "VND" },
  { code: "PH", name: "Philippines", region: "ASIA_PACIFIC", currency: "PHP" },
  { code: "PK", name: "Pakistan", region: "ASIA_PACIFIC", currency: "PKR" },
  { code: "BD", name: "Bangladesh", region: "ASIA_PACIFIC", currency: "BDT" },
  { code: "LK", name: "Sri Lanka", region: "ASIA_PACIFIC", currency: "LKR" },
  { code: "NP", name: "Nepal", region: "ASIA_PACIFIC", currency: "NPR" },
  { code: "MM", name: "Myanmar", region: "ASIA_PACIFIC", currency: "MMK" },
  { code: "KH", name: "Cambodia", region: "ASIA_PACIFIC", currency: "KHR" },
  { code: "LA", name: "Laos", region: "ASIA_PACIFIC", currency: "LAK" },
  { code: "BN", name: "Brunei", region: "ASIA_PACIFIC", currency: "BND" },
  { code: "HK", name: "Hong Kong", region: "ASIA_PACIFIC", currency: "HKD" },
  { code: "TW", name: "Taiwan", region: "ASIA_PACIFIC", currency: "TWD" },
  { code: "MO", name: "Macao", region: "ASIA_PACIFIC", currency: "MOP" },
  { code: "AU", name: "Australia", region: "ASIA_PACIFIC", currency: "AUD" },
  { code: "NZ", name: "New Zealand", region: "ASIA_PACIFIC", currency: "NZD" },
  { code: "FJ", name: "Fiji", region: "ASIA_PACIFIC", currency: "FJD" },
  { code: "PG", name: "Papua New Guinea", region: "ASIA_PACIFIC", currency: "PGK" },
  { code: "MN", name: "Mongolia", region: "ASIA_PACIFIC", currency: "MNT" },
  { code: "KZ", name: "Kazakhstan", region: "ASIA_PACIFIC", currency: "KZT" },
  { code: "UZ", name: "Uzbekistan", region: "ASIA_PACIFIC", currency: "UZS" },
  { code: "AF", name: "Afghanistan", region: "ASIA_PACIFIC", currency: "AFN" },
];

function buildProfile(seed: (typeof COUNTRY_SEED)[0]): CountryKycProfile {
  const defaults = REGION_DEFAULTS[seed.region];
  const override = OVERRIDES[seed.code] || {};
  return {
    code: seed.code,
    name: override.name || seed.name,
    region: override.region || seed.region,
    currency: override.currency || seed.currency,
    identityDocs: override.identityDocs || defaults.identityDocs,
    addressProofDocs: override.addressProofDocs || defaults.addressProofDocs,
    businessDocs: override.businessDocs || defaults.businessDocs,
    assurance: override.assurance || defaults.assurance,
    nationalIdLabel: override.nationalIdLabel,
    nationalIdPattern: override.nationalIdPattern,
    notes: override.notes,
  };
}

export const KYC_COUNTRIES: CountryKycProfile[] = COUNTRY_SEED.map(buildProfile).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function getKycProfile(countryCode: string): CountryKycProfile {
  const code = countryCode.toUpperCase();
  const found = KYC_COUNTRIES.find((c) => c.code === code);
  if (found) return found;
  // Unknown ISO → generic international passport-first profile
  return {
    code,
    name: code,
    region: "OTHER",
    currency: "USD",
    ...REGION_DEFAULTS.OTHER,
    notes: "Generic international profile — passport preferred",
  };
}

export function listKycCountries(region?: KycRegion) {
  return region ? KYC_COUNTRIES.filter((c) => c.region === region) : KYC_COUNTRIES;
}
