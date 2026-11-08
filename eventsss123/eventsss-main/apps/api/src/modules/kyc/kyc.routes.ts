import { Router } from "express";
import { VerificationKind, VerificationStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hasRole, requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { getKycProfile, listKycCountries, type DocType } from "../../lib/kyc-countries";
import { readKycDocument, storeKycDocument } from "../../lib/kyc-storage";
import { bytidRequest, verifyBytidWebhook } from "../../lib/bytid";

export const kycRouter = Router();

kycRouter.get("/bytid/config", (_req, res) => {
  const key = process.env.BYTID_API_KEY?.trim() || "";
  res.json({
    enabled: key.startsWith("uvk_test_") || (key.startsWith("uvk_live_") && process.env.BYTID_ALLOW_LIVE === "true"),
    mode: key.startsWith("uvk_live_") && process.env.BYTID_ALLOW_LIVE === "true" ? "live" : "sandbox",
    requireDocument: process.env.BYTID_REQUIRE_DOCUMENT === "true",
  });
});

type BytidKycData = {
  id: string;
  reference: string;
  url?: string;
  environment?: string;
  expires_at?: string;
  status?: string;
  outcome?: string | null;
  require_document?: boolean;
  verification?: { status?: string; face_match?: { status?: string; liveness?: string } } | null;
  liveness?: { status?: string } | null;
  document?: { status?: string } | null;
};

function bytidOutcomeIsVerified(data: BytidKycData, requireDocument = data.require_document === true) {
  return data.status === "completed"
    && data.outcome === "verified"
    && data.verification?.status === "verified"
    && data.verification.face_match?.status === "matched"
    && data.verification.face_match.liveness === "passed"
    && data.liveness?.status === "passed"
    && (!requireDocument || data.document?.status === "verified");
}

function bytidOutcomeIsRejected(data: BytidKycData, requireDocument = data.require_document === true) {
  if (["face_mismatch", "face_unavailable", "liveness_failed", "not_found", "error", "document_rejected", "document_mismatch"].includes(data.outcome || "")) return true;
  if (data.status !== "completed" || data.outcome !== "verified") return false;
  // A webhook may contain a summary outcome before all nested detail fields.
  // Do not reject an otherwise verified session until an explicit failed check
  // is present; the authenticated status endpoint can fetch the full result.
  if (data.verification?.status && data.verification.status !== "verified") return true;
  if (data.verification?.face_match?.status && data.verification.face_match.status !== "matched") return true;
  if (data.verification?.face_match?.liveness && data.verification.face_match.liveness !== "passed") return true;
  if (data.liveness?.status && data.liveness.status !== "passed") return true;
  if (requireDocument && data.document?.status && data.document.status !== "verified") return true;
  return false;
}

/** Public provider webhook. Raw-body HMAC validation is mandatory. */
kycRouter.post("/bytid/webhook", asyncHandler(async (req, res) => {
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
  if (!verifyBytidWebhook(rawBody, req.header("Bytid-Signature"))) {
    throw new HttpError(401, "INVALID_PROVIDER_SIGNATURE", "Invalid provider webhook signature.");
  }
  const eventId = req.header("Bytid-Event-Id") || (typeof req.body?.id === "string" ? req.body.id : "");
  if (!eventId || eventId.length > 160) throw new HttpError(400, "INVALID_PROVIDER_EVENT", "Provider event ID is missing.");
  const prior = await prisma.auditLog.findFirst({ where: { entity: "BytidWebhookEvent", entityId: eventId } });
  if (prior) return res.status(200).json({ received: true, duplicate: true });

  const eventType = typeof req.body?.type === "string" ? req.body.type : req.header("Bytid-Event");
  const data = req.body?.data as BytidKycData | undefined;
  if (eventType === "kyc.completed" && data && typeof data.reference === "string") {
    const match = /^ephinta-([0-9a-f-]{36})$/.exec(data.reference);
    if (match) {
      const request = await prisma.verificationRequest.findUnique({ where: { id: match[1] } });
      if (request && request.status === VerificationStatus.PENDING) {
        const consentAudit = await prisma.auditLog.findFirst({ where: { entity: "VerificationRequest", entityId: request.id, action: "BYTID_KYC_CONSENT" } });
        const consentMeta = consentAudit?.meta as { requireDocument?: boolean } | null;
        if (bytidOutcomeIsVerified(data, consentMeta?.requireDocument === true)) {
          await prisma.verificationRequest.update({ where: { id: request.id }, data: { status: VerificationStatus.VERIFIED, notes: "Identity verified by Bytid hosted KYC." } });
        } else if (bytidOutcomeIsRejected(data, consentMeta?.requireDocument === true)) {
          await prisma.verificationRequest.update({ where: { id: request.id }, data: { status: VerificationStatus.REJECTED, notes: `Bytid KYC outcome: ${(data.outcome || "unknown").slice(0, 100)}` } });
        }
      }
    }
  }
  await prisma.auditLog.create({ data: {
    action: "BYTID_WEBHOOK_RECEIVED",
    entity: "BytidWebhookEvent",
    entityId: eventId,
    meta: { eventType: String(eventType || "unknown").slice(0, 80) },
  } });
  return res.status(200).json({ received: true });
}));


/** Public country matrix — 170+ markets */
kycRouter.get(
  "/countries",
  asyncHandler(async (req, res) => {
    const region = typeof req.query.region === "string" ? req.query.region : undefined;
    const items = listKycCountries(region as never);
    res.json({ count: items.length, items });
  }),
);

kycRouter.get(
  "/countries/:code",
  asyncHandler(async (req, res) => {
    const profile = getKycProfile(req.params.code);
    res.json({ profile });
  }),
);

kycRouter.use(requireAuth);

/** Start hosted BVN/NIN + liveness + face-match verification for the signed-in user. */
kycRouter.post("/bytid/requests", asyncHandler(async (req, res) => {
  if (req.body?.consent !== true) {
    throw new HttpError(400, "KYC_CONSENT_REQUIRED", "You must consent to identity verification before continuing.");
  }
  if (!process.env.BYTID_API_KEY?.trim()) {
    throw new HttpError(503, "KYC_PROVIDER_NOT_CONFIGURED", "Identity verification is not configured yet.");
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true } });
  if (!user) throw new HttpError(404, "USER_NOT_FOUND", "Account not found.");
  const redirect = new URL("/", process.env.APP_BASE_URL || "http://localhost:4173");
  redirect.searchParams.set("kyc", "bytid");
  redirect.searchParams.set("requestId", "pending");
  if (redirect.protocol !== "https:" && redirect.hostname !== "localhost") {
    throw new HttpError(503, "KYC_REDIRECT_MISCONFIGURED", "The application return URL must use HTTPS.");
  }

  const existingPending = await prisma.verificationRequest.findFirst({
    where: { userId: user.id, kind: VerificationKind.IDENTITY, status: VerificationStatus.PENDING, notes: { startsWith: "Identity verification initiated with Bytid." } },
    select: { id: true },
  });
  if (existingPending) {
    throw new HttpError(409, "KYC_ALREADY_PENDING", "You already have an identity verification in progress. Check its status before starting another.");
  }
  const request = await prisma.verificationRequest.create({
    data: { userId: user.id, kind: VerificationKind.IDENTITY, status: VerificationStatus.PENDING, notes: "Identity verification initiated with Bytid." },
  });
  redirect.searchParams.set("requestId", request.id);
  const reference = `ephinta-${request.id}`;
  await prisma.auditLog.create({ data: {
    actorId: user.id,
    action: "BYTID_KYC_CONSENT",
    entity: "VerificationRequest",
    entityId: request.id,
    ip: req.ip,
    meta: { provider: "BYTID", consent: true, consentVersion: "2026-11-08", requireDocument: process.env.BYTID_REQUIRE_DOCUMENT === "true" },
  } });
  try {
    const providerRequest = await bytidRequest<BytidKycData & { url?: string }>("kyc/requests", "POST", {
      reference,
      id_types: ["bvn", "nin", "drivers_license", "voters_card", "bvn_igree"],
      customer_name: user.name,
      customer_email: user.email,
      redirect_url: redirect.toString(),
      require_document: process.env.BYTID_REQUIRE_DOCUMENT === "true",
    });
    if (!providerRequest.id || !providerRequest.url || !providerRequest.url.startsWith("https://")) {
      throw new HttpError(502, "KYC_PROVIDER_INVALID_RESPONSE", "The identity provider returned an incomplete verification link.");
    }
    await prisma.auditLog.create({ data: {
      actorId: user.id,
      action: "BYTID_KYC_STARTED",
      entity: "VerificationRequest",
      entityId: request.id,
      meta: { provider: "BYTID", providerRequestId: providerRequest.id, reference, environment: providerRequest.environment || "unknown", requireDocument: process.env.BYTID_REQUIRE_DOCUMENT === "true" },
    } });
    return res.status(201).json({ requestId: request.id, provider: "BYTID", status: providerRequest.status || "pending", verificationUrl: providerRequest.url, expiresAt: providerRequest.expires_at || null });
  } catch (error) {
    await prisma.verificationRequest.update({ where: { id: request.id }, data: { status: VerificationStatus.REJECTED, notes: "Identity verification could not be started. Please retry." } });
    throw error;
  }
}));

