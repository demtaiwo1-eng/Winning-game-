import { z } from "zod/v3";

const uuid = z.string().uuid();

export const eventMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: uuid.optional(),
  folder: z.enum(["ALL", "INBOX", "SENT", "ARCHIVED"]).default("ALL"),
});

export const sendEventMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
    broadcast: z.boolean().optional().default(false),
    // recipientIds remains supported for older app versions.
    recipientIds: z.array(uuid).min(1).max(50).optional(),
    toIds: z.array(uuid).max(50).optional(),
    ccIds: z.array(uuid).max(50).optional(),
    bccIds: z.array(uuid).max(50).optional(),
  })
  .superRefine((value, ctx) => {
    const hasNewRecipients = Boolean(value.toIds?.length || value.ccIds?.length || value.bccIds?.length);
    if (value.broadcast && (value.recipientIds || hasNewRecipients)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientIds"],
        message: "Choose broadcast or explicit recipients, not both.",
      });
    }
    if (!value.broadcast && !value.recipientIds && !value.toIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toIds"],
        message: "Choose at least one primary To recipient. CC and BCC are optional.",
      });
    }
    const allIds = [
      ...(value.recipientIds || []),
      ...(value.toIds || []),
      ...(value.ccIds || []),
      ...(value.bccIds || []),
    ];
    if (new Set(allIds).size !== allIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ccIds"],
        message: "A participant can only appear once across To, CC and BCC.",
      });
    }
  });

export type EventMessagesQuery = z.infer<typeof eventMessagesQuerySchema>;
export type SendEventMessageInput = z.infer<typeof sendEventMessageSchema>;
