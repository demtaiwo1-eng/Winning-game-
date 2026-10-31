import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { HttpError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { sendPasswordResetEmail } from "../../lib/mail";
import type { LoginInput, RegisterInput } from "./auth.schemas";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

async function recordSecurityEvent(userId: string, action: string, userAgent?: string) {
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action,
      entity: "AccountSecurity",
      meta: userAgent ? { userAgent: userAgent.slice(0, 200) } : {},
    },
  });
}
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export const publicUserSelect = {
  id: true, email: true, name: true, role: true, organizationMode: true, locale: true, country: true, currency: true, createdAt: true,
} satisfies Prisma.UserSelect;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "vendor";

function signAccess(u: { id: string; role: string; organizationMode?: string | null }) {
  return jwt.sign({ role: u.role, organizationMode: u.organizationMode ?? null }, env.JWT_SECRET, { subject: u.id, expiresIn: env.ACCESS_TTL_MIN * 60 });
}

async function issueTokens(user: { id: string; role: string; organizationMode?: string | null }, userAgent?: string) {
  const refreshToken = randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400_000),
      userAgent: userAgent?.slice(0, 200),
    },
  });
  return { accessToken: signAccess(user), refreshToken, expiresIn: env.ACCESS_TTL_MIN * 60 };
}

export async function register(input: RegisterInput, userAgent?: string) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: input.email, passwordHash, name: input.name, role: input.role, phone: input.phone,
          country: input.country, currency: input.currency, locale: input.locale,
          organizationMode: input.organizationMode,
        },
        select: publicUserSelect,
      });
      await tx.wallet.create({ data: { userId: u.id, currency: input.currency } });
      if (
        input.role === "VENDOR" ||
        (input.role === "ORGANIZATION" && input.organizationMode === "SERVICE_PROVIDER")
      ) {
        await tx.vendorProfile.create({
          data: {
            userId: u.id,
            businessName: input.businessName!,
            slug: `${slugify(input.businessName!)}-${randomBytes(3).toString("hex")}`,
            description: input.businessDescription,
            country: input.country,
            city: input.businessCity,
          },
        });
        if (input.kycDocumentUrl) {
          await tx.verificationRequest.create({ data: { userId: u.id, kind: "BUSINESS", documentUrl: input.kycDocumentUrl } });
        }
      }
      return u;
    });
    const tokens = await issueTokens(user, userAgent);
    await recordSecurityEvent(user.id, "ACCOUNT_REGISTERED", userAgent);
    return { user, ...tokens };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError(409, "ALREADY_EXISTS", "Email or phone already registered");
    }
    throw e;
  }
}

export async function login(input: LoginInput, userAgent?: string) {
  const found = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await bcrypt.compare(input.password, found?.passwordHash ?? DUMMY_HASH);
  if (!found || !ok) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  if (found.role === "RIDER") {
    throw new HttpError(403, "ACCOUNT_DISABLED", "Rider accounts are no longer supported");
  }
  if (found.status !== "ACTIVE") throw new HttpError(403, "ACCOUNT_DISABLED", "Account is not active");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: found.id }, select: publicUserSelect });
  const tokens = await issueTokens(user, userAgent);
  await recordSecurityEvent(user.id, "LOGIN_SUCCESS", userAgent);
  return { user, ...tokens };
}

export async function refresh(token: string, userAgent?: string) {
  const rec = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!rec) throw new HttpError(401, "INVALID_TOKEN", "Invalid refresh token");
  if (rec.revokedAt) {
    // reuse of a rotated token => treat as theft, revoke the whole family
    await prisma.refreshToken.updateMany({ where: { userId: rec.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await recordSecurityEvent(rec.userId, "REFRESH_TOKEN_REUSE", userAgent);
    throw new HttpError(401, "TOKEN_REUSE", "Refresh token already used");
  }
  if (rec.expiresAt < new Date()) throw new HttpError(401, "INVALID_TOKEN", "Refresh token expired");
  await prisma.refreshToken.update({ where: { id: rec.id }, data: { revokedAt: new Date() } });
  const user = await prisma.user.findUnique({ where: { id: rec.userId }, select: publicUserSelect });
  if (!user) throw new HttpError(401, "INVALID_TOKEN", "User not found");
  if (user.role === "RIDER") {
    throw new HttpError(403, "ACCOUNT_DISABLED", "Rider accounts are no longer supported");
  }
  const tokens = await issueTokens(user, userAgent);
  await recordSecurityEvent(user.id, "SESSION_REFRESHED", userAgent);
  return { user, ...tokens };
}

export async function logout(token: string) {
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, select: { userId: true, revokedAt: true } });
  const result = await prisma.refreshToken.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  if (record && !record.revokedAt && result.count > 0) await recordSecurityEvent(record.userId, "LOGOUT");
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw new HttpError(404, "NOT_FOUND", "User not found");
  return user;
}

export async function requestPasswordReset(email: string, userAgent?: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const rawToken = randomBytes(48).toString("base64url");
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(rawToken), expiresAt: new Date(Date.now() + 30 * 60_000) } });
  await sendPasswordResetEmail(email, `${env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(rawToken)}`);
  void userAgent;
}

export async function resetPassword(token: string, password: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw new HttpError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or expired");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({ data: { actorId: record.userId, action: "PASSWORD_RESET", entity: "AccountSecurity", meta: {} } }),
  ]);
}
