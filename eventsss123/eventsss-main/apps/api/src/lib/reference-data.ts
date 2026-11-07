import { Prisma, PrismaClient } from "@prisma/client";

const categories = [
  "Venues", "Catering", "Decor", "Photography & Video", "Entertainment",
  "Attire", "Logistics", "Security", "Rentals & Equipment", "Printing & Invites",
];

const plans: Prisma.PlanCreateInput[] = [
  { code: "CLIENT_FREE", name: "Client Free", audience: "CLIENT", priceMinor: 0n, interval: "MONTHLY", features: { events: 2, guests: 100 } },
  { code: "CLIENT_PRO_M", name: "Client Pro", audience: "CLIENT", priceMinor: 500000n, interval: "MONTHLY", features: { events: 20, guests: 2000, aiTools: true } },
  { code: "VENDOR_STARTER_M", name: "Vendor Starter", audience: "VENDOR", priceMinor: 1000000n, interval: "MONTHLY", features: { listings: 20, showroom: true } },
  { code: "VENDOR_PRO_Y", name: "Vendor Pro", audience: "VENDOR", priceMinor: 10000000n, interval: "YEARLY", features: { listings: 200, showroom: true, promotions: true } },
];

const slug = (value: string) =>
  value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * Idempotently inserts baseline marketplace categories and subscription plans.
 * Existing records are never overwritten, so it is safe to call at API startup.
 */
export async function ensureReferenceData(prisma: PrismaClient): Promise<void> {
  for (const name of categories) {
    await prisma.category.upsert({
      where: { slug: slug(name) },
      update: {},
      create: { name, slug: slug(name) },
    });
  }
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {},
      create: plan,
    });
  }
}
