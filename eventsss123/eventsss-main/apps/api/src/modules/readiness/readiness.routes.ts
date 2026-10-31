/**
 * Pre-event readiness (Verifier niche)
 * - Window opens: startsAt − 6 hours
 * - Hard deadline: all service checks GREEN by startsAt − 2 hours
 * - Customer sees traffic-light board + countdown
 */
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { createNotification, pushToUser } from "../notifications/notifications.service";
import { assertEventFinalizationAllowed } from "../payments/escrowPolicy";
import { canAssignReadinessVerifier, canManageReadinessZones, canReadReadinessEvent } from "./accessPolicy";

export const readinessRouter = Router();

const WINDOW_HOURS = 6;
const GREEN_DEADLINE_HOURS = 2;

/** Express route params are typed as string | undefined under noUncheckedIndexedAccess.
 * These params are required by the route definitions, so validate them once at runtime.
 */
function requiredParam(value: string | undefined, name: string): string {
  if (!value) throw new HttpError(400, "VALIDATION_ERROR", `${name} is required`);
  return value;
}


/** Event data is visible to its owner, operational admins/consultants, and assigned verifiers only. */
async function assertEventReadAccess(eventId: string, userId: string, role: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new HttpError(404, "NOT_FOUND", "Event not found");
  const assignment = role === "VERIFIER"
    ? await prisma.eventVerifierAssignment.findFirst({
        where: { eventId, verifierId: userId },
        select: { id: true },
      })
    : null;
  if (!canReadReadinessEvent({
    ownerId: event.ownerId,
    userId,
    role,
    assignedVerifier: Boolean(assignment),
  })) {
    throw new HttpError(403, "FORBIDDEN", "Not allowed");
  }
  return event;
}

function computeWindows(startsAt: Date | null | undefined) {
  if (!startsAt) {
    return { windowOpensAt: null as Date | null, greenDeadlineAt: null as Date | null, startsAt: null as Date | null };
  }
  const start = new Date(startsAt);
  const windowOpensAt = new Date(start.getTime() - WINDOW_HOURS * 60 * 60 * 1000);
  const greenDeadlineAt = new Date(start.getTime() - GREEN_DEADLINE_HOURS * 60 * 60 * 1000);
  return { windowOpensAt, greenDeadlineAt, startsAt: start };
}

function aggregateStatus(counts: {
  total: number;
  green: number;
  amber: number;
  red: number;
  pending: number;
}): "NOT_STARTED" | "IN_PROGRESS" | "ALL_GREEN" | "AT_RISK" | "BLOCKED" {
  if (counts.total === 0) return "NOT_STARTED";
  if (counts.red > 0) return "BLOCKED";
  if (counts.green === counts.total) return "ALL_GREEN";
  if (counts.pending > 0 || counts.amber > 0) return "IN_PROGRESS";
  return "AT_RISK";
}

async function refreshReadiness(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new HttpError(404, "NOT_FOUND", "Event not found");

  const checks = await prisma.eventServiceCheck.findMany({ where: { eventId } });
  const counts = {
    total: checks.length,
    green: checks.filter((c) => c.status === "GREEN").length,
    amber: checks.filter((c) => c.status === "AMBER").length,
    red: checks.filter((c) => c.status === "RED").length,
    pending: checks.filter((c) => c.status === "PENDING").length,
  };
  const windows = computeWindows(event.startsAt);
  const status = aggregateStatus(counts);

  const readiness = await prisma.eventReadiness.upsert({
    where: { eventId },
    create: {
      eventId,
      status: status as never,
      totalChecks: counts.total,
      greenCount: counts.green,
      amberCount: counts.amber,
      redCount: counts.red,
      pendingCount: counts.pending,
      windowOpensAt: windows.windowOpensAt,
      greenDeadlineAt: windows.greenDeadlineAt,
      startsAt: windows.startsAt,
      lastReviewedAt: new Date(),
    },
    update: {
      status: status as never,
      totalChecks: counts.total,
      greenCount: counts.green,
      amberCount: counts.amber,
      redCount: counts.red,
      pendingCount: counts.pending,
      windowOpensAt: windows.windowOpensAt,
      greenDeadlineAt: windows.greenDeadlineAt,
      startsAt: windows.startsAt,
      lastReviewedAt: new Date(),
    },
  });

  return { readiness, checks, event, windows };
}

