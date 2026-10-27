const EVENT_TYPES = [
  "PERSONAL",
  "CORPORATE",
  "SOCIAL",
  "SPORTS",
  "CULTURAL",
  "RELIGIOUS",
  "POLITICAL",
  "ENTERTAINMENT",
  "EDUCATIONAL",
  "VIRTUAL",
] as const;

export type EventDraft = {
  title: string;
  type: (typeof EVENT_TYPES)[number];
  goal: string;
  date: string;
  city: string;
  guests: string;
  budget: string;
  atmosphere: string;
  food: string;
  venue: string;
  priorities: string;
  clientRequestId: string;
};

export type EventBuilderProgress = Omit<EventDraft, "clientRequestId">;

export type EventCreateInput = {
  title: string;
  type: EventDraft["type"];
  description: string;
  startsAt: string | null;
  city: string;
  country: string;
  currency: string;
  isPublic: false;
  expectedGuests: number;
  scaleTier: "SMALL" | "MEDIUM" | "LARGE" | "MEGA";
  isVirtual: boolean;
  format: "IN_PERSON" | "HYBRID" | "VIRTUAL";
  specialRequests: string;
  autoChecklist: true;
  clientRequestId: string;
};

const isString = (value: unknown): value is string => typeof value === "string";
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const isOneOf = <T extends readonly string[]>(value: string, options: T): value is T[number] =>
  options.includes(value);

const EVENT_GOALS = [
  "Celebrate",
  "Launch a product",
  "Build community",
  "Raise funds",
  "Train or educate",
  "Host an unforgettable guest experience",
] as const;
const EVENT_PRIORITIES = [
  "Guest experience",
  "Brand impression",
  "Budget control",
  "Speed and simplicity",
  "Accessibility and inclusion",
] as const;
const EVENT_ATMOSPHERES = [
  "Warm and social",
  "Premium and editorial",
  "High-energy and entertaining",
  "Calm and intimate",
  "Professional and focused",
] as const;
const EVENT_FOOD_OPTIONS = [
  "Mixed menu",
  "Local cuisine",
  "International menu",
  "Vegetarian or vegan focused",
  "Not sure yet",
] as const;
const EVENT_VENUE_OPTIONS = [
  "Still deciding",
  "Venue selected",
  "Private residence",
  "Outdoor or public space",
  "Virtual",
  "Hybrid",
] as const;

export function parseEventBuilderProgress(raw: string | null): EventBuilderProgress | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const progress = value as Record<string, unknown>;
    if (
      !isString(progress.title) ||
      !isString(progress.type) ||
      !isOneOf(progress.type, EVENT_TYPES) ||
      !isString(progress.goal) ||
      !isOneOf(progress.goal, EVENT_GOALS) ||
      !isString(progress.date) ||
      !isString(progress.city) ||
      !isString(progress.guests) ||
      !isString(progress.budget) ||
      !isString(progress.atmosphere) ||
      !isOneOf(progress.atmosphere, EVENT_ATMOSPHERES) ||
      !isString(progress.food) ||
      !isOneOf(progress.food, EVENT_FOOD_OPTIONS) ||
      !isString(progress.venue) ||
      !isOneOf(progress.venue, EVENT_VENUE_OPTIONS) ||
      !isString(progress.priorities) ||
      !isOneOf(progress.priorities, EVENT_PRIORITIES)
    ) {
      return null;
    }

    const answers: EventBuilderProgress = {
      title: progress.title,
      type: progress.type,
      goal: progress.goal,
      date: progress.date,
      city: progress.city,
      guests: progress.guests,
      budget: progress.budget,
      atmosphere: progress.atmosphere,
      food: progress.food,
      venue: progress.venue,
      priorities: progress.priorities,
    };
    if (
      answers.title.length > 160 ||
      (answers.date !== "" && !isDateOnly(answers.date)) ||
      answers.city.length > 120 ||
      (answers.guests !== "" &&
        (!/^\d+$/.test(answers.guests) ||
          !Number.isSafeInteger(Number(answers.guests)) ||
          Number(answers.guests) < 1 ||
          Number(answers.guests) > 5_000_000)) ||
      answers.budget.length > 9_000
    ) {
      return null;
    }
    return answers;
  } catch {
    return null;
  }
}

