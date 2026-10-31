import { z } from "zod/v3";

const uuid = z.string().uuid();

export const eventMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: uuid.optional(),
});

export const sendEventMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
    broadcast: z.boolean().optional().default(false),
    recipientIds: z.array(uuid).min(1).max(50).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.broadcast && value.recipientIds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientIds"],
        message: "Choose broadcast or individual recipients, not both.",
      });
    }
    if (!value.broadcast && !value.recipientIds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientIds"],
        message: "Choose one or more event participants.",
      });
    }
    if (value.recipientIds && new Set(value.recipientIds).size !== value.recipientIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientIds"],
        message: "Each recipient can only be selected once.",
      });
    }
  });

export type EventMessagesQuery = z.infer<typeof eventMessagesQuerySchema>;
export type SendEventMessageInput = z.infer<typeof sendEventMessageSchema>;