/** Build checks from paid bookings on the event */
readinessRouter.post(
  "/events/:eventId/sync",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = requiredParam(req.params.eventId, "eventId");
    const event = await assertEventReadAccess(eventId, req.user!.id, req.user!.role);
    if (event?.status === "COMPLETED") {
      throw new HttpError(409, "EVENT_COMPLETED", "Readiness cannot change after event completion");
    }

    const bookings = await prisma.booking.findMany({
      where: {
        eventId,
        status: { in: ["PAID", "CONFIRMED", "FULFILLED"] },
      },
      include: {
        items: { include: { listing: true } },
        vendor: true,
      },
    });

    for (const b of bookings) {
      for (const item of b.items) {
        const existing = await prisma.eventServiceCheck.findFirst({
          where: { eventId, bookingId: b.id, listingId: item.listingId },
        });
        if (!existing) {
          await prisma.eventServiceCheck.create({
            data: {
              eventId,
              bookingId: b.id,
              listingId: item.listingId,
              label: item.listing.title,
              category: item.listing.type,
              status: "PENDING",
            },
          });
        }
      }
      if (b.items.length === 0) {
        const existing = await prisma.eventServiceCheck.findFirst({
          where: { eventId, bookingId: b.id, listingId: null },
        });
        if (!existing) {
          await prisma.eventServiceCheck.create({
            data: {
              eventId,
              bookingId: b.id,
              label: `${b.vendor.businessName} booking`,
              category: "SERVICE",
              status: "PENDING",
            },
          });
        }
      }
    }

    // Optional manual checklist items from body
    const extras = Array.isArray(req.body?.extraLabels) ? req.body.extraLabels : [];
    for (const label of extras) {
      if (typeof label !== "string" || !label.trim()) continue;
      await prisma.eventServiceCheck.create({
        data: { eventId, label: label.trim(), category: "CUSTOM", status: "PENDING" },
      });
    }

    const result = await refreshReadiness(eventId);
    res.json({
      readiness: serializeReadiness(result.readiness),
      checks: result.checks,
      rule: {
        windowOpensHoursBefore: WINDOW_HOURS,
        allGreenHoursBefore: GREEN_DEADLINE_HOURS,
        description:
          "Verifier may confirm services from 6 hours before start. All items must be GREEN at least 2 hours before start.",
      },
    });
  }),
);

function serializeReadiness(r: {
  id: string;
  eventId: string;
  status: string;
  totalChecks: number;
  greenCount: number;
  amberCount: number;
  redCount: number;
  pendingCount: number;
  windowOpensAt: Date | null;
  greenDeadlineAt: Date | null;
  startsAt: Date | null;
  assignedVerifierId: string | null;
  lastReviewedAt: Date | null;
}) {
  const now = Date.now();
  const starts = r.startsAt ? r.startsAt.getTime() : null;
  const windowOpens = r.windowOpensAt ? r.windowOpensAt.getTime() : null;
  const deadline = r.greenDeadlineAt ? r.greenDeadlineAt.getTime() : null;
  return {
    ...r,
    windowOpen: windowOpens != null ? now >= windowOpens : false,
    pastGreenDeadline: deadline != null ? now >= deadline : false,
    msToStart: starts != null ? Math.max(0, starts - now) : null,
    msToWindowOpen: windowOpens != null ? Math.max(0, windowOpens - now) : null,
    msToGreenDeadline: deadline != null ? Math.max(0, deadline - now) : null,
    allGreen: r.totalChecks > 0 && r.greenCount === r.totalChecks,
  };
}

/** Client or verifier: full readiness board for one event */
readinessRouter.get(
  "/events/:eventId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = requiredParam(req.params.eventId, "eventId");
    const event = await assertEventReadAccess(eventId, req.user!.id, req.user!.role);

    let readiness = await prisma.eventReadiness.findUnique({ where: { eventId: event.id } });
    if (!readiness) {
      const refreshed = await refreshReadiness(event.id);
      readiness = refreshed.readiness;
    } else {
      // keep windows in sync with event.startsAt
      await refreshReadiness(event.id);
      readiness = await prisma.eventReadiness.findUniqueOrThrow({ where: { eventId: event.id } });
    }
    const checks = await prisma.eventServiceCheck.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      event: {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
        city: event.city,
        country: event.country,
      },
      readiness: serializeReadiness(readiness),
      checks,
      canFinalize:
        req.user!.role === "VERIFIER" &&
        readiness.assignedVerifierId === req.user!.id,
      rule: {
        windowOpensHoursBefore: WINDOW_HOURS,
        allGreenHoursBefore: GREEN_DEADLINE_HOURS,
      },
    });
  }),
);

