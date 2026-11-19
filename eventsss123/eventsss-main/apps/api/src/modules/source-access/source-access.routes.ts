import { Router } from "express";
import { randomUUID } from "node:crypto";
import { SourceAccessOrderStatus } from "@prisma/client";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth";
import { getPaymentMode, verifyPaystack } from "../payments/providers";
import {
  assertVerifiedPayment,
  verifyPaystackSignature,
  verifyPaystackWebhookSignature,
} from "../payments/webhookVerification";

export const sourceAccessRouter = Router();

const PRODUCT_CODE = "EPHINTA_SOURCE_ACCESS_60";
const PRICE_MINOR = 6000n;
const CURRENCY = "USD";

function assertTestCheckoutReady() {
  if (env.SOURCE_ACCESS_CHECKOUT_ENABLED !== "true") {
    throw new HttpError(503, "SOURCE_ACCESS_CHECKOUT_CLOSED", "Paid source access is not open yet.");
  }
  if (getPaymentMode() !== "test") {
    throw new HttpError(503, "SOURCE_ACCESS_TEST_MODE_REQUIRED", "Source-access checkout is restricted to Paystack test mode until merchant and release approval.");
  }
  if (!env.PAYSTACK_SECRET_KEY || !/^sk_test_/.test(env.PAYSTACK_SECRET_KEY)) {
    throw new HttpError(503, "PAYSTACK_TEST_KEY_REQUIRED", "Configure a Paystack test secret key in the API environment.");
  }
  if (!env.API_BASE_URL) {
    throw new HttpError(503, "API_BASE_URL_REQUIRED", "Configure API_BASE_URL before enabling source-access checkout.");
  }
}

sourceAccessRouter.post("/orders", requireAuth, asyncHandler(async (req, res) => {
  assertTestCheckoutReady();

  const reference = `ephinta_source_${randomUUID().replace(/-/g, "")}`;
  const order = await prisma.sourceAccessOrder.create({
    data: {
      userId: req.user!.id,
      providerRef: reference,
      amountMinor: PRICE_MINOR,
      currency: CURRENCY,
      status: SourceAccessOrderStatus.PENDING,
    },
  });

  try {
    const callback = new URL("/source-access/complete", env.APP_BASE_URL);
    callback.searchParams.set("reference", reference);
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: req.user!.email,
        amount: Number(PRICE_MINOR),
        currency: CURRENCY,
        reference,
        callback_url: callback.toString(),
        metadata: {
          product_code: PRODUCT_CODE,
          order_id: order.id,
          buyer_id: req.user!.id,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json() as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string };
    };
    if (!response.ok || !payload.status || payload.data?.reference !== reference || !payload.data.authorization_url) {
      throw new Error(payload.message || "Paystack did not return a valid checkout session.");
    }
    const checkoutUrl = new URL(payload.data.authorization_url);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.paystack.com" || checkoutUrl.username || checkoutUrl.password) {
      throw new Error("Paystack returned an untrusted checkout URL.");
    }
    res.status(201).json({
      order: { id: order.id, reference, amountMinor: PRICE_MINOR.toString(), currency: CURRENCY, status: order.status },
      checkoutUrl: checkoutUrl.toString(),
      mode: "test",
      productCode: PRODUCT_CODE,
    });
  } catch (error) {
    await prisma.sourceAccessOrder.updateMany({
      where: { id: order.id, status: SourceAccessOrderStatus.PENDING },
      data: { status: SourceAccessOrderStatus.CANCELLED },
    });
    throw error;
  }
}));

sourceAccessRouter.get("/orders/:reference", requireAuth, asyncHandler(async (req, res) => {
  const order = await prisma.sourceAccessOrder.findFirst({
    where: { providerRef: req.params.reference, userId: req.user!.id },
    select: { id: true, providerRef: true, amountMinor: true, currency: true, status: true, paidAt: true, createdAt: true },
  });
  if (!order) throw new HttpError(404, "SOURCE_ACCESS_ORDER_NOT_FOUND", "Source-access order not found.");
  res.setHeader("Cache-Control", "no-store");
  res.json({
    order: {
      id: order.id,
      reference: order.providerRef,
      amountMinor: order.amountMinor.toString(),
      currency: order.currency,
      status: order.status,
      paidAt: order.paidAt,
      releaseStatus: order.status === SourceAccessOrderStatus.PAID_PENDING_RELEASE ? "AWAITING_APPROVED_PACKAGE_RELEASE" : "NOT_PAID",
    },
  });
}));

sourceAccessRouter.post("/webhooks/paystack", asyncHandler(async (req, res) => {
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
  const signature = String(req.headers["x-paystack-signature"] || "");
  const timestampedSignature = String(req.headers["paystack-signature"] || "");
  const secret = env.PAYSTACK_WEBHOOK_SECRET || env.PAYSTACK_SECRET_KEY;
  if (!rawBody || !secret) throw new HttpError(503, "PAYSTACK_WEBHOOK_NOT_CONFIGURED", "Paystack webhook verification is not configured.");
  const valid = (signature && verifyPaystackSignature(rawBody, signature, secret)) ||
    (timestampedSignature && verifyPaystackWebhookSignature(rawBody, timestampedSignature, secret));
  if (!valid) throw new HttpError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid Paystack webhook signature.");

  if (String(req.body?.event || "") !== "charge.success") {
    return res.status(200).json({ received: true, ignored: true });
  }
  const reference = String(req.body?.data?.reference || "");
  if (!reference) throw new HttpError(400, "PAYSTACK_REFERENCE_MISSING", "Paystack event is missing its transaction reference.");
  const order = await prisma.sourceAccessOrder.findUnique({ where: { providerRef: reference } });
  if (!order) return res.status(200).json({ received: true, ignored: true });

  if (order.status === SourceAccessOrderStatus.PAID_PENDING_RELEASE) {
    return res.status(200).json({ received: true, duplicate: true });
  }
  if (order.status !== SourceAccessOrderStatus.PENDING) {
    return res.status(200).json({ received: true, ignored: true });
  }

  const verified = await verifyPaystack(reference);
  assertVerifiedPayment(verified, { amountMinor: order.amountMinor, currency: order.currency }, reference);
  const updated = await prisma.sourceAccessOrder.updateMany({
    where: { id: order.id, status: SourceAccessOrderStatus.PENDING },
    data: { status: SourceAccessOrderStatus.PAID_PENDING_RELEASE, paidAt: new Date() },
  });
  res.status(200).json({ received: true, recorded: updated.count === 1 });
}));
