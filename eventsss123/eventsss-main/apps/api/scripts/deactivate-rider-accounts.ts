import "dotenv/config";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    const result = await prisma.user.updateMany({
      where: { role: Role.RIDER, status: UserStatus.ACTIVE },
      data: { status: UserStatus.SUSPENDED },
    });
    console.log(`Suspended ${result.count} active legacy Rider account(s). Existing records were preserved.`);
  } catch {
    console.error("Rider account deactivation failed. Check database connectivity and permissions, then retry.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