/** Verifier queue: upcoming events needing checks */
readinessRouter.get(
  "/queue",
  requireAuth,
  requireRole("VERIFIER", "CONSULTANT", "ADMIN"),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const events = await prisma.event.findMany({
      where: {
        OR: [
          {
            status: { in: ["PLANNING", "LIVE", "DRAFT"] },
            OR: [
              { startsAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), lte: horizon } },
              { endsAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), lte: horizon } },
            ],
          },
          {
            status: "COMPLETED",
            bookings: { some: { status: { in: ["PAID", "CONFIRMED"] } } },
          },
        ],
      },
      orderBy: { startsAt: "asc" },
      take: 40,
      include: {
        readiness: true,
        owner: { select: { id: true, name: true, email: true } },
        bookings: {
          where: { status: { in: ["PAID", "CONFIRMED"] } },
          select: { id: true },
        },
      },
    });

    res.json({
      items: events.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        status: e.status,
        city: e.city,
        country: e.country,
        owner: e.owner,
        bookingCount: e.bookings.length,
        readiness: e.readiness ? serializeReadiness(e.readiness) : null,
      })),
      rule: {
        windowOpensHoursBefore: WINDOW_HOURS,
        allGreenHoursBefore: GREEN_DEADLINE_HOURS,
      },
    });
  }),
);

/** Assign self as verifier */
readinessRouter.post(
  "/events/:eventId/claim",
  requireAuth,
  requireRole("VERIFIER", "CONSULTANT", "ADMIN"),
  asyncHandler(async (req, res) => {
    const eventId = requiredParam(req.params.eventId, "eventId");
    await refreshReadiness(eventId);
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { status: true } });
    if (event?.status === "COMPLETED") {
      throw new HttpError(409, "EVENT_COMPLETED", "Lead verifier assignment cannot change after event completion");
    }
    const current = await prisma.eventReadiness.findUnique({ where: { eventId } });
    if (current?.assignedVerifierId && current.assignedVerifierId !== req.user!.id) {
      throw new HttpError(403, "FORBIDDEN", "Only the selected lead verifier may claim this event");
    }
    const leadAssignment = await prisma.eventVerifierAssignment.findFirst({
      where: { eventId, verifierId: req.user!.id, isLead: true },
    });
    if (!leadAssignment) {
      throw new HttpError(403, "FORBIDDEN", "The event owner must select you as lead verifier first");
    }
    const readiness = await prisma.eventReadiness.update({
      where: { eventId },
      data: { assignedVerifierId: req.user!.id },
    });
    res.json({ readiness: serializeReadiness(readiness) });
  }),
);