export function eventBuilderProgressFromLandingDraft(raw: string | null): EventBuilderProgress | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const draft = value as Record<string, unknown>;
    if (
      !isString(draft.type) ||
      !isString(draft.guests) ||
      !isString(draft.date) ||
      !isString(draft.vibe)
    ) {
      return null;
    }

    const eventTypes: Record<string, EventBuilderProgress["type"]> = {
      Wedding: "PERSONAL",
      Birthday: "PERSONAL",
      "Naming ceremony": "PERSONAL",
      "Corporate event": "CORPORATE",
      Graduation: "PERSONAL",
      Remembrance: "CULTURAL",
    };
    const atmospheres: Record<string, EventBuilderProgress["atmosphere"]> = {
      Modern: "Premium and editorial",
      Classic: "Professional and focused",
      Traditional: "Warm and social",
      Garden: "Calm and intimate",
      Luxury: "Premium and editorial",
      Intimate: "Calm and intimate",
    };
    const guests =
      /^\d+$/.test(draft.guests) &&
      Number.isSafeInteger(Number(draft.guests)) &&
      Number(draft.guests) >= 1 &&
      Number(draft.guests) <= 5_000_000
        ? draft.guests
        : "";
    const date = draft.date === "" || isDateOnly(draft.date) ? draft.date : "";
    const progress: EventBuilderProgress = {
      title: `${draft.type} celebration`.slice(0, 160),
      type: eventTypes[draft.type] ?? "SOCIAL",
      goal: "Celebrate",
      date,
      city: "",
      guests,
      budget: "",
      atmosphere: atmospheres[draft.vibe] ?? "Warm and social",
      food: "Mixed menu",
      venue: "Still deciding",
      priorities: "Guest experience",
    };
    return parseEventBuilderProgress(JSON.stringify(progress));
  } catch {
    return null;
  }
}

function isEventDraft(value: unknown): value is EventDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return (
    isString(draft.title) &&
    draft.title.trim().length >= 2 &&
    draft.title.length <= 160 &&
    isString(draft.type) &&
    EVENT_TYPES.includes(draft.type as EventDraft["type"]) &&
    isString(draft.goal) &&
    isString(draft.date) &&
    isString(draft.city) &&
    Boolean(draft.city.trim()) &&
    draft.city.length <= 120 &&
    isString(draft.guests) &&
    /^\d+$/.test(draft.guests) &&
    Number.isSafeInteger(Number(draft.guests)) &&
    Number(draft.guests) >= 1 &&
    Number(draft.guests) <= 5_000_000 &&
    isString(draft.budget) &&
    isString(draft.atmosphere) &&
    isString(draft.food) &&
    isString(draft.venue) &&
    isString(draft.priorities) &&
    draft.goal.length <= 5_000 &&
    draft.budget.length <= 9_000 &&
    isString(draft.clientRequestId) &&
    isUuid(draft.clientRequestId) &&
    (!draft.date || isDateOnly(draft.date))
  );
}

export function parseEventDraft(raw: string | null): EventDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isEventDraft(value) ? value : null;
  } catch {
    return null;
  }
}

export function eventDraftToCreateInput(
  draft: EventDraft,
  country: string,
  currency: string,
): EventCreateInput {
  const guestCount = Number(draft.guests);
  const scaleTier =
    guestCount < 200 ? "SMALL" : guestCount <= 2_000 ? "MEDIUM" : guestCount <= 15_000 ? "LARGE" : "MEGA";
  const format = draft.venue === "Virtual" ? "VIRTUAL" : draft.venue === "Hybrid" ? "HYBRID" : "IN_PERSON";
  const requests = [
    `Primary goal: ${draft.goal}`,
    `Planning priority: ${draft.priorities}`,
    `Budget direction: ${draft.budget || "To be planned"}`,
    `Atmosphere: ${draft.atmosphere}`,
    `Food direction: ${draft.food}`,
    `Venue status: ${draft.venue}`,
  ];

  return {
    title: draft.title.trim(),
    type: draft.type,
    description: `Event goal: ${draft.goal}`,
    startsAt: draft.date ? new Date(`${draft.date}T12:00:00.000Z`).toISOString() : null,
    city: draft.city.trim(),
    country: country.toUpperCase(),
    currency: currency.toUpperCase(),
    isPublic: false,
    expectedGuests: guestCount,
    scaleTier,
    isVirtual: format !== "IN_PERSON",
    format,
    specialRequests: requests.join("\n"),
    autoChecklist: true,
    clientRequestId: draft.clientRequestId,
  };
}
