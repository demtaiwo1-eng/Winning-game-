import { prisma } from "../../lib/prisma";

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
    },
  });
}

/** Fan-out to registered device tokens (FCM/APNs via Capacitor push). */
export async function pushToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
  const tokens = await prisma.auditLog.findMany({
    where: { actorId: userId, action: "PUSH_TOKEN_REGISTER" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  // Production: send via FCM HTTP v1 / APNs using token in meta.token
  // Here we record a push attempt for observability
  for (const row of tokens) {
    const meta = (row.meta || {}) as { token?: string; platform?: string };
    if (!meta.token) continue;
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "PUSH_SEND_ATTEMPT",
        entity: "Notification",
        meta: { token: meta.token.slice(0, 12) + "…", platform: meta.platform, title, body, data },
      },
    });
  }
  return { attempted: tokens.length };
}