/** Set check status GREEN | AMBER | RED */
readinessRouter.patch(
  "/checks/:checkId",
  requireAuth,
  requireRole("VERIFIER", "CONSULTANT", "ADMIN"),
  asyncHandler(async (req, res) => {
    const checkId = requiredParam(req.params.checkId, "checkId");
    const status = String(req.body.status || "").toUpperCase();
    if (!["GREEN", "AMBER", "RED", "PENDING"].includes(status)) {
      throw new HttpError(400, "INVALID_STATUS", "status must be GREEN, AMBER, RED, or PENDING");
    }
    const check = await prisma.eventServiceCheck.findUnique({ where: { id: checkId } });
    if (!check) throw new HttpError(404, "NOT_FOUND", "Check not found");

    const event = await prisma.event.findUnique({ where: { id: check.eventId } });
    if (event?.status === "COMPLETED") {
      throw new HttpError(409, "EVENT_COMPLETED", "Readiness checks cannot change after event completion");
    }
    if (req.user!.role === "VERIFIER") {
      const assigned = await prisma.eventVerifierAssignment.findFirst({
        where: { eventId: check.eventId, verifierId: req.user!.id },
        select: { id: true },
      });
      const readiness = await prisma.eventReadiness.findUnique({
        where: { eventId: check.eventId },
        select: { assignedVerifierId: true },
      });
      if (!assigned && readiness?.assignedVerifierId !== req.user!.id) {
        throw new HttpError(403, "FORBIDDEN", "Only a verifier assigned to this event may update its checks");
      }
    }
    const windows = computeWindows(event?.startsAt);
    const now = Date.now();
    // Product rule: GREEN only allowed once the T-6h window is open (or event has no startsAt yet)
    if (
      status === "GREEN" &&
      windows.windowOpensAt &&
      now < windows.windowOpensAt.getTime()
    ) {
      throw new HttpError(
        400,
        "WINDOW_CLOSED",
        `GREEN confirmation opens 6 hours before start (window opens at ${windows.windowOpensAt.toISOString()}). Use AMBER for early notes.`,
      );
    }

    const updated = await prisma.eventServiceCheck.update({
      where: { id: check.id },
      data: {
        status: status as never,
        notes: typeof req.body.notes === "string" ? req.body.notes.slice(0, 500) : check.notes,
        verifiedById: req.user!.id,
        checkedAt: new Date(),
      },
    });

    const result = await refreshReadiness(check.eventId);

    // Notify customer on status changes
    if (event) {
      const board = serializeReadiness(result.readiness);
      if (board.allGreen) {
        await createNotification({
          userId: event.ownerId,
          type: "READINESS_ALL_GREEN",
          title: "All services confirmed",
          body: `Verifier confirmed every booked service for “${event.title}”. You are green at least ${GREEN_DEADLINE_HOURS}h before start when deadline is met.`,
        });
      } else if (status === "RED") {
        await createNotification({
          userId: event.ownerId,
          type: "READINESS_BLOCKED",
          title: "Service needs attention",
          body: `“${updated.label}” was marked RED. Contact support or your verifier before the event.`,
        });
      }
      if (board.pastGreenDeadline && !board.allGreen) {
        await createNotification({
          userId: event.ownerId,
          type: "READINESS_DEADLINE",
          title: "Past 2-hour green deadline",
          body: `Not all services are green for “${event.title}”. Resolve remaining items before start.`,
        });
      }
    }

    res.json({
      check: updated,
      readiness: serializeReadiness(result.readiness),
    });
  }),
);

/** Assigned lead verifier confirms the event ended; paid bookings remain escrowed until released. */
readinessRouter.post(
  "/events/:eventId/finalize",
  requireAuth,
  requireRole("VERIFIER"),
  asyncHandler(async (req, res) => {
    const eventId = requiredParam(req.params.eventId, "eventId");
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: {
          readiness: { select: { assignedVerifierId: true } },
          serviceChecks: { select: { status: true, bookingId: true, listingId: true } },
        },
      });
      if (!event) throw new HttpError(404, "NOT_FOUND", "Event not found");
      const unpaidBookings = await tx.booking.findMany({
        where: { eventId, status: { in: ["PAID", "CONFIRMED"] } },
        include: { items: { select: { listingId: true } } },
      });
      const missingChecks = unpaidBookings.some((booking) =>
        booking.items.length
          ? booking.items.some((item) =>
              !event.serviceChecks.some(
                (check) => check.bookingId === booking.id && check.listingId === item.listingId,
              ),
            )
          : !event.serviceChecks.some((check) => check.bookingId === booking.id),
      );
      if (missingChecks) {
        throw new HttpError(409, "READINESS_INCOMPLETE", "Sync every paid booking into the readiness board before completion");
      }
      assertEventFinalizationAllowed({
        actorUserId: req.user!.id,
        assignedVerifierId: event.readiness?.assignedVerifierId ?? null,
        eventStatus: event.status,
        eventEndsAt: event.endsAt,
        checkCount: event.serviceChecks.length,
        greenCount: event.serviceChecks.filter((check) => check.status === "GREEN").length,
      });
      const completed = event.status === "COMPLETED"
        ? event
        : await tx.event.update({
            where: { id: event.id },
            data: { status: "COMPLETED" },
          });
      const bookings = await tx.booking.findMany({
        where: { eventId, status: { in: ["PAID", "CONFIRMED"] } },
        select: { id: true },
      });
      return { event: completed, bookingIds: bookings.map((booking) => booking.id) };
    });
    res.json({
      event: { id: result.event.id, title: result.event.title, status: result.event.status },
      bookingIds: result.bookingIds,
      message: "Event completion verified. Escrow remains protected until each booking is released by the assigned verifier.",
    });
  }),
);