/** Refresh a provider result; only a complete liveness + face-match result can approve identity. */
kycRouter.get("/bytid/requests/:id", asyncHandler(async (req, res) => {
  const request = await prisma.verificationRequest.findFirst({ where: { id: req.params.id, userId: req.user!.id, kind: VerificationKind.IDENTITY } });
  if (!request) throw new HttpError(404, "KYC_REQUEST_NOT_FOUND", "Identity verification request not found.");
  const started = await prisma.auditLog.findFirst({ where: { entity: "VerificationRequest", entityId: request.id, action: "BYTID_KYC_STARTED" } });
  const meta = started?.meta as { providerRequestId?: string } | null;
  if (!meta?.providerRequestId) throw new HttpError(409, "KYC_PROVIDER_SESSION_MISSING", "No active provider session is linked to this request.");
  const result = await bytidRequest<BytidKycData>(`kyc/requests/${encodeURIComponent(meta.providerRequestId)}`, "GET");
  const consentAudit = await prisma.auditLog.findFirst({ where: { entity: "VerificationRequest", entityId: request.id, action: "BYTID_KYC_CONSENT" } });
  const consentMeta = consentAudit?.meta as { requireDocument?: boolean } | null;
  if (request.status === VerificationStatus.PENDING && bytidOutcomeIsVerified(result, consentMeta?.requireDocument === true)) {
    await prisma.verificationRequest.update({ where: { id: request.id }, data: { status: VerificationStatus.VERIFIED, notes: "Identity verified by Bytid hosted KYC." } });
  } else if (request.status === VerificationStatus.PENDING && bytidOutcomeIsRejected(result, consentMeta?.requireDocument === true)) {
    await prisma.verificationRequest.update({ where: { id: request.id }, data: { status: VerificationStatus.REJECTED, notes: `Bytid KYC outcome: ${(result.outcome || "unknown").slice(0, 100)}` } });
  }
  const latest = await prisma.verificationRequest.findUnique({ where: { id: request.id }, select: { id: true, status: true, createdAt: true, reviewedAt: true } });
  return res.json({ request: latest, provider: "BYTID", providerStatus: result.status, outcome: result.outcome || null, faceMatch: result.verification?.face_match?.status || null, liveness: result.liveness?.status || null });
}));


kycRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const items = await prisma.verificationRequest.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  }),
);

/**
 * Global KYC submit.
 * Body:
 *  country (ISO), kind IDENTITY|BUSINESS,
 *  primaryDocType, documentUrl | documentBase64+fileName,
 *  nationalId?, addressDocUrl?, businessDocUrl?, notes?
 */
kycRouter.post(
  "/submit",
  asyncHandler(async (req, res) => {
    const country = String(req.body.country || "NG").toUpperCase();
    const profile = getKycProfile(country);
    if (req.body.kind !== "IDENTITY" && req.body.kind !== "BUSINESS") {
      throw new HttpError(400, "INVALID_KYC_KIND", "kind must be IDENTITY or BUSINESS");
    }
    const kind: VerificationKind =
      req.body.kind === "IDENTITY" ? VerificationKind.IDENTITY : VerificationKind.BUSINESS;

    const allowedDocTypes = kind === VerificationKind.IDENTITY ? profile.identityDocs : profile.businessDocs;
    const primaryDocType = String(req.body.primaryDocType || allowedDocTypes[0] || "") as DocType;
    const isAllowedDocType =
      allowedDocTypes.includes(primaryDocType) ||
      (kind === VerificationKind.IDENTITY && primaryDocType === "PASSPORT");
    if (!isAllowedDocType) {
      throw new HttpError(
        400,
        "INVALID_DOC_TYPE",
        `For ${profile.name}, accepted ${kind.toLowerCase()} docs: ${allowedDocTypes.join(", ")}`,
      );
    }

    if (typeof req.body.documentBase64 !== "string" || req.body.documentBase64.length <= 32) {
      throw new HttpError(400, "DOCUMENT_REQUIRED", "Upload a document using the secure document upload flow.");
    }
    const fileName = typeof req.body.fileName === "string" ? req.body.fileName : "document.pdf";
    const documentUrl = await storeKycDocument({
      base64: req.body.documentBase64,
      fileName,
    });

    const meta = {
      country,
      region: profile.region,
      currency: profile.currency,
      assurance: profile.assurance,
      primaryDocType,
      nationalIdLabel: profile.nationalIdLabel || null,
      addressDocUrl:
        typeof req.body.addressDocUrl === "string" ? req.body.addressDocUrl.slice(0, 500) : null,
      businessDocUrl:
        typeof req.body.businessDocUrl === "string" ? req.body.businessDocUrl.slice(0, 500) : null,
      requiredIdentityDocs: profile.identityDocs,
      requiredBusinessDocs: kind === VerificationKind.BUSINESS ? profile.businessDocs : [],
    };

    const notesParts = [
      typeof req.body.notes === "string" ? req.body.notes.slice(0, 400) : "",
      `country=${country}`,
      `doc=${primaryDocType}`,
    ].filter(Boolean);

    const request = await prisma.verificationRequest.create({
      data: {
        userId: req.user!.id,
        kind,
        status: VerificationStatus.PENDING,
        documentUrl,
        notes: notesParts.join(" | ").slice(0, 500),
      },
    });

    if (kind === VerificationKind.BUSINESS && hasRole(req.user, "VENDOR")) {
      await prisma.vendorProfile.updateMany({
        where: { userId: req.user!.id },
        data: { verification: VerificationStatus.PENDING },
      });
    }

    // Store structured meta in audit log for reviewers
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "KYC_SUBMIT",
        entity: "VerificationRequest",
        entityId: request.id,
        meta,
      },
    });

    res.status(201).json({
      request,
      profile: {
        country: profile.code,
        name: profile.name,
        region: profile.region,
        assurance: profile.assurance,
        identityDocs: profile.identityDocs,
        businessDocs: profile.businessDocs,
        addressProofDocs: profile.addressProofDocs,
        nationalIdLabel: profile.nationalIdLabel,
        notes: profile.notes,
      },
      nextSteps:
        profile.assurance === "ENHANCED"
          ? [
              "Keep passport or national ID ready for possible video/liveness check",
              "Address proof may be requested within 48h",
            ]
          : ["Review typically completes within 1–2 business days"],
    });
  }),
);

