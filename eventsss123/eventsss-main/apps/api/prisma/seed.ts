import { PrismaClient } from "@prisma/client";
import { ensureReferenceData } from "../src/lib/reference-data";

const prisma = new PrismaClient();

async function main() {
  await ensureReferenceData(prisma);
  console.log("Seeded baseline EPHINTA categories and subscription plans.");
}

main()
  .catch((error) => {
    console.error("Reference data seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