/** Client home: readiness for all my upcoming events */
readinessRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const events = await prisma.event.findMany({
      where: { ownerId: req.user!.id, startsAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
      orderBy: { startsAt: "asc" },
      take: 20,
      include: { readiness: true },
    });
    res.json({
      items: events.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
        readiness: e.readiness ? serializeReadiness(e.readiness) : null,
      })),
      rule: {
        windowOpensHoursBefore: WINDOW_HOURS,
        allGreenHoursBefore: GREEN_DEADLINE_HOURS,
      },
    });
  }),
);

/** Default zones by scale — used when seeding checklist lines */
export const ZONES_BY_SCALE: Record<string, string[]> = {
  SMALL: ["GENERAL"],
  MEDIUM: ["GENERAL", "STAGE", "FNB"],
  LARGE: ["STAGE", "FNB", "ACCESS", "PRODUCTION", "GENERAL"],
  MEGA: ["STAGE", "FNB", "ACCESS", "PRODUCTION", "MEDICAL", "SECURITY", "STREAM", "GENERAL"],
};

readinessRouter.post(
  "/events/:eventId/seed-zones",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = requiredParam(req.params.eventId, "eventId");
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new HttpError(404, "NOT_FOUND", "Event not found");
    if (event.status === "COMPLETED") {
      throw new HttpError(409, "EVENT_COMPLETED", "Readiness checklists cannot change after event completion");
    }
    const allowed =
      event.ownerId === req.user!.id ||
      ["ADMIN", "VERIFIER", "CONSULTANT"].includes(req.user!.role);
    if (!allowed) throw new HttpError(403, "FORBIDDEN", "Not allowed");

    const scale = (event as { scaleTier?: string }).scaleTier || "MEDIUM";
    const zones = ZONES_BY_SCALE[scale] ?? ZONES_BY_SCALE.MEDIUM ?? [];
    const labels: Record<string, string> = {
      GENERAL: "Overall site readiness",
      STAGE: "Stage / ceremony / main programme",
      FNB: "Food & beverage",
      ACCESS: "Access control & guest flow",
      PRODUCTION: "Production / AV / power",
      MEDICAL: "Medical & first aid",
      SECURITY: "Security perimeter",
      STREAM: "Livestream / virtual channels",
    };
    const created = [];
    for (const zone of zones) {
      const exists = await prisma.eventServiceCheck.findFirst({
        where: { eventId: event.id, zone, label: labels[zone] },
      });
      if (!exists) {
        created.push(
          await prisma.eventServiceCheck.create({
            data: {
              eventId: event.id,
              label: labels[zone] || zone,
              category: zone,
              zone,
              status: "PENDING",
            },
          }),
        );
      }
    }
    const result = await refreshReadiness(event.id);
    res.status(201).json({
      created: created.length,
      zones,
      readiness: serializeReadiness(result.readiness),
      checks: result.checks,
    });
  }),
);

/** Assign verifier to event zone */
readinessRouter.post(
  "/events/:eventId/verifiers",
  requireAuth,
  requireRole("VERIFIER", "CONSULTANT", "ADMIN", "CLIENT"),
  asyncHandler(async (req, res) => {
    const eventId = requiredParam(req.params.eventId, "eventId");
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new HttpError(404, "NOT_FOUND", "Event not found");
    if (event.status === "COMPLETED") {
      throw new HttpError(409, "EVENT_COMPLETED", "Verifier assignments cannot change after event completion");
    }
    if (
      event.ownerId !== req.user!.id &&
      !["ADMIN", "VERIFIER", "CONSULTANT"].includes(req.user!.role)
    ) {
      throw new HttpError(403, "FORBIDDEN", "Not allowed");
    }
    const verifierId =
      typeof req.body.verifierId === "string" ? req.body.verifierId : req.user!.id;
    const targetVerifier = await prisma.user.findFirst({
      where: { id: verifierId, role: "VERIFIER" },
      select: { id: true },
    });
    if (!targetVerifier) throw new HttpError(404, "VERIFIER_NOT_FOUND", "Selected user is not an active verifier");
    if (!canAssignReadinessVerifier({
      ownerId: event.ownerId,
      userId: req.user!.id,
      targetVerifierId: verifierId,
      role: req.user!.role,
    })) {
      throw new HttpError(403, "FORBIDDEN", "Only a verifier may self-assign; assigning another verifier requires event-owner, admin, or consultant access");
    }
    const zone = String(req.body.zone || "GENERAL").toUpperCase();
    const isLead = Boolean(req.body.isLead);
    if (isLead && event.ownerId !== req.user!.id && req.user!.role !== "ADMIN") {
      throw new HttpError(403, "FORBIDDEN", "Only the event owner may assign a lead verifier");
    }

    const row = await prisma.eventVerifierAssignment.upsert({
      where: {
        eventId_verifierId_zone: { eventId, verifierId, zone },
      },
      create: { eventId, verifierId, zone, isLead },
      update: { isLead },
    });
    res.status(201).json({ assignment: row });
  }),
);

