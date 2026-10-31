import { Router, type Request } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import * as budget from "./budget.service";
import * as events from "./events.service";
import * as guests from "./guests.service";
import * as tasks from "./tasks.service";
import {
  budgetCreateSchema, budgetUpdateSchema, createEventSchema, guestBulkSchema, guestCreateSchema,
  guestUpdateSchema, guestCheckInSchema, listEventsQuery, listGuestsQuery, planAnswersSchema, taskCreateSchema, taskUpdateSchema, updateEventSchema,
} from "./events.schemas";

const uuid = z.string().uuid();
const param = (req: Request, key: string) => uuid.parse(req.params[key]);
const uid = (req: Request) => req.user!.id;

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

// ---- events
eventsRouter.post("/", validateBody(createEventSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ event: await events.createEvent(uid(req), req.body) });
}));
eventsRouter.get("/", asyncHandler(async (req, res) => {
  res.json(await events.listEvents(uid(req), listEventsQuery.parse(req.query)));
}));
eventsRouter.get("/:eventId", asyncHandler(async (req, res) => {
  res.json(await events.getEventDetail(uid(req), param(req, "eventId")));
}));
eventsRouter.patch("/:eventId", validateBody(updateEventSchema), asyncHandler(async (req, res) => {
  res.json({ event: await events.updateEvent(uid(req), param(req, "eventId"), req.body) });
}));
eventsRouter.delete("/:eventId", asyncHandler(async (req, res) => {
  await events.deleteEvent(uid(req), param(req, "eventId"));
  res.status(204).end();
}));
eventsRouter.get("/:eventId/plan-answers", asyncHandler(async (req, res) => {
  res.json(await events.getPlanAnswers(uid(req), param(req, "eventId")));
}));
eventsRouter.put("/:eventId/plan-answers", validateBody(planAnswersSchema), asyncHandler(async (req, res) => {
  res.json(await events.savePlanAnswers(uid(req), param(req, "eventId"), req.body.answers));
}));

// ---- guests
eventsRouter.post("/:eventId/guests", validateBody(guestCreateSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ guest: await guests.addGuest(uid(req), param(req, "eventId"), req.body) });
}));
eventsRouter.post("/:eventId/guests/bulk", validateBody(guestBulkSchema), asyncHandler(async (req, res) => {
  const created = await guests.addGuestsBulk(uid(req), param(req, "eventId"), req.body.guests);
  res.status(201).json({ count: created.length, guests: created });
}));
eventsRouter.get("/:eventId/guests", asyncHandler(async (req, res) => {
  res.json(await guests.listGuests(uid(req), param(req, "eventId"), listGuestsQuery.parse(req.query)));
}));
eventsRouter.get("/:eventId/guests/check-ins", asyncHandler(async (req, res) => {
  res.json({ items: await guests.listGuestCheckIns(uid(req), param(req, "eventId")) });
}));
eventsRouter.post("/:eventId/guests/check-in", validateBody(guestCheckInSchema), asyncHandler(async (req, res) => {
  const result = await guests.checkInGuest(uid(req), param(req, "eventId"), req.body);
  res.status(result.alreadyCheckedIn ? 200 : 201).json(result);
}));
eventsRouter.patch("/:eventId/guests/:guestId", validateBody(guestUpdateSchema), asyncHandler(async (req, res) => {
  res.json({ guest: await guests.updateGuest(uid(req), param(req, "eventId"), param(req, "guestId"), req.body) });
}));
eventsRouter.delete("/:eventId/guests/:guestId", asyncHandler(async (req, res) => {
  await guests.deleteGuest(uid(req), param(req, "eventId"), param(req, "guestId"));
  res.status(204).end();
}));

// ---- tasks / checklist
eventsRouter.get("/:eventId/tasks", asyncHandler(async (req, res) => {
  res.json({ tasks: await tasks.listTasks(uid(req), param(req, "eventId")) });
}));
eventsRouter.post("/:eventId/tasks", validateBody(taskCreateSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ task: await tasks.createTask(uid(req), param(req, "eventId"), req.body) });
}));
eventsRouter.post("/:eventId/tasks/generate-checklist", asyncHandler(async (req, res) => {
  res.status(201).json({ tasks: await tasks.regenerateChecklist(uid(req), param(req, "eventId")) });
}));
eventsRouter.patch("/:eventId/tasks/:taskId", validateBody(taskUpdateSchema), asyncHandler(async (req, res) => {
  res.json({ task: await tasks.updateTask(uid(req), param(req, "eventId"), param(req, "taskId"), req.body) });
}));
eventsRouter.delete("/:eventId/tasks/:taskId", asyncHandler(async (req, res) => {
  await tasks.deleteTask(uid(req), param(req, "eventId"), param(req, "taskId"));
  res.status(204).end();
}));

// ---- budget (amounts are minor-unit strings)
eventsRouter.get("/:eventId/budget", asyncHandler(async (req, res) => {
  res.json(await budget.getBudget(uid(req), param(req, "eventId")));
}));
eventsRouter.post("/:eventId/budget/items", validateBody(budgetCreateSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ item: await budget.createItem(uid(req), param(req, "eventId"), req.body) });
}));
eventsRouter.patch("/:eventId/budget/items/:itemId", validateBody(budgetUpdateSchema), asyncHandler(async (req, res) => {
  res.json({ item: await budget.updateItem(uid(req), param(req, "eventId"), param(req, "itemId"), req.body) });
}));
eventsRouter.delete("/:eventId/budget/items/:itemId", asyncHandler(async (req, res) => {
  await budget.deleteItem(uid(req), param(req, "eventId"), param(req, "itemId"));
  res.status(204).end();
}));