kycRouter.get(
  "/queue",
  requireRole("ADMIN", "CONSULTANT"),
  asyncHandler(async (_req, res) => {
    const items = await prisma.verificationRequest.findMany({
      where: { status: VerificationStatus.PENDING },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        user: { select: { id: true, email: true, name: true, role: true, country: true } },
      },
    });
    res.json({ items });
  }),
);

kycRouter.get(
  "/:id/document",
  requireRole("ADMIN", "CONSULTANT"),
  asyncHandler(async (req, res) => {
    const request = await prisma.verificationRequest.findUnique({ where: { id: req.params.id } });
    if (!request || !request.documentUrl?.startsWith("neon-kyc://")) {
      throw new HttpError(404, "KYC_DOCUMENT_NOT_FOUND", "Stored KYC document not found.");
    }
    const document = await readKycDocument(request.documentUrl);
    const extension = document.contentType === "application/pdf" ? "pdf" : document.contentType.split("/")[1];
    res.setHeader("Content-Type", document.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="kyc-${request.id}.${extension}"`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", String(document.bytes.length));
    res.status(200).send(document.bytes);
  }),
);

kycRouter.post(
  "/:id/review",
  requireRole("ADMIN", "CONSULTANT"),
  asyncHandler(async (req, res) => {
    const status =
      req.body.status === "VERIFIED"
        ? VerificationStatus.VERIFIED
        : req.body.status === "REJECTED"
          ? VerificationStatus.REJECTED
          : null;
    if (!status) throw new HttpError(400, "INVALID_STATUS", "status must be VERIFIED or REJECTED");

    const existing = await prisma.verificationRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new HttpError(404, "NOT_FOUND", "Request not found");

    const request = await prisma.verificationRequest.update({
      where: { id: existing.id },
      data: {
        status,
        notes: typeof req.body.notes === "string" ? req.body.notes : existing.notes,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
    });

    if (existing.kind === VerificationKind.BUSINESS) {
      await prisma.vendorProfile.updateMany({
        where: { userId: existing.userId },
        data: { verification: status },
      });
    }

    res.json({ request });
  }),
);
