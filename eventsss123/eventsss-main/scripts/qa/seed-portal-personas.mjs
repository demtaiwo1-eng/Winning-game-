#!/usr/bin/env node
/**
 * Seeds 1,000 isolated QA identities per active portal (7,000 total).
 * Requires a disposable LOCAL PostgreSQL database. Never point this at Render,
 * Neon, Supabase, staging, or production. All credentials are synthetic.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const confirmation = process.env.QA_SCALE_CONFIRM;
const databaseUrl = process.env.QA_DATABASE_URL || "";
const count = Number(process.env.QA_USERS_PER_PORTAL || 1000);
const roles = ["CLIENT", "ORGANIZATION", "VENDOR", "AFFILIATE", "CONSULTANT", "VERIFIER", "ADMIN"];

if (confirmation !== "YES") {
  console.error("Refusing to seed. Set QA_SCALE_CONFIRM=YES after confirming this is a disposable local QA database.");
  process.exit(2);
}
if (process.env.NODE_ENV === "production" || !databaseUrl) {
  console.error("Set QA_DATABASE_URL to a disposable local PostgreSQL database; production is never allowed.");
  process.exit(2);
}
let parsed;
try { parsed = new URL(databaseUrl); } catch {
  console.error("QA_DATABASE_URL is not a valid URL.");
  process.exit(2);
}
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  console.error("Safety stop: QA_DATABASE_URL must point to localhost/127.0.0.1/::1. Managed and remote databases are not accepted.");
  process.exit(2);
}
if (!Number.isInteger(count) || count < 1 || count > 1000) {
  console.error("QA_USERS_PER_PORTAL must be an integer from 1 to 1000.");
  process.exit(2);
}
const password = process.env.QA_PORTAL_PASSWORD || randomBytes(32).toString("base64url");
const prefix = process.env.QA_PORTAL_PREFIX || `qa-portal-${Date.now()}-${randomBytes(3).toString("hex")}`;
if (!/^qa-portal-[a-z0-9-]{6,80}$/.test(prefix)) {
  console.error("QA_PORTAL_PREFIX must begin qa-portal- and contain only lowercase letters, numbers and hyphens.");
  process.exit(2);
}

process.env.DATABASE_URL = databaseUrl;
const prisma = new PrismaClient();
try {
  if (process.argv.includes("--clean")) {
    const deleted = await prisma.user.deleteMany({ where: { email: { startsWith: `${prefix}-` } } });
    console.log(JSON.stringify({ operation: "clean", prefix, deletedUsers: deleted.count }));
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const userRows = [];
  for (const role of roles) {
    for (let index = 1; index <= count; index += 1) {
      const orgServiceProvider = role === "ORGANIZATION" && index % 2 === 0;
      userRows.push({
        email: `${prefix}-${role.toLowerCase()}-${String(index).padStart(4, "0")}@example.test`,
        name: `EPHINTA QA ${role} ${index}`,
        passwordHash,
        role,
        status: "ACTIVE",
        emailVerifiedAt: now,
        locale: "en",
        country: "NG",
        currency: "NGN",
        ...(role === "ORGANIZATION" ? { organizationMode: orgServiceProvider ? "SERVICE_PROVIDER" : "EVENT_PLANNING" } : {}),
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({ data: userRows });
    const users = await tx.user.findMany({
      where: { email: { startsWith: `${prefix}-` } },
      select: { id: true, role: true, email: true, organizationMode: true },
    });
    if (users.length !== roles.length * count) {
      throw new Error(`Expected ${roles.length * count} users, found ${users.length}; transaction rolled back.`);
    }
    await tx.wallet.createMany({ data: users.map((user) => ({ userId: user.id, currency: "NGN" })) });
    const vendorUsers = users.filter((user) => user.role === "VENDOR" || (user.role === "ORGANIZATION" && user.organizationMode === "SERVICE_PROVIDER"));
    await tx.vendorProfile.createMany({
      data: vendorUsers.map((user, index) => ({
        userId: user.id,
        businessName: `QA Business ${index + 1}`,
        slug: `${prefix}-business-${String(index + 1).padStart(5, "0")}`,
        description: "Synthetic QA-only vendor profile; not a real business.",
        country: "NG",
        city: ["Lagos", "Abuja", "Ibadan", "Port Harcourt", "Kano"][index % 5],
      })),
    });
  }, { maxWait: 15000, timeout: 120000 });

  const counts = await prisma.user.groupBy({
    by: ["role"],
    where: { email: { startsWith: `${prefix}-` } },
    _count: { _all: true },
  });
  console.log(JSON.stringify({
    status: "seeded",
    prefix,
    totalUsers: roles.length * count,
    perPortal: Object.fromEntries(roles.map((role) => [role, counts.find((item) => item.role === role)?._count._all || 0])),
    wallets: roles.length * count,
    vendorProfiles: count + Math.floor(count / 2),
    skipped: { RIDER: "decommissioned; sign-in is disabled in the current application" },
    credentials: "Synthetic password supplied through QA_PORTAL_PASSWORD; never printed",
    adminWarning: "ADMIN fixtures are privileged. Keep this database local and disposable; never reuse these accounts in a shared or live environment.",
    cleanup: `QA_SCALE_CONFIRM=YES QA_DATABASE_URL=<same-local-db> QA_PORTAL_PREFIX=${prefix} node scripts/qa/seed-portal-personas.mjs --clean`,
  }, null, 2));
} catch (error) {
  console.error("Portal persona seeding failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