readinessRouter.get(
  "/events/:eventId/verifiers",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = requiredParam(req.params.eventId, "eventId");
    await assertEventReadAccess(eventId, req.user!.id, req.user!.role);
    const items = await prisma.eventVerifierAssignment.findMany({
      where: { eventId },
      include: { verifier: { select: { id: true, name: true, email: true } } },
    });
    res.json({ items });
  }),
);

/** Sponsor/donor satisfaction snapshot when all green */
readinessRouter.get(
  "/events/:eventId/snapshot",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = requiredParam(req.params.eventId, "eventId");
    await assertEventReadAccess(eventId, req.user!.id, req.user!.role);
    const result = await refreshReadiness(eventId);
    const board = serializeReadiness(result.readiness);
    const snapshot = {
      eventId,
      title: result.event.title,
      generatedAt: new Date().toISOString(),
      status: board.status,
      allGreen: board.allGreen,
      counts: {
        total: board.totalChecks,
        green: board.greenCount,
        amber: board.amberCount,
        red: board.redCount,
        pending: board.pendingCount,
      },
      startsAt: board.startsAt,
      greenDeadlineAt: board.greenDeadlineAt,
      checks: result.checks.map((c) => ({
        label: c.label,
        zone: (c as { zone?: string }).zone || "GENERAL",
        status: c.status,
        checkedAt: c.checkedAt,
      })),
      satisfactionRule:
        "100% readiness satisfaction = every service check GREEN at least 2 hours before start",
    };
    if (board.allGreen) {
      await prisma.eventReadiness.update({
        where: { eventId },
        data: { snapshotJson: JSON.stringify(snapshot) },
      });
    }
    res.json({ snapshot });
  }),
);

/** Patch check zone */
readinessRouter.patch(
  "/checks/:checkId/zone",
  requireAuth,
  requireRole("VERIFIER", "CONSULTANT", "ADMIN", "CLIENT"),
  asyncHandler(async (req, res) => {
    const checkId = requiredParam(req.params.checkId, "checkId");
    const zone = String(req.body.zone || "GENERAL").toUpperCase();
    const existing = await prisma.eventServiceCheck.findUnique({ where: { id: checkId } });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Check not found");
    const event = await assertEventReadAccess(existing.eventId, req.user!.id, req.user!.role);
    if (event.status === "COMPLETED") {
      throw new HttpError(409, "EVENT_COMPLETED", "Readiness checks cannot change after event completion");
    }
    if (!canManageReadinessZones({ ownerId: event.ownerId, userId: req.user!.id, role: req.user!.role })) {
      throw new HttpError(403, "FORBIDDEN", "Only the event owner, admin, or consultant may change check zones");
    }
    const check = await prisma.eventServiceCheck.update({
      where: { id: checkId },
      data: { zone },
    });
    res.json({ check });
  }),
);

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** List verifiers for client selection — closest to event location first, then rating */
readinessRouter.get(
  "/verifiers/directory",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;
    const city = typeof req.query.city === "string" ? req.query.city : undefined;
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    let lat = req.query.lat != null ? Number(req.query.lat) : undefined;
    let lng = req.query.lng != null ? Number(req.query.lng) : undefined;

    if (eventId) {
      const ev = await prisma.event.findUnique({ where: { id: eventId } });
      if (ev) {
        // Event may not store lat/lng; city/country used for soft match
      }
    }

    const profiles = await prisma.verifierProfile.findMany({
      where: {
        isAvailable: true,
        user: { role: "VERIFIER", status: "ACTIVE" },
        ...(country ? { country: country.toUpperCase() } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, country: true } },
      },
      take: 100,
    });

    // Soft city boost when no coords
    const cityLower = city?.toLowerCase();

    type Row = (typeof profiles)[number] & { distanceKm: number | null; tier: string };
    const ranked: Row[] = profiles.map((p) => {
      let distanceKm: number | null = null;
      if (
        lat != null &&
        lng != null &&
        !Number.isNaN(lat) &&
        !Number.isNaN(lng) &&
        p.lat != null &&
        p.lng != null
      ) {
        distanceKm = haversineKm(lat, lng, p.lat, p.lng);
      }
      let tier = "STANDARD";
      if (distanceKm != null && distanceKm <= 25) tier = "TOP_LOCAL";
      else if (distanceKm != null && distanceKm <= 80) tier = "NEARBY";
      else if (cityLower && p.city?.toLowerCase() === cityLower) tier = "SAME_CITY";
      return { ...p, distanceKm, tier };
    });

    ranked.sort((a, b) => {
      const tierOrder = { TOP_LOCAL: 0, NEARBY: 1, SAME_CITY: 2, STANDARD: 3 } as Record<string, number>;
      const td = (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9);
      if (td !== 0) return td;
      if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg;
      return b.jobsCompleted - a.jobsCompleted;
    });

    res.json({
      items: ranked.map((p) => ({
        id: p.userId,
        profileId: p.id,
        name: p.user.name,
        headline: p.headline,
        bio: p.bio,
        city: p.city,
        country: p.country,
        lat: p.lat,
        lng: p.lng,
        jobsCompleted: p.jobsCompleted,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        specialties: p.specialties ? p.specialties.split(",").map((s) => s.trim()) : [],
        distanceKm: p.distanceKm != null ? Math.round(p.distanceKm * 10) / 10 : null,
        tier: p.tier,
      })),
    });
  }),
);

