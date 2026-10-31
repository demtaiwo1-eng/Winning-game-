import { prisma } from "../../lib/prisma";

export type NotificationCategory = "MESSAGE" | "BOOKING" | "PAYMENT" | "MARKETING" | "SYSTEM";

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: NotificationCategory;
}) {
  const preference = await prisma.pushPreference.findUnique({ where: { userId: input.userId } });
  if (preference?.inAppEnabled === false) return null;

  const category = input.category ?? "SYSTEM";
  const categoryEnabled =
    category === "MESSAGE" ? preference?.messages !== false :
    category === "BOOKING" ? preference?.bookings !== false :
    category === "PAYMENT" ? preference?.payments !== false :
    category === "MARKETING" ? preference?.marketing === true : true;
  if (!categoryEnabled) return null;

  // Push is intentionally not sent until an FCM/APNs provider is configured.
  // Record this honestly so the in-app notification remains usable without
  // claiming that a device notification was delivered.
  const deliveryStatus = preference?.pushEnabled ? "NOT_CONFIGURED" : "NOT_REQUESTED";
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      deliveryStatus,
    },
  });
}
