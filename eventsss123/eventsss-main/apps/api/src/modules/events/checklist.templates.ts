import type { EventType } from "@prisma/client";

type Template = { title: string; daysBefore: number; tier?: "ESSENTIAL" | "RECOMMENDED" | "OPTIONAL" };

const COMMON: Template[] = [
  { title: "Define event goals, date and expected guest count", daysBefore: 120, tier: "ESSENTIAL" },
  { title: "Set total budget and split it into categories", daysBefore: 115, tier: "ESSENTIAL" },
  { title: "Shortlist and book venue", daysBefore: 100, tier: "ESSENTIAL" },
  { title: "Draft guest list", daysBefore: 90, tier: "ESSENTIAL" },
  { title: "Book key vendors (catering, decor, media)", daysBefore: 75, tier: "ESSENTIAL" },
  { title: "Design and send invitations with RSVP links", daysBefore: 45, tier: "RECOMMENDED" },
  { title: "Plan the programme / run-of-show", daysBefore: 30, tier: "ESSENTIAL" },
  { title: "Confirm all vendors and payments", daysBefore: 14, tier: "ESSENTIAL" },
  { title: "Follow up on pending RSVPs", daysBefore: 10, tier: "RECOMMENDED" },
  { title: "Finalise headcount and seating", daysBefore: 5, tier: "ESSENTIAL" },
  { title: "Day-before walkthrough and logistics check", daysBefore: 1, tier: "ESSENTIAL" },
  { title: "Assign verifiers by zone (stage, F&B, access, production…)", daysBefore: 7, tier: "ESSENTIAL" },
  { title: "Confirm T−6h verification window with all verifiers", daysBefore: 2, tier: "ESSENTIAL" },
  { title: "Target all-green readiness board by T−2h before start", daysBefore: 0, tier: "ESSENTIAL" },
  // Compendium governance phases (compressed into operational tasks)
  { title: "[Phase 1] Confirm OKRs, master budget and insurance/permits", daysBefore: 180, tier: "RECOMMENDED" },
  { title: "[Phase 2] Registration / guest tools live; AV and stream specs locked", daysBefore: 60, tier: "RECOMMENDED" },
  { title: "[Phase 3] Full rehearsal; safety walkthrough; staff briefing notes", daysBefore: 7, tier: "RECOMMENDED" },
  { title: "[Phase 4] Post-event: NPS survey, ledger reconcile, readiness snapshot archive", daysBefore: -3, tier: "OPTIONAL" },
  { title: "Send thank-you messages and collect feedback", daysBefore: -2, tier: "RECOMMENDED" },
];

const BY_TYPE: Record<EventType, Template[]> = {
  PERSONAL: [
    { title: "Choose attire and accessories", daysBefore: 60, tier: "OPTIONAL" },
    { title: "Order cake / special treats", daysBefore: 21, tier: "RECOMMENDED" },
    { title: "Book photographer or videographer", daysBefore: 70, tier: "RECOMMENDED" },
  ],
  CORPORATE: [
    { title: "Finalise agenda and speakers", daysBefore: 50, tier: "ESSENTIAL" },
    { title: "Arrange AV, projector and Wi-Fi", daysBefore: 20, tier: "ESSENTIAL" },
    { title: "Prepare name badges and delegate packs", daysBefore: 7, tier: "RECOMMENDED" },
  ],
  SOCIAL: [
    { title: "Plan food, drinks and entertainment", daysBefore: 40, tier: "ESSENTIAL" },
    { title: "Arrange music / DJ", daysBefore: 35, tier: "RECOMMENDED" },
  ],
  SPORTS: [
    { title: "Obtain permits and confirm the field or arena", daysBefore: 80, tier: "ESSENTIAL" },
    { title: "Arrange referees, first aid and medical cover", daysBefore: 30, tier: "ESSENTIAL" },
    { title: "Prepare teams, schedules and equipment", daysBefore: 14, tier: "ESSENTIAL" },
  ],
  CULTURAL: [
    { title: "Consult community elders or cultural leads on protocol", daysBefore: 80, tier: "ESSENTIAL" },
    { title: "Arrange traditional attire, food and performers", daysBefore: 40, tier: "RECOMMENDED" },
  ],
  RELIGIOUS: [
    { title: "Confirm officiant or religious leaders", daysBefore: 80, tier: "ESSENTIAL" },
    { title: "Prepare ceremony materials and seating arrangement", daysBefore: 14, tier: "ESSENTIAL" },
  ],
  POLITICAL: [
    { title: "Obtain permits and security clearance", daysBefore: 60, tier: "ESSENTIAL" },
    { title: "Arrange security, crowd control and media access", daysBefore: 21, tier: "ESSENTIAL" },
  ],
  ENTERTAINMENT: [
    { title: "Book talent and sign contracts", daysBefore: 90, tier: "ESSENTIAL" },
    { title: "Set up ticketing and access control", daysBefore: 45, tier: "ESSENTIAL" },
    { title: "Sound check and technical rehearsal", daysBefore: 2, tier: "ESSENTIAL" },
    { title: "Headliner changeover plan and power redundancy", daysBefore: 5, tier: "RECOMMENDED" },
    { title: "Crowd route and emergency egress brief", daysBefore: 3, tier: "ESSENTIAL" },
  ],
  EDUCATIONAL: [
    { title: "Prepare curriculum and materials", daysBefore: 40, tier: "ESSENTIAL" },
    { title: "Prepare certificates and attendance sheets", daysBefore: 10, tier: "RECOMMENDED" },
    { title: "Confirm exhibition / CME booths and medical post if required", daysBefore: 14, tier: "ESSENTIAL" },
    { title: "Tech check for hybrid or overflow rooms", daysBefore: 3, tier: "ESSENTIAL" },
  ],
  VIRTUAL: [
    { title: "Choose and configure the streaming platform", daysBefore: 45, tier: "ESSENTIAL" },
    { title: "Tech rehearsal with speakers", daysBefore: 3, tier: "ESSENTIAL" },
    { title: "Send join links and reminders", daysBefore: 1, tier: "ESSENTIAL" },
  ],
};

export function generateChecklist(type: EventType, startsAt?: Date | null) {
  return [...COMMON, ...BY_TYPE[type]]
    .sort((a, b) => b.daysBefore - a.daysBefore)
    .map((t, sortOrder) => ({
      title: t.title,
      tier: t.tier ?? "RECOMMENDED",
      sortOrder,
      dueAt: startsAt ? new Date(startsAt.getTime() - t.daysBefore * 86_400_000) : null,
    }));
}