/** Verifier detail + recent reviews (popup) */
readinessRouter.get(
  "/verifiers/:userId/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = requiredParam(req.params.userId, "userId");
    const profile = await prisma.verifierProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!profile) throw new HttpError(404, "NOT_FOUND", "Verifier profile not found");
    const reviews = await prisma.verifierReview.findMany({
      where: { verifierId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { author: { select: { name: true } } },
    });
    res.json({
      profile: {
        id: profile.userId,
        name: profile.user.name,
        headline: profile.headline,
        bio: profile.bio,
        city: profile.city,
        country: profile.country,
        jobsCompleted: profile.jobsCompleted,
        ratingAvg: profile.ratingAvg,
        ratingCount: profile.ratingCount,
        specialties: profile.specialties?.split(",").map((s) => s.trim()) || [],
        isAvailable: profile.isAvailable,
      },
      reviews: reviews.map((r) => ({
        rating: r.rating,
        comment: r.comment,
        authorName: r.author.name,
        createdAt: r.createdAt,
      })),
    });
  }),
);

/** Client selects verifier(s) for event from the start — notifies verifier */
readinessRouter.post(
  "/events/:eventId/select-verifiers",
  requireAuth,
  asyncHandler(async (req, res) => {
    const eventId = requiredParam(req.params.eventId, "eventId");
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new HttpError(404, "NOT_FOUND", "Event not found");
    if (event.status === "COMPLETED") {
      throw new HttpError(409, "EVENT_COMPLETED", "Verifier assignments cannot change after event completion");
    }
    if (event.ownerId !== req.user!.id && req.user!.role !== "ADMIN") {
      throw new HttpError(403, "FORBIDDEN", "Only the event owner can select verifiers");
    }
    const verifierIds: string[] = Array.isArray(req.body.verifierIds)
      ? req.body.verifierIds
      : req.body.verifierId
        ? [req.body.verifierId]
        : [];
    if (!verifierIds.length) throw new HttpError(400, "VALIDATION_ERROR", "verifierIds required");
    const zone = String(req.body.zone || "GENERAL").toUpperCase();
    const assigned: Array<{ verifierId: string }> = [];
    for (const verifierId of verifierIds) {
      const user = await prisma.user.findFirst({
        where: { id: verifierId, role: "VERIFIER", status: "ACTIVE" },
      });
      if (!user) continue;
      const row = await prisma.eventVerifierAssignment.upsert({
        where: {
          eventId_verifierId_zone: { eventId, verifierId, zone },
        },
        create: { eventId, verifierId, zone, isLead: assigned.length === 0 },
        update: {},
      });
      assigned.push(row);
      await createNotification({
        userId: verifierId,
        type: "VERIFIER_SELECTED",
        title: "You were selected as verifier",
        body: `Client selected you for “${event.title}” (${zone}). Confirm readiness inside the T−6h window.`,
      });
      try {
        await pushToUser(
          verifierId,
          "Selected as event verifier",
          `${event.title} · zone ${zone}`,
          { eventId, zone },
        );
      } catch {
        /* push optional */
      }
    }
    // Lead on readiness record
    const leadAssignment = assigned[0];
    if (leadAssignment) {
      await prisma.eventReadiness.upsert({
        where: { eventId },
        create: {
          eventId,
          assignedVerifierId: leadAssignment.verifierId,
          startsAt: event.startsAt,
          windowOpensAt: event.startsAt
            ? new Date(event.startsAt.getTime() - 6 * 3600_000)
            : null,
          greenDeadlineAt: event.startsAt
            ? new Date(event.startsAt.getTime() - 2 * 3600_000)
            : null,
        },
        update: { assignedVerifierId: leadAssignment.verifierId },
      });
    }
    res.status(201).json({ assigned, notified: assigned.length });
  }),
);

