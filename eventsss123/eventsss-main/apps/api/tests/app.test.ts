import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { env } from "../src/config/env";

const app = createApp();

describe("api foundation (DB-free)", () => {
  it("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
  it("rejects invalid registration", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({ email: "nope", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
  it("requires businessName for vendors", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ email: "v@x.com", password: "longenough123!", name: "Vee", role: "VENDOR" });
    expect(res.status).toBe(400);
  });
  it("blocks /me without token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });
  it("restricts live admin analytics to admin accounts", async () => {
    const missing = await request(app).get("/api/v1/admin/overview");
    expect(missing.status).toBe(401);
    const token = jwt.sign({ role: "VENDOR" }, env.JWT_SECRET, { subject: "vendor-user" });
    const forbidden = await request(app).get("/api/v1/admin/overview").set("Authorization", `Bearer ${token}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });
  it("protects read-only finance feeds from non-admin access", async () => {
    const missing = await request(app).get("/api/v1/admin/finance/payment-intents");
    expect(missing.status).toBe(401);
    const token = jwt.sign({ role: "VENDOR" }, env.JWT_SECRET, { subject: "vendor-user" });
    const payments = await request(app).get("/api/v1/admin/finance/payment-intents").set("Authorization", `Bearer ${token}`);
    const ledger = await request(app).get("/api/v1/admin/finance/ledger").set("Authorization", `Bearer ${token}`);
    expect(payments.status).toBe(403);
    expect(ledger.status).toBe(403);
  });
  it("validates finance feed filters before querying records", async () => {
    const token = jwt.sign({ role: "ADMIN" }, env.JWT_SECRET, { subject: "admin-user" });
    const invalidStatus = await request(app)
      .get("/api/v1/admin/finance/payment-intents?status=UNKNOWN")
      .set("Authorization", `Bearer ${token}`);
    expect(invalidStatus.status).toBe(400);
    expect(invalidStatus.body.error.code).toBe("INVALID_FILTER");
    const invalidDate = await request(app)
      .get("/api/v1/admin/finance/ledger?from=not-a-date")
      .set("Authorization", `Bearer ${token}`);
    expect(invalidDate.status).toBe(400);
    expect(invalidDate.body.error.code).toBe("INVALID_FILTER");
  });
  it("rejects previously issued Rider access tokens", async () => {
    const token = jwt.sign({ role: "RIDER" }, env.JWT_SECRET, { subject: "retired-rider" });
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DISABLED");
  });
  it("rejects Organization access tokens without an operating mode", async () => {
    const token = jwt.sign({ role: "ORGANIZATION" }, env.JWT_SECRET, { subject: "org-user" });
    const res = await request(app).get("/api/v1/vendor/profile").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
  it("does not let event-planning organizations access vendor operations", async () => {
    const token = jwt.sign(
      { role: "ORGANIZATION", organizationMode: "EVENT_PLANNING" },
      env.JWT_SECRET,
      { subject: "org-user" },
    );
    const res = await request(app).get("/api/v1/vendor/profile").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
  it("does not deduct wallet funds for an unimplemented external payout", async () => {
    const token = jwt.sign({ role: "VENDOR" }, env.JWT_SECRET, { subject: "vendor-user" });
    const res = await request(app)
      .post("/api/v1/payments/payouts")
      .set("Authorization", `Bearer ${token}`)
      .send({ currency: "NGN", amountMinor: "10000" });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("PAYOUT_NOT_CONFIGURED");
    expect(res.body.error.message).toContain("no wallet funds were moved");
  });
  it("returns 410 for retired Rider job endpoints", async () => {
    const get = await request(app).get("/api/v1/rider/jobs");
    const update = await request(app).patch("/api/v1/rider/jobs/old-job");
    expect(get.status).toBe(410);
    expect(get.body.error.code).toBe("ROLE_RETIRED");
    expect(update.status).toBe(410);
    expect(update.body.error.code).toBe("ROLE_RETIRED");
  });
  it("requires authentication for feedback endpoints", async () => {
    const eligible = await request(app).get("/api/v1/marketplace/reviews/eligible");
    const submit = await request(app).post("/api/v1/marketplace/reviews").send({
      bookingId: "booking-id",
      rating: 5,
    });
    expect(eligible.status).toBe(401);
    expect(submit.status).toBe(401);
  });
  it("exposes a public eligible promotions feed without authentication", async () => {
    const res = await request(app).get("/api/v1/billing/public-promotions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
  it("404s unknown routes", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
  });
});
