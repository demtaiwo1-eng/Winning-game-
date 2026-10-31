import { Router } from "express";
import { z } from "zod/v3";
import { asyncHandler } from "../../lib/async";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { eventMessagesQuerySchema, sendEventMessageSchema } from "./messages.schemas";
import * as messages from "./messages.service";

const uuid = z.string().uuid();
const eventId = (value: string) => uuid.parse(value);

export const eventMessagesRouter = Router();
eventMessagesRouter.use(requireAuth);

eventMessagesRouter.get(
  "/:eventId/messages",
  asyncHandler(async (req, res) => {
    res.json(
      await messages.listEventMessages(
        req.user!.id,
        eventId(req.params.eventId),
        eventMessagesQuerySchema.parse(req.query),
      ),
    );
  }),
);

eventMessagesRouter.post(
  "/:eventId/messages",
  validateBody(sendEventMessageSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await messages.sendEventMessage(req.user!.id, eventId(req.params.eventId), req.body),
    );
  }),
);

eventMessagesRouter.patch(
  "/:eventId/messages/read",
  asyncHandler(async (req, res) => {
    res.json(await messages.markEventMessagesRead(req.user!.id, eventId(req.params.eventId)));
  }),
);
