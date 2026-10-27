import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

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

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  for (const name of categories) {
    await prisma.category.upsert({ where: { slug: slug(name) }, update: {}, create: { name, slug: slug(name) } });
  }
  for (const p of plans) {
    await prisma.plan.upsert({ where: { code: p.code }, update: {}, create: p });
  }
  console.log(`Seeded ${categories.length} categories, ${plans.length} plans`);
}

main().finally(() => prisma.$disconnect());
