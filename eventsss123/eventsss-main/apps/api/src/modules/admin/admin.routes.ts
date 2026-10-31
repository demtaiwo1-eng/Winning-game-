import { Router, type Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/async";
import { requireAuth, requireRole } from "../../middleware/auth";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/overview", asyncHandler(async (_req, res) => {
  const settledStatuses = ["PAID", "CONFIRMED", "FULFILLED"] as const;
  const [
    totalUsers,
    activeUsers,
    totalEvents,
    totalVendors,
    activeListings,
    pendingVerifications,
    disputedBookings,
    bookingsByStatus,
    settledByCurrency,
    activeListingCountries,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.event.count(),
    prisma.vendorProfile.count(),
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.verificationRequest.count({ where: { status: "PENDING" } }),
    prisma.booking.count({ where: { status: "DISPUTED" } }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["currency"],
      where: { status: { in: [...settledStatuses] } },
      _sum: { totalMinor: true },
    }),
    prisma.listing.findMany({
      where: { status: "ACTIVE", country: { not: null } },
      select: { country: true },
      distinct: ["country"],
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        actor: { select: { name: true, role: true } },
      },
    }),
  ]);

  res.json({
    accounts: { total: totalUsers, active: activeUsers },
    events: totalEvents,
    vendors: totalVendors,
    activeListings,
    activeMarkets: activeListingCountries.length,
    pendingVerifications,
    disputedBookings,
    bookingsByStatus: Object.fromEntries(bookingsByStatus.map(({ status, _count }) => [status, _count._all])),
    settledBookingValue: settledByCurrency.map(({ currency, _sum }) => ({
      currency,
      amountMinor: (_sum.totalMinor ?? 0n).toString(),
    })),
    recentAudit: recentAudit.map(({ id, action, entity, entityId, createdAt, actor }) => ({
      id,
      action,
      entity,
      entityId,
      createdAt,
      actor,
    })),
  });
}));

const paymentStatuses = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"] as const;
const ledgerTypes = ["DEPOSIT", "WITHDRAWAL", "ESCROW_HOLD", "ESCROW_RELEASE", "ESCROW_REFUND", "COMMISSION", "SUBSCRIPTION", "ADJUSTMENT"] as const;

function financePageParams(query: Record<string, unknown>) {
  const page = typeof query.page === "string" && /^\d+$/.test(query.page) ? Math.max(1, Number(query.page)) : 1;
  const requestedLimit = typeof query.limit === "string" && /^\d+$/.test(query.limit) ? Number(query.limit) : 25;
  const limit = Math.min(100, Math.max(1, requestedLimit));
  const from = typeof query.from === "string" ? new Date(query.from) : undefined;
  const to = typeof query.to === "string" ? new Date(query.to) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return { error: "Invalid date filter" as const };
  }
  if (from && to && from > to) return { error: "The from date must be before the to date" as const };
  return { page, limit, from, to };
}

/** Read-only finance feed. This route never changes balances or payment state. */
adminRouter.get("/finance/payment-intents", asyncHandler(async (req, res) => {
  const params = financePageParams(req.query as Record<string, unknown>);
  if ("error" in params) return res.status(400).json({ error: { code: "INVALID_FILTER", message: params.error } });
  const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
  if (status && !paymentStatuses.includes(status as typeof paymentStatuses[number])) {
    return res.status(400).json({ error: { code: "INVALID_FILTER", message: "Unsupported payment status" } });
  }
  const provider = typeof req.query.provider === "string" ? req.query.provider.trim().toLowerCase() : undefined;
  const currency = typeof req.query.currency === "string" ? req.query.currency.trim().toUpperCase() : undefined;
  const where = {
    ...(status ? { status: status as typeof paymentStatuses[number] } : {}),
    ...(provider ? { provider } : {}),
    ...(currency ? { currency } : {}),
    ...(params.from || params.to ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } } : {}),
  };
  const [total, items, grouped] = await Promise.all([
    prisma.paymentIntent.count({ where }),
    prisma.paymentIntent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true, provider: true, providerRef: true, amountMinor: true, currency: true,
        status: true, purpose: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.paymentIntent.groupBy({
      by: ["provider", "currency", "status"],
      where,
      _count: { _all: true },
      _sum: { amountMinor: true },
    }),
  ]);
  res.json({
    page: params.page,
    limit: params.limit,
    total,
    pages: Math.ceil(total / params.limit),
    summary: grouped.map((row) => ({
      provider: row.provider, currency: row.currency, status: row.status,
      count: row._count._all, amountMinor: (row._sum.amountMinor ?? 0n).toString(),
    })),
    items: items.map((item) => ({ ...item, amountMinor: item.amountMinor.toString() })),
  });
}));

