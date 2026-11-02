import { Router } from "express";
import { VerificationKind, VerificationStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hasRole, requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { getKycProfile, listKycCountries, type DocType } from "../../lib/kyc-countries";
import { readKycDocument, storeKycDocument } from "../../lib/kyc-storage";

export const kycRouter = Router();

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
    const kind: VerificationKind =
      req.body.kind === "IDENTITY" ? VerificationKind.IDENTITY : VerificationKind.BUSINESS;

    const primaryDocType = String(req.body.primaryDocType || profile.identityDocs[0]) as DocType;
    if (!profile.identityDocs.includes(primaryDocType) && kind === VerificationKind.IDENTITY) {
      // allow passport always
      if (primaryDocType !== "PASSPORT") {
        throw new HttpError(
          400,
          "INVALID_DOC_TYPE",
          `For ${profile.name}, accepted identity docs: ${profile.identityDocs.join(", ")}`,
        );
      }
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
