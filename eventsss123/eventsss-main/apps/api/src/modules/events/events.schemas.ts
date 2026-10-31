import { EventStatus, EventType, RsvpStatus, TaskStatus } from "@prisma/client";
import { z } from "zod/v3";

const eventBase = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.nativeEnum(EventType),
  description: z.string().trim().max(5000).nullable(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
  venueId: z.string().uuid().nullable(),
  country: z.string().length(2).toUpperCase().nullable(),
  city: z.string().trim().max(120).nullable(),
  currency: z.string().length(3).toUpperCase(),
  isPublic: z.boolean(),
  expectedGuests: z.number().int().positive().max(5_000_000).nullable(),
  scaleTier: z.enum(["SMALL", "MEDIUM", "LARGE", "MEGA"]).optional().default("MEDIUM"),
  isVirtual: z.boolean().optional().default(false),
  parentEventId: z.string().uuid().nullable().optional(),
  budgetMinor: z.union([z.string(), z.number()]).optional().nullable(),
  sector: z.string().trim().max(80).nullable().optional(),
  format: z.enum(["IN_PERSON", "HYBRID", "VIRTUAL", "ROADSHOW", "INVITE_ONLY"]).optional().default("IN_PERSON"),
  specialRequests: z.string().trim().max(10000).nullable().optional(),
  kpiTargets: z.string().trim().max(5000).nullable().optional(),
});

type DateFields = { startsAt?: Date | null; endsAt?: Date | null };
const datesOk = (v: DateFields) => !(v.startsAt && v.endsAt) || v.endsAt >= v.startsAt;
const datesMsg = { path: ["endsAt"], message: "endsAt must not be before startsAt" };

export const createEventSchema = eventBase
  .partial()
  .required({ title: true })
  .extend({
    autoChecklist: z.boolean().default(true),
    clientRequestId: z.string().uuid().optional(),
  })
  .refine(datesOk, datesMsg);

export const updateEventSchema = eventBase
  .partial()
  .extend({ status: z.nativeEnum(EventStatus).optional() })
  .refine(datesOk, datesMsg);

export const planAnswersSchema = z.object({
  answers: z.object({
    desiredOutcome: z.string().trim().max(2000).optional(),
    audienceNeeds: z.string().trim().max(2000).optional(),
    accessibility: z.string().trim().max(2000).optional(),
    dietaryNeeds: z.string().trim().max(2000).optional(),
    programDetails: z.string().trim().max(2000).optional(),
    safetyAndPermits: z.string().trim().max(2000).optional(),
    successMeasures: z.string().trim().max(2000).optional(),
  }).strict(),
});

export const listEventsQuery = z.object({
  status: z.nativeEnum(EventStatus).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---- guests
const guestBase = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().toLowerCase().nullable(),
  phone: z.string().trim().min(7).max(20).nullable(),
  plusOnes: z.number().int().min(0).max(10),
});
export const guestCreateSchema = guestBase.partial().required({ name: true });
export const guestBulkSchema = z.object({ guests: z.array(guestCreateSchema).min(1).max(500) });
export const guestUpdateSchema = guestBase.partial().extend({ rsvp: z.nativeEnum(RsvpStatus).optional() });
export const guestCheckInSchema = z.object({
  guestId: z.string().uuid().optional(),
  token: z.string().uuid().optional(),
  method: z.enum(["MANUAL", "NFC", "BLUETOOTH"]).default("MANUAL"),
}).refine((value) => Boolean(value.guestId) !== Boolean(value.token), {
  message: "Provide exactly one of guestId or token",
});
export const listGuestsQuery = z.object({
  rsvp: z.nativeEnum(RsvpStatus).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const rsvpRespondSchema = z.object({
  rsvp: z.enum(["ACCEPTED", "DECLINED", "MAYBE"]),
  plusOnes: z.number().int().min(0).max(10).optional(),
});

// ---- tasks
export const taskCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  dueAt: z.coerce.date().nullable().optional(),
});
export const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
});

// ---- budget (money is minor units, sent as digit string or integer)
const minor = z
  .union([z.string().regex(/^\d{1,15}$/), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)])
  .transform((v) => BigInt(v));
const budgetBase = z.object({
  label: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).nullable(),
  plannedMinor: minor,
  actualMinor: minor,
});
export const budgetCreateSchema = budgetBase.partial().required({ label: true });
export const budgetUpdateSchema = budgetBase.partial();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