/** Verifier upserts own profile (location critical for ranking) */
readinessRouter.put(
  "/verifiers/me/profile",
  requireAuth,
  requireRole("VERIFIER", "ADMIN"),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const data = {
      headline: req.body.headline != null ? String(req.body.headline).slice(0, 160) : undefined,
      bio: req.body.bio != null ? String(req.body.bio).slice(0, 2000) : undefined,
      city: req.body.city != null ? String(req.body.city).slice(0, 120) : undefined,
      country: req.body.country != null ? String(req.body.country).toUpperCase().slice(0, 2) : undefined,
      lat: req.body.lat != null ? Number(req.body.lat) : undefined,
      lng: req.body.lng != null ? Number(req.body.lng) : undefined,
      specialties: req.body.specialties != null ? String(req.body.specialties).slice(0, 200) : undefined,
      isAvailable: req.body.isAvailable != null ? Boolean(req.body.isAvailable) : undefined,
    };
    const profile = await prisma.verifierProfile.upsert({
      where: { userId },
      create: {
        userId,
        headline: data.headline || "Event readiness verifier",
        bio: data.bio,
        city: data.city,
        country: data.country,
        lat: data.lat,
        lng: data.lng,
        specialties: data.specialties,
        isAvailable: data.isAvailable ?? true,
      },
      update: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
    });
    res.json({ profile });
  }),
);

/** Client rates verifier after job */
readinessRouter.post(
  "/verifiers/:userId/reviews",
  requireAuth,
  requireRole("CLIENT"),
  asyncHandler(async (req, res) => {
    const userId = requiredParam(req.params.userId, "userId");
    const eventId = requiredParam(typeof req.body.eventId === "string" ? req.body.eventId : undefined, "eventId");
    const rating = Number(req.body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new HttpError(400, "VALIDATION_ERROR", "rating must be 1–5");
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, ownerId: req.user!.id },
      select: { id: true, status: true },
    });
    if (!event) throw new HttpError(404, "NOT_FOUND", "Completed event not found for this account");
    if (event.status !== "COMPLETED") {
      throw new HttpError(409, "EVENT_NOT_COMPLETED", "Verifier reviews are available after event completion");
    }
    const verifier = await prisma.user.findFirst({
      where: { id: userId, role: "VERIFIER" },
      select: { id: true },
    });
    if (!verifier) throw new HttpError(404, "VERIFIER_NOT_FOUND", "Verifier not found");
    const assignment = await prisma.eventVerifierAssignment.findFirst({
      where: { eventId, verifierId: userId },
      select: { id: true },
    });
    if (!assignment) throw new HttpError(403, "NOT_ASSIGNED", "You can only review a verifier assigned to your completed event");
    const duplicate = await prisma.verifierReview.findFirst({
      where: { authorId: req.user!.id, verifierId: userId, eventId },
      select: { id: true },
    });
    if (duplicate) throw new HttpError(409, "REVIEW_ALREADY_SUBMITTED", "You have already reviewed this verifier for this event");

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.verifierReview.create({
        data: {
          verifierId: userId,
          authorId: req.user!.id,
          eventId,
          rating: Math.round(rating),
          comment: req.body.comment ? String(req.body.comment).slice(0, 1000) : null,
        },
      });
      const agg = await tx.verifierReview.aggregate({
        where: { verifierId: userId },
        _avg: { rating: true },
        _count: true,
      });
      await tx.verifierProfile.updateMany({
        where: { userId },
        data: {
          ratingAvg: agg._avg.rating || 0,
          ratingCount: agg._count,
          jobsCompleted: { increment: 1 },
        },
      });
      return created;
    });
    res.status(201).json({ review });
  }),
);