/** Read-only wallet ledger feed; balances are sourced from append-only ledger rows. */
adminRouter.get("/finance/ledger", asyncHandler(async (req, res) => {
  const params = financePageParams(req.query as Record<string, unknown>);
  if ("error" in params) return res.status(400).json({ error: { code: "INVALID_FILTER", message: params.error } });
  const type = typeof req.query.type === "string" ? req.query.type.toUpperCase() : undefined;
  if (type && !ledgerTypes.includes(type as typeof ledgerTypes[number])) {
    return res.status(400).json({ error: { code: "INVALID_FILTER", message: "Unsupported ledger type" } });
  }
  const currency = typeof req.query.currency === "string" ? req.query.currency.trim().toUpperCase() : undefined;
  const where = {
    ...(type ? { type: type as typeof ledgerTypes[number] } : {}),
    ...(params.from || params.to ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } } : {}),
    ...(currency ? { wallet: { currency } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      select: {
        id: true, type: true, amountMinor: true, balanceAfterMinor: true,
        refType: true, refId: true, createdAt: true,
        wallet: { select: { currency: true, user: { select: { id: true, name: true, email: true } } } },
      },
    }),
  ]);
  res.json({
    page: params.page, limit: params.limit, total, pages: Math.ceil(total / params.limit),
    items: items.map((item) => ({
      ...item,
      amountMinor: item.amountMinor.toString(),
      balanceAfterMinor: item.balanceAfterMinor.toString(),
    })),
  });
}));


/**
 * Read-only reconciliation exceptions for finance operators.
 * Reports stale pending intents and successful deposits whose ledger rows
 * are missing or do not add up to the gross payment amount.
 */
