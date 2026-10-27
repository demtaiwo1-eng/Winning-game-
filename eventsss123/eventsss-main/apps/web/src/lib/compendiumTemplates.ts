/**
 * Full sector coverage for Global Event Case Studies Master Compendium 2026 (100 cases).
 * Templates pre-fill type, format, scale, special requests, KPIs → same ESS execution loop.
 */

export type CompendiumTemplate = {
  id: string;
  caseRef: string;
  title: string;
  sector: string;
  type: string;
  format: "IN_PERSON" | "HYBRID" | "VIRTUAL" | "ROADSHOW" | "INVITE_ONLY";
  scaleTier: "SMALL" | "MEDIUM" | "LARGE" | "MEGA";
  isVirtual: boolean;
  suggestedGuests: number;
  specialRequests: string;
  kpiTargets: string;
};

export const COMPENDIUM_TEMPLATES: CompendiumTemplate[] = [
  // Technology 1–10
  { id: "tech-hybrid", caseRef: "Cases 1,4,7,9", title: "Hybrid developer / SaaS summit", sector: "TECHNOLOGY", type: "CORPORATE", format: "HYBRID", scaleTier: "LARGE", isVirtual: true, suggestedGuests: 3500, specialRequests: "AI translation 6 languages; dual fiber; zero single-use plastics; 40+ breakout tracks.", kpiTargets: "Check-in ≥85%; pipeline opportunities; NPS ≥55." },
  { id: "tech-vip", caseRef: "Case 2", title: "VIP executive invite-only forum", sector: "TECHNOLOGY", type: "CORPORATE", format: "INVITE_ONLY", scaleTier: "MEDIUM", isVirtual: false, suggestedGuests: 200, specialRequests: "Chatham House rules; biometric check-in; private dining pairings; closed-loop security audit.", kpiTargets: "Executive retention ≥95%; pipeline influence tracked." },
  { id: "tech-security", caseRef: "Case 3", title: "Cybersecurity in-person conference", sector: "TECHNOLOGY", type: "CORPORATE", format: "IN_PERSON", scaleTier: "LARGE", isVirtual: false, suggestedGuests: 2000, specialRequests: "CTF arena; Faraday isolation pods; exhibitor compliance checks.", kpiTargets: "Session rating ≥90%; on-site renewals." },
  { id: "tech-roadshow", caseRef: "Case 5", title: "Multi-city product roadshow", sector: "TECHNOLOGY", type: "CORPORATE", format: "ROADSHOW", scaleTier: "MEDIUM", isVirtual: false, suggestedGuests: 400, specialRequests: "Parent series + city stops; allergen-isolated catering; modular booth logistics.", kpiTargets: "Regional sign-ups; trial conversion ≥30%." },
  { id: "tech-retreat", caseRef: "Case 6", title: "Founder immersive retreat", sector: "TECHNOLOGY", type: "CORPORATE", format: "IN_PERSON", scaleTier: "SMALL", isVirtual: false, suggestedGuests: 150, specialRequests: "Satellite Wi-Fi; wellness blocks; private networking experiences.", kpiTargets: "Collaboration score; JV agreements." },
  // Healthcare 11–21
  { id: "health-cme", caseRef: "Cases 11–21", title: "CME / clinical investigators meeting", sector: "HEALTHCARE", type: "EDUCATIONAL", format: "IN_PERSON", scaleTier: "MEDIUM", isVirtual: false, suggestedGuests: 1200, specialRequests: "CME/CEU logging; medical post; quiet rooms; compliance snapshot for audit.", kpiTargets: "100% protocol sign-off where required; CEU completeness; satisfaction ≥90%." },
  { id: "health-hybrid-expo", caseRef: "Case 12,18", title: "MedTech hybrid exhibition", sector: "HEALTHCARE", type: "EDUCATIONAL", format: "HYBRID", scaleTier: "LARGE", isVirtual: true, suggestedGuests: 3000, specialRequests: "Sterile demo zones; device trial tracking; high-bandwidth booths.", kpiTargets: "Device trials; procurement inquiries." },
  { id: "health-policy", caseRef: "Case 14", title: "Pharma regulatory policy forum", sector: "HEALTHCARE", type: "EDUCATIONAL", format: "HYBRID", scaleTier: "MEDIUM", isVirtual: true, suggestedGuests: 500, specialRequests: "Live video bridge; Q&A moderation queue; legal disclaimers.", kpiTargets: "Training completion; satisfaction on regulatory updates." },
  // Finance 22–32
  { id: "fin-pe", caseRef: "Case 22", title: "Private equity LP/GP summit", sector: "FINANCE", type: "CORPORATE", format: "INVITE_ONLY", scaleTier: "MEDIUM", isVirtual: false, suggestedGuests: 250, specialRequests: "Device lock-bags; deal rooms; Chatham House; matchmaking.", kpiTargets: "Matchmaking conversion ≥90%; capital discussions logged." },
  { id: "fin-wealth", caseRef: "Case 23", title: "Wealth management VIP retreat", sector: "FINANCE", type: "CORPORATE", format: "INVITE_ONLY", scaleTier: "SMALL", isVirtual: false, suggestedGuests: 120, specialRequests: "Security vetting; private hospitality suites; armored transport notes.", kpiTargets: "VIP satisfaction ≥98%; mandates initiated." },
  { id: "fin-pitch", caseRef: "Case 24", title: "VC pitch day + investor gala", sector: "FINANCE", type: "CORPORATE", format: "IN_PERSON", scaleTier: "MEDIUM", isVirtual: false, suggestedGuests: 400, specialRequests: "Pitch timers; deck screening; live investor voting channel.", kpiTargets: "Term sheets within 30 days; pitch completion." },
  { id: "fin-esg", caseRef: "Case 25", title: "Sustainable finance / ESG assembly", sector: "FINANCE", type: "CORPORATE", format: "HYBRID", scaleTier: "LARGE", isVirtual: true, suggestedGuests: 2100, specialRequests: "Carbon offset audit; vegan organic catering; STREAM zone.", kpiTargets: "Attendance; green announcements tracked." },
  // Entertainment 81–85
  { id: "ent-film", caseRef: "Case 81", title: "Film & streaming content market", sector: "ENTERTAINMENT", type: "ENTERTAINMENT", format: "IN_PERSON", scaleTier: "LARGE", isVirtual: false, suggestedGuests: 3500, specialRequests: "Screening rooms; VIP security; red carpet premiere.", kpiTargets: "Distribution deals; producer attendance." },
  { id: "ent-esports", caseRef: "Case 83", title: "Esports arena + global stream", sector: "ENTERTAINMENT", type: "ENTERTAINMENT", format: "HYBRID", scaleTier: "MEGA", isVirtual: true, suggestedGuests: 25000, specialRequests: "Fiber redundancy; player booths; STREAM must be green before broadcast.", kpiTargets: "On-time start; concurrent viewers; zero extended stream drop." },
  { id: "ent-creator", caseRef: "Case 84", title: "Creator economy festival", sector: "ENTERTAINMENT", type: "SOCIAL", format: "IN_PERSON", scaleTier: "LARGE", isVirtual: false, suggestedGuests: 4000, specialRequests: "Brand activations; podcast pods; live streaming setup.", kpiTargets: "Creator NPS; sponsor activations completed." },
  // Biotech 86–90
  { id: "bio-summit", caseRef: "Cases 86–90", title: "Biotech / genomics scientific forum", sector: "HEALTHCARE", type: "EDUCATIONAL", format: "HYBRID", scaleTier: "MEDIUM", isVirtual: true, suggestedGuests: 1100, specialRequests: "Abstract vetting; lab safety notes; translation; CME logging.", kpiTargets: "Partnerships formed; compliance 100%." },
  // Government 91–100
  { id: "gov-smartcity", caseRef: "Case 91", title: "Smart cities municipal summit", sector: "GOVERNMENT", type: "POLITICAL", format: "IN_PERSON", scaleTier: "LARGE", isVirtual: false, suggestedGuests: 3200, specialRequests: "Mayor protocol; exhibition zoning; pilot demo areas.", kpiTargets: "Pilot agreements; delegation attendance." },
  { id: "gov-defense", caseRef: "Case 93", title: "Defense & security strategy expo", sector: "GOVERNMENT", type: "POLITICAL", format: "INVITE_ONLY", scaleTier: "LARGE", isVirtual: false, suggestedGuests: 2000, specialRequests: "Clearances; classified briefing rooms; SECURITY zone mandatory.", kpiTargets: "100% security checklist green; zero incidents." },
  { id: "gov-diplomacy", caseRef: "Case 94", title: "Public diplomacy assembly", sector: "GOVERNMENT", type: "POLITICAL", format: "IN_PERSON", scaleTier: "MEDIUM", isVirtual: false, suggestedGuests: 600, specialRequests: "Protocol seating; translation booths; cultural reception notes.", kpiTargets: "Bilateral outcomes logged." },
  { id: "gov-govtech", caseRef: "Case 95", title: "E-government digital congress", sector: "GOVERNMENT", type: "CORPORATE", format: "HYBRID", scaleTier: "LARGE", isVirtual: true, suggestedGuests: 1800, specialRequests: "Cloud demos; security reviews; STREAM + PRODUCTION green.", kpiTargets: "CIO attendance; pilot software trials." },
  // Professional / other
  { id: "pro-consulting", caseRef: "Case 96", title: "Consulting partners retreat", sector: "OTHER", type: "CORPORATE", format: "IN_PERSON", scaleTier: "MEDIUM", isVirtual: false, suggestedGuests: 500, specialRequests: "Breakout facilitation; gala production; alignment workshops.", kpiTargets: "Strategic alignment 100%." },
  { id: "pro-cpe", caseRef: "Case 97", title: "Accounting CPE convention", sector: "OTHER", type: "EDUCATIONAL", format: "IN_PERSON", scaleTier: "LARGE", isVirtual: false, suggestedGuests: 2500, specialRequests: "QR attendance for CPE; exhibition; sandbox labs.", kpiTargets: "CPE hours delivered; scan completeness." },
  // Cultural / faith / sports / gala
  { id: "cultural-fest", caseRef: "Festival cases", title: "Cultural / state festival day", sector: "CULTURAL", type: "CULTURAL", format: "IN_PERSON", scaleTier: "MEGA", isVirtual: false, suggestedGuests: 35000, specialRequests: "Multi-zone verifiers; weather contingency; sponsor snapshot.", kpiTargets: "Opening on published minute; all-green by T−2h." },
  { id: "faith-hybrid", caseRef: "Faith cases", title: "Faith convention hybrid", sector: "RELIGIOUS", type: "RELIGIOUS", format: "HYBRID", scaleTier: "LARGE", isVirtual: true, suggestedGuests: 12000, specialRequests: "Overflow; translation; multi-currency escrow giving.", kpiTargets: "All-green before doors + stream." },
  { id: "sports-finals", caseRef: "Sports cases", title: "Sports finals weekend", sector: "SPORTS", type: "SPORTS", format: "IN_PERSON", scaleTier: "MEGA", isVirtual: false, suggestedGuests: 22000, specialRequests: "Medical villages; field conversion; ceremony + broadcast power.", kpiTargets: "On-time ceremonies; medical readiness green." },
  { id: "gala-ngo", caseRef: "NGO gala", title: "Fundraising gala dinner", sector: "NONPROFIT", type: "SOCIAL", format: "IN_PERSON", scaleTier: "MEDIUM", isVirtual: false, suggestedGuests: 600, specialRequests: "Appeal vs dinner timing; dual F&B + programme verifiers.", kpiTargets: "Funds raised; donor NPS." },
  { id: "virtual-global", caseRef: "Virtual cases", title: "Fully virtual global summit", sector: "TECHNOLOGY", type: "VIRTUAL", format: "VIRTUAL", scaleTier: "LARGE", isVirtual: true, suggestedGuests: 10000, specialRequests: "STREAM-only zones; remote verifiers; interpretation channels.", kpiTargets: "Join success; zero dark stream at go-live." },
];

export const SECTORS = [
  "TECHNOLOGY", "HEALTHCARE", "FINANCE", "ENERGY", "MANUFACTURING", "RETAIL",
  "EDUCATION", "LEGAL", "AEROSPACE", "GOVERNMENT", "ENTERTAINMENT", "CULTURAL",
  "RELIGIOUS", "NONPROFIT", "SPORTS", "OTHER",
] as const;
