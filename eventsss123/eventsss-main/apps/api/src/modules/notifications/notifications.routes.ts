import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { createNotification, pushToUser } from "./notifications.service";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ items });
  }),
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  }),
);

/** Register Capacitor / FCM / APNs device token */
notificationsRouter.post(
  "/push-token",
  asyncHandler(async (req, res) => {
    const token = String(req.body.token || "").trim();
    const platform = String(req.body.platform || "unknown");
    if (token.length < 8) {
      return res.status(400).json({ error: { code: "INVALID", message: "token required" } });
    }
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "PUSH_TOKEN_REGISTER",
        entity: "Device",
        meta: { token, platform },
      },
    });
    res.status(201).json({ ok: true, platform });
  }),
);

/** Test push (dev) */
notificationsRouter.post(
  "/test-push",
  asyncHandler(async (req, res) => {
    const title = String(req.body.title || "ESS");
    const body = String(req.body.body || "Test notification");
    await createNotification({
      userId: req.user!.id,
      type: "TEST",
      title,
      body,
    });
    const push = await pushToUser(req.user!.id, title, body);
    res.json({ ok: true, push });
  }),
);
