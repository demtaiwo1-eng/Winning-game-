import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { asyncHandler } from "../../lib/async";
import { validateBody } from "../../middleware/validate";
import { rsvpRespondSchema } from "../events/events.schemas";
import * as guests from "../events/guests.service";

const token = z.string().uuid();
export const rsvpRouter = Router();
rsvpRouter.use(rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));

rsvpRouter.get("/:token", asyncHandler(async (req, res) => {
  res.json(await guests.rsvpView(token.parse(req.params["token"])));
}));
rsvpRouter.post("/:token", validateBody(rsvpRespondSchema), asyncHandler(async (req, res) => {
  res.json({ guest: await guests.rsvpRespond(token.parse(req.params["token"]), req.body) });
}));
