import { createHash } from "node:crypto";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rawLimit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      return res.status(400).json({ error: { code: "INVALID_LIMIT", message: "limit must be between 1 and 100" } });
    }
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    if (before && !uuidPattern.test(before)) {
      return res.status(400).json({ error: { code: "INVALID_CURSOR", message: "before must be a notification ID" } });
    }
    const preference = await prisma.pushPreference.findUnique({ where: { userId: req.user!.id } });
    if (preference?.inAppEnabled === false) return res.json({ items: [], nextBefore: null });
    if (before) {
      const cursor = await prisma.notification.findFirst({
        where: { id: before, userId: req.user!.id },
        select: { id: true },
      });
      if (!cursor) return res.status(400).json({ error: { code: "INVALID_CURSOR", message: "Notification cursor is not available" } });
    }
    const rows = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: rawLimit + 1,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    });
    const hasMore = rows.length > rawLimit;
    const items = rows.slice(0, rawLimit);
    res.json({ items, nextBefore: hasMore ? items[items.length - 1]?.id ?? null : null });
  }),
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true, updated: result.count });
  }),
);

notificationsRouter.patch(
  "/:notificationId/read",
  asyncHandler(async (req, res) => {
    if (!uuidPattern.test(req.params.notificationId)) {
      return res.status(400).json({ error: { code: "INVALID_ID", message: "Notification ID is invalid" } });
    }
    const result = await prisma.notification.updateMany({
      where: { id: req.params.notificationId, userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const owned = await prisma.notification.findFirst({
        where: { id: req.params.notificationId, userId: req.user!.id },
        select: { id: true },
      });
      if (!owned) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
    }
    res.json({ ok: true });
  }),
);

notificationsRouter.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    const preferences = await prisma.pushPreference.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id },
      update: {},
    });
    res.json({ preferences });
  }),
);

notificationsRouter.patch(
  "/preferences",
  asyncHandler(async (req, res) => {
    const allowed = ["inAppEnabled", "pushEnabled", "messages", "bookings", "payments", "marketing"] as const;
    const data: { inAppEnabled?: boolean; pushEnabled?: boolean; messages?: boolean; bookings?: boolean; payments?: boolean; marketing?: boolean } = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) {
        if (typeof req.body[key] !== "boolean") {
          return res.status(400).json({ error: { code: "INVALID_PREFERENCE", message: `${key} must be a boolean` } });
        }
        data[key] = req.body[key];
      }
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: { code: "EMPTY_PREFERENCES", message: "Provide at least one preference to update" } });
    }
    const preferences = await prisma.pushPreference.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...data },
      update: data,
    });
    res.json({ preferences });
  }),
);

/** Register a device without retaining its raw provider token in audit logs. */
notificationsRouter.post(
  "/push-token",
  asyncHandler(async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const platform = typeof req.body?.platform === "string" ? req.body.platform.toLowerCase() : "";
    if (token.length < 8 || token.length > 4096 || !["android", "ios", "web"].includes(platform)) {
      return res.status(400).json({ error: { code: "INVALID_DEVICE", message: "A valid token and android, ios, or web platform are required" } });
    }
    const hash = tokenHash(token);
    await prisma.pushDevice.upsert({
      where: { tokenHash: hash },
      create: { userId: req.user!.id, tokenHash: hash, platform },
      update: { userId: req.user!.id, platform, lastSeenAt: new Date(), revokedAt: null },
    });
    res.status(201).json({ ok: true, platform });
  }),
);

notificationsRouter.delete(
  "/push-token",
  asyncHandler(async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (token.length < 8 || token.length > 4096) {
      return res.status(400).json({ error: { code: "INVALID_DEVICE", message: "A valid token is required" } });
    }
    const result = await prisma.pushDevice.updateMany({
      where: { userId: req.user!.id, tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true, revoked: result.count });
  }),
);

/** Provider delivery is deliberately disabled until FCM/APNs credentials are configured. */
notificationsRouter.post("/test-push", (_req, res) => {
  res.status(501).json({ error: { code: "PUSH_PROVIDER_NOT_CONFIGURED", message: "Push delivery is not configured; no notification was sent." } });
});
