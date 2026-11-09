// Real authentication regression coverage. Run against a migrated disposable/test DB with `npm run test:db`.
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

const app = createApp();
const run = process.env.RUN_DB_TESTS === "1";
const email = `auth-regression-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
const password = "correct-horse-1";
let userId: string | undefined;

describe.skipIf(!run)("authentication flow (DB)", () => {
  afterAll(async () => {
    if (userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.auditLog.deleteMany({ where: { actorId: userId } });
      await prisma.wallet.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it("registers once, never exposes the password hash, and rejects duplicate email", async () => {
    const registration = await request(app).post("/api/v1/auth/register").send({
      email,
      password,
      name: "Authentication Regression",
    });

    expect(registration.status).toBe(201);
    expect(registration.body.user.email).toBe(email);
    expect(registration.body.user.passwordHash).toBeUndefined();
    expect(registration.body.passwordHash).toBeUndefined();
    expect(registration.body.accessToken).toEqual(expect.any(String));
    expect(registration.body.refreshToken).toEqual(expect.any(String));

    userId = registration.body.user.id as string;
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(stored.passwordHash).not.toBe(password);
    expect(await (await import("bcryptjs")).default.compare(password, stored.passwordHash)).toBe(true);
    expect(await prisma.wallet.findFirst({ where: { userId } })).toBeTruthy();

    const duplicate = await request(app).post("/api/v1/auth/register").send({
      email,
      password,
      name: "Duplicate Registration",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("ALREADY_EXISTS");
  });

  it("returns the same safe credential error for wrong passwords and unknown emails", async () => {
    const wrongPassword = await request(app).post("/api/v1/auth/login").send({
      email,
      password: "definitely-the-wrong-password",
    });
    const unknownEmail = await request(app).post("/api/v1/auth/login").send({
      email: `unknown-${email}`,
      password,
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(unknownEmail.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(wrongPassword.body).not.toHaveProperty("accessToken");
    expect(unknownEmail.body).not.toHaveProperty("accessToken");
  });

  it("allows the correct password to sign in", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({ email, password });
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(email);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.user.passwordHash).toBeUndefined();
  });
});
