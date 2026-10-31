import { Router } from "express";
import { prisma } from "../../lib/prisma";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../lib/async";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema } from "./auth.schemas";
import * as auth from "./auth.service";

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
export const authRouter = Router();
authRouter.use(limiter);

authRouter.post("/register", validateBody(registerSchema), asyncHandler(async (req, res) => {
  res.status(201).json(await auth.register(req.body, req.get("user-agent")));
}));
authRouter.post("/login", validateBody(loginSchema), asyncHandler(async (req, res) => {
  res.json(await auth.login(req.body, req.get("user-agent")));
}));
authRouter.post("/forgot-password", validateBody(forgotPasswordSchema), asyncHandler(async (req, res) => {
  await auth.requestPasswordReset(req.body.email, req.get("user-agent"));
  res.json({ message: "If an account exists for that email, a reset link has been sent." });
}));
authRouter.post("/reset-password", validateBody(resetPasswordSchema), asyncHandler(async (req, res) => {
  await auth.resetPassword(req.body.token, req.body.password);
  res.json({ message: "Password updated. You can now sign in." });
}));
authRouter.post("/refresh", validateBody(refreshSchema), asyncHandler(async (req, res) => {
  res.json(await auth.refresh(req.body.refreshToken, req.get("user-agent")));
}));
authRouter.post("/logout", validateBody(refreshSchema), asyncHandler(async (req, res) => {
  await auth.logout(req.body.refreshToken);
  res.status(204).end();
}));
authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: await auth.me(req.user!.id) });
}));

authRouter.get("/security-history", requireAuth, asyncHandler(async (req, res) => {
  const items = await prisma.auditLog.findMany({
    where: { actorId: req.user!.id, entity: "AccountSecurity" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, action: true, meta: true, createdAt: true },
  });
  res.json({ items });
}));