adminRouter.get("/finance/reconciliation", asyncHandler(async (req, res) => {
  const rawAge = typeof req.query.olderThanMinutes === "string" ? req.query.olderThanMinutes : "10";
  if (!/^\d+$/.test(rawAge)) {
    return res.status(400).json({ error: { code: "INVALID_FILTER", message: "olderThanMinutes must be an integer from 5 to 1440" } });
  }
  const olderThanMinutes = Number(rawAge);
  if (!Number.isSafeInteger(olderThanMinutes) || olderThanMinutes < 5 || olderThanMinutes > 1440) {
    return res.status(400).json({ error: { code: "INVALID_FILTER", message: "olderThanMinutes must be an integer from 5 to 1440" } });
  }

  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const succeededWhere = { status: "SUCCEEDED" as const, purpose: "WALLET_DEPOSIT" };
  const [stalePendingCount, stalePending, succeededCount, succeededIntents] = await Promise.all([
    prisma.paymentIntent.count({ where: { status: "PENDING", createdAt: { lt: cutoff } } }),
    prisma.paymentIntent.findMany({
      where: { status: "PENDING", createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: { id: true, provider: true, amountMinor: true, currency: true, createdAt: true },
    }),
    prisma.paymentIntent.count({ where: succeededWhere }),
    prisma.paymentIntent.findMany({
      where: succeededWhere,
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, provider: true, amountMinor: true, currency: true, createdAt: true },
    }),
  ]);

  const intentIds = succeededIntents.map((intent) => intent.id);
  const ledgerRows = intentIds.length === 0 ? [] : await prisma.ledgerEntry.findMany({
    where: { refType: "PAYMENT_INTENT", refId: { in: intentIds }, type: { in: ["DEPOSIT", "COMMISSION"] } },
    select: { refId: true, type: true, amountMinor: true },
  });
  const ledgerByIntent = new Map<string, { depositCount: number; totalMinor: bigint }>();
  for (const entry of ledgerRows) {
    if (!entry.refId) continue;
    const current = ledgerByIntent.get(entry.refId) ?? { depositCount: 0, totalMinor: 0n };
    if (entry.type === "DEPOSIT") current.depositCount += 1;
    current.totalMinor += entry.amountMinor;
    ledgerByIntent.set(entry.refId, current);
  }
  const ledgerExceptions = succeededIntents.flatMap((intent) => {
    const ledger = ledgerByIntent.get(intent.id) ?? { depositCount: 0, totalMinor: 0n };
    if (ledger.depositCount === 1 && ledger.totalMinor === intent.amountMinor) return [];
    return [{
      paymentIntentId: intent.id,
      provider: intent.provider,
      currency: intent.currency,
      expectedGrossMinor: intent.amountMinor.toString(),
      recordedLedgerMinor: ledger.totalMinor.toString(),
      depositEntryCount: ledger.depositCount,
    }];
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({
    generatedAt: new Date().toISOString(),
    olderThanMinutes,
    stalePending: {
      total: stalePendingCount,
      sampleLimit: 50,
      items: stalePending.map((intent) => ({
        paymentIntentId: intent.id,
        provider: intent.provider,
        amountMinor: intent.amountMinor.toString(),
        currency: intent.currency,
        createdAt: intent.createdAt,
      })),
    },
    succeededDepositLedger: {
      scanned: succeededIntents.length,
      totalSucceeded: succeededCount,
      scanTruncated: succeededCount > succeededIntents.length,
      exceptionCountInScan: ledgerExceptions.length,
      exceptions: ledgerExceptions,
    },
    readOnly: true,
  });
}));


const financeExportLimit = 5000;
function csvCell(value: unknown): string {
  const isTextInput = typeof value === "string";
  let text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  // Spreadsheet formula injection applies to untrusted text, not typed numeric
  // values. Preserve legitimate negative ledger amounts as numeric CSV cells.
  if (isTextInput && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
function financeCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
function exportFilters(query: Record<string, unknown>): { page: number; limit: number; from: Date | undefined; to: Date | undefined; status: typeof paymentStatuses[number] | undefined; type: typeof ledgerTypes[number] | undefined; provider: string | undefined; currency: string | undefined } | { error: string } {
  const params = financePageParams(query);
  if ("error" in params) return { error: String(params.error ?? "Invalid finance export filter") };
  const status = typeof query.status === "string" ? query.status.toUpperCase() : undefined;
  const type = typeof query.type === "string" ? query.type.toUpperCase() : undefined;
  if (status && !paymentStatuses.includes(status as typeof paymentStatuses[number])) return { error: "Unsupported payment status" as const };
  if (type && !ledgerTypes.includes(type as typeof ledgerTypes[number])) return { error: "Unsupported ledger type" as const };
  const provider = typeof query.provider === "string" ? query.provider.trim().toLowerCase() : undefined;
  const currency = typeof query.currency === "string" ? query.currency.trim().toUpperCase() : undefined;
  if ((provider && provider.length > 40) || (currency && !/^[A-Z]{3}$/.test(currency))) return { error: "Invalid provider or currency filter" as const };
  return { ...params, status: status as typeof paymentStatuses[number] | undefined, type: type as typeof ledgerTypes[number] | undefined, provider, currency };
}
function auditExport(req: Request, entity: string, rowCount: number, truncated: boolean, filters: Prisma.InputJsonObject) {
  const actorId: string = req.user?.id ?? "";
  if (actorId.length === 0) throw new Error("Authenticated admin context is missing for finance export audit");
  return prisma.auditLog.create({
    data: { actorId, action: "FINANCE_EXPORT", entity, meta: { rowCount, truncated, filters }, ip: req.ip ?? "unknown" },
  });
}

adminRouter.get("/finance/payment-intents/export.csv", asyncHandler(async (req, res) => {
  const filters = exportFilters(req.query as Record<string, unknown>);
  if ("error" in filters) return res.status(400).json({ error: { code: "INVALID_FILTER", message: filters.error } });
  const where = {
    ...(filters.status ? { status: filters.status as typeof paymentStatuses[number] } : {}),
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
  };
  const rows = await prisma.paymentIntent.findMany({
    where, orderBy: { createdAt: "desc" }, take: financeExportLimit + 1,
    select: { id: true, provider: true, providerRef: true, amountMinor: true, currency: true, status: true, purpose: true, createdAt: true },
  });
  const truncated = rows.length > financeExportLimit;
  const selected = rows.slice(0, financeExportLimit);
  await auditExport(req, "PaymentIntent", selected.length, truncated, {
    status: filters.status ?? null, provider: filters.provider ?? null, currency: filters.currency ?? null,
    from: filters.from?.toISOString() ?? null, to: filters.to?.toISOString() ?? null,
  });
  const csv = financeCsv(["id", "provider", "providerRef", "amountMinor", "currency", "status", "purpose", "createdAt"],
    selected.map((row) => [row.id, row.provider, row.providerRef, row.amountMinor.toString(), row.currency, row.status, row.purpose, row.createdAt]));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="ephinta-payment-intents.csv"');
  res.setHeader("X-Export-Truncated", String(truncated));
  return res.send(csv);
}));

adminRouter.get("/finance/ledger/export.csv", asyncHandler(async (req, res) => {
  const filters = exportFilters(req.query as Record<string, unknown>);
  if ("error" in filters) return res.status(400).json({ error: { code: "INVALID_FILTER", message: filters.error } });
  const where = {
    ...(filters.type ? { type: filters.type as typeof ledgerTypes[number] } : {}),
    ...(filters.currency ? { wallet: { currency: filters.currency } } : {}),
    ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
  };
  const rows = await prisma.ledgerEntry.findMany({
    where, orderBy: { createdAt: "desc" }, take: financeExportLimit + 1,
    select: { id: true, type: true, amountMinor: true, balanceAfterMinor: true, refType: true, refId: true, createdAt: true, wallet: { select: { currency: true } } },
  });
  const truncated = rows.length > financeExportLimit;
  const selected = rows.slice(0, financeExportLimit);
  await auditExport(req, "LedgerEntry", selected.length, truncated, {
    type: filters.type ?? null, currency: filters.currency ?? null,
    from: filters.from?.toISOString() ?? null, to: filters.to?.toISOString() ?? null,
  });
  const csv = financeCsv(["id", "type", "amountMinor", "balanceAfterMinor", "currency", "refType", "refId", "createdAt"],
    selected.map((row) => [row.id, row.type, row.amountMinor.toString(), row.balanceAfterMinor.toString(), row.wallet.currency, row.refType, row.refId, row.createdAt]));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="ephinta-wallet-ledger.csv"');
  res.setHeader("X-Export-Truncated", String(truncated));
  return res.send(csv);
}));

// Phase 4.2: maker-checker approval records. These endpoints only record
// decisions; they deliberately do not execute payouts, refunds, or transfers.
const approvalActions = ["PAYOUT", "REFUND", "LEDGER_ADJUSTMENT"] as const;
const approvalMaxMinor = (() => {
  const configured = process.env.ADMIN_APPROVAL_MAX_MINOR;
  if (!configured) return 100_000_000n;
  if (!/^[1-9]\d*$/.test(configured)) throw new Error("ADMIN_APPROVAL_MAX_MINOR must be a positive integer");
  return BigInt(configured);
})();

adminRouter.get("/approvals", asyncHandler(async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
  if (status && !["PENDING", "APPROVED", "REJECTED", "EXPIRED"].includes(status)) {
    return res.status(400).json({ error: { code: "INVALID_APPROVAL_STATUS", message: "Unsupported approval status" } });
  }
  const items = await prisma.adminApproval.findMany({
    where: status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.setHeader("Cache-Control", "no-store");
  return res.json({ items: items.map((item) => ({ ...item, amountMinor: item.amountMinor?.toString() ?? null })) });
}));

adminRouter.post("/approvals", asyncHandler(async (req, res) => {
  const action = typeof req.body.action === "string" ? req.body.action.toUpperCase() : "";
  const entity = typeof req.body.entity === "string" ? req.body.entity.trim() : "";
  const entityId = typeof req.body.entityId === "string" ? req.body.entityId.trim() : "";
  const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
  const idempotencyKey = typeof req.body.idempotencyKey === "string" ? req.body.idempotencyKey.trim() : "";
  const currency = typeof req.body.currency === "string" ? req.body.currency.trim().toUpperCase() : null;
  const rawAmount = req.body.amountMinor === undefined || req.body.amountMinor === null ? null : String(req.body.amountMinor);

  if (!approvalActions.includes(action as typeof approvalActions[number]) ||
      !entity || entity.length > 80 || !entityId || entityId.length > 120 ||
      reason.length < 8 || reason.length > 1000 ||
      !/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey) ||
      (currency !== null && !/^[A-Z]{3}$/.test(currency)) ||
      (rawAmount !== null && !/^[1-9]\d*$/.test(rawAmount))) {
    return res.status(400).json({ error: { code: "INVALID_APPROVAL_REQUEST", message: "Provide a valid action, entity, entityId, reason, idempotencyKey, and optional positive amount/currency" } });
  }
  const amountMinor = rawAmount === null ? null : BigInt(rawAmount);
  if (amountMinor !== null && amountMinor > approvalMaxMinor) {
    return res.status(400).json({ error: { code: "APPROVAL_LIMIT_EXCEEDED", message: "Requested amount exceeds the configured approval limit" } });
  }
  if (amountMinor !== null && !currency) {
    return res.status(400).json({ error: { code: "CURRENCY_REQUIRED", message: "Currency is required when an amount is supplied" } });
  }

  const existing = await prisma.adminApproval.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.requestedById !== req.user!.id || existing.action !== action ||
        existing.entity !== entity || existing.entityId !== entityId ||
        existing.amountMinor !== amountMinor || existing.currency !== currency) {
      return res.status(409).json({ error: { code: "IDEMPOTENCY_CONFLICT", message: "This idempotency key was already used for a different approval request" } });
    }
    return res.status(200).json({ approval: { ...existing, amountMinor: existing.amountMinor?.toString() ?? null }, replayed: true });
  }

  const approval = await prisma.$transaction(async (tx) => {
    const created = await tx.adminApproval.create({
      data: {
        action, entity, entityId, reason, idempotencyKey, amountMinor, currency,
        requestedById: req.user!.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "ADMIN_APPROVAL_REQUESTED",
        entity: "AdminApproval",
        entityId: created.id,
        ip: req.ip ?? "unknown",
        meta: { action, entity, entityId, amountMinor: amountMinor?.toString() ?? null, currency },
      },
    });
    return created;
  });
  return res.status(201).json({ approval: { ...approval, amountMinor: approval.amountMinor?.toString() ?? null } });
}));

adminRouter.post("/approvals/:id/decision", asyncHandler(async (req, res) => {
  const decision = typeof req.body.decision === "string" ? req.body.decision.toUpperCase() : "";
  const note = typeof req.body.note === "string" ? req.body.note.trim() : "";
  if (!["APPROVE", "REJECT"].includes(decision) || note.length < 3 || note.length > 1000) {
    return res.status(400).json({ error: { code: "INVALID_APPROVAL_DECISION", message: "Decision must be APPROVE or REJECT with a short note" } });
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.adminApproval.findUnique({ where: { id: req.params.id } });
    if (!current) return { error: "NOT_FOUND" as const };
    if (current.requestedById === req.user!.id) return { error: "MAKER_CANNOT_APPROVE" as const };
    if (current.status !== "PENDING") return { error: "ALREADY_DECIDED" as const };
    if (current.expiresAt <= now) {
      await tx.adminApproval.updateMany({ where: { id: current.id, status: "PENDING" }, data: { status: "EXPIRED" } });
      return { error: "EXPIRED" as const };
    }
    const updated = await tx.adminApproval.updateMany({
      where: { id: current.id, status: "PENDING", expiresAt: { gt: now }, requestedById: { not: req.user!.id } },
      data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", decidedById: req.user!.id, decisionNote: note },
    });
    if (updated.count !== 1) return { error: "ALREADY_DECIDED" as const };
    const approval = await tx.adminApproval.findUniqueOrThrow({ where: { id: current.id } });
    await tx.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: decision === "APPROVE" ? "ADMIN_APPROVAL_APPROVED" : "ADMIN_APPROVAL_REJECTED",
        entity: "AdminApproval",
        entityId: approval.id,
        ip: req.ip ?? "unknown",
        meta: { requestedById: approval.requestedById, action: approval.action, entity: approval.entity, entityId: approval.entityId },
      },
    });
    return { approval };
  });

  if ("error" in result) {
    const statusCode = result.error === "NOT_FOUND" ? 404 : result.error === "MAKER_CANNOT_APPROVE" ? 403 : 409;
    return res.status(statusCode).json({ error: { code: result.error, message: result.error === "MAKER_CANNOT_APPROVE" ? "The requester cannot approve their own request" : result.error === "EXPIRED" ? "Approval request has expired" : result.error === "NOT_FOUND" ? "Approval request not found" : "Approval request has already been decided" } });
  }
  return res.json({ approval: { ...result.approval, amountMinor: result.approval.amountMinor?.toString() ?? null } });
}));

