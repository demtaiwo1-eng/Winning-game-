import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../lib/async";
import { HttpError } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { allocateMusicRoyalties, MUSIC_RIGHTS_OWNER_SHARE_BPS } from "./royaltyPolicy";

export const musicDspRouter = Router();

musicDspRouter.post("/plays", requireAuth, asyncHandler(async (req, res) => {
  const key = typeof req.body.trackKey === "string" ? req.body.trackKey : "";
  const seconds = Number(req.body.listenedSeconds);
  if (!/^[a-z0-9-]{3,80}$/.test(key) || !Number.isSafeInteger(seconds) || seconds < 5 || seconds > 3600) {
    throw new HttpError(400, "INVALID_PLAY_SESSION", "A track key and 5–3,600 listened seconds are required.");
  }
  const track = await prisma.musicTrack.findFirst({ where: { key, active: true }, select: { id: true } });
  if (!track) throw new HttpError(404, "TRACK_NOT_FOUND", "This music track is not registered for usage reporting.");
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentUsage = await prisma.musicPlaySession.aggregate({
    where: { userId: req.user!.id, playedAt: { gte: hourAgo } },
    _sum: { listenedSeconds: true },
  });
  if ((recentUsage._sum.listenedSeconds ?? 0) + seconds > 3600) {
    throw new HttpError(429, "LISTENING_TIME_LIMIT", "Listening reports are limited to one hour per account in a rolling hour.");
  }
  await prisma.musicPlaySession.create({ data: { trackId: track.id, userId: req.user!.id, listenedSeconds: seconds } });
  res.status(201).json({ recorded: true });
}));

musicDspRouter.get("/owner/summary", requireAuth, requireRole("AFFILIATE"), asyncHandler(async (req, res) => {
  const owner = await prisma.musicRightsOwner.findUnique({ where: { userId: req.user!.id } });
  if (!owner) throw new HttpError(404, "MUSIC_RIGHTS_PROFILE_NOT_LINKED", "Your account has not yet been linked to a music rights profile. Contact EPHINTA support.");
  const [tracks, playGroups, statements] = await Promise.all([
    prisma.musicTrack.findMany({ where: { rightsOwnerId: owner.id }, orderBy: { title: "asc" } }),
    prisma.musicPlaySession.groupBy({ by: ["trackId"], where: { track: { rightsOwnerId: owner.id } }, _count: { _all: true }, _sum: { listenedSeconds: true } }),
    prisma.musicRoyaltyStatement.findMany({ where: { ownerId: owner.id }, orderBy: { periodStart: "desc" }, take: 24 }),
  ]);
  const byTrack = new Map<string, (typeof playGroups)[number]>(playGroups.map((p) => [p.trackId, p] as const));
  const totalPlays = playGroups.reduce((sum, p) => sum + p._count._all, 0);
  const totalSeconds = playGroups.reduce((sum, p) => sum + (p._sum.listenedSeconds ?? 0), 0);
  const totals = statements.reduce((acc, s) => {
    acc[s.currency] = (acc[s.currency] ?? 0n) + s.royaltyMinor;
    return acc;
  }, {} as Record<string, bigint>);
  res.setHeader("Cache-Control", "no-store");
  res.json({
    owner: { displayName: owner.displayName },
    shareRateBps: 3000,
    tracks: tracks.map((track) => {
      const usage = byTrack.get(track.id);
      return { key: track.key, title: track.title, artist: track.artist, active: track.active, plays: usage?._count._all ?? 0, listenedSeconds: usage?._sum.listenedSeconds ?? 0 };
    }),
    usage: { plays: totalPlays, listenedSeconds: totalSeconds },
    earningsByCurrency: Object.fromEntries(Object.entries(totals).map(([currency, amount]) => [currency, amount.toString()])),
    statements: statements.map((s) => ({ id: s.id, periodStart: s.periodStart, periodEnd: s.periodEnd, currency: s.currency, netRevenueMinor: s.netRevenueMinor.toString(), royaltyMinor: s.royaltyMinor.toString(), shareRateBps: s.shareRateBps, listenedSeconds: s.listenedSeconds, status: s.status })),
  });
}));

musicDspRouter.get("/admin/overview", requireAuth, requireRole("ADMIN"), asyncHandler(async (_req, res) => {
  const [tracks, owners, plays, revenues, statements] = await Promise.all([
    prisma.musicTrack.findMany({ include: { rightsOwner: { select: { id: true, displayName: true, userId: true } }, _count: { select: { plays: true } } }, orderBy: { title: "asc" } }),
    prisma.musicRightsOwner.findMany({ select: { id: true, displayName: true, userId: true } }),
    prisma.musicPlaySession.aggregate({ _count: { _all: true }, _sum: { listenedSeconds: true } }),
    prisma.musicRevenueEntry.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.musicRoyaltyStatement.findMany({ orderBy: { periodStart: "desc" }, take: 50, include: { owner: { select: { displayName: true } } } }),
  ]);
  res.json({
    tracks: tracks.map(t => ({ id: t.id, key: t.key, title: t.title, artist: t.artist, assetUrl: t.assetUrl, active: t.active, plays: t._count.plays, rightsOwner: t.rightsOwner })),
    owners,
    usage: { plays: plays._count._all, listenedSeconds: plays._sum.listenedSeconds ?? 0 },
    revenue: revenues.map(r => ({ id: r.id, source: r.source, amountMinor: r.amountMinor.toString(), currency: r.currency, periodStart: r.periodStart, periodEnd: r.periodEnd, reference: r.reference })),
    statements: statements.map(s => ({ id: s.id, owner: s.owner.displayName, currency: s.currency, royaltyMinor: s.royaltyMinor.toString(), periodStart: s.periodStart, periodEnd: s.periodEnd, status: s.status })),
  });
}));

musicDspRouter.post("/admin/rights-owners", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const displayName = typeof req.body.displayName === "string" ? req.body.displayName.trim() : "";
  if (!email || !displayName) throw new HttpError(400, "INVALID_RIGHTS_OWNER", "An existing AFFILIATE account email and display name are required.");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "AFFILIATE") throw new HttpError(404, "AFFILIATE_ACCOUNT_REQUIRED", "Create or select an AFFILIATE account before linking music rights.");
  const owner = await prisma.musicRightsOwner.upsert({ where: { userId: user.id }, create: { userId: user.id, displayName }, update: { displayName } });
  res.status(201).json({ owner: { id: owner.id, displayName: owner.displayName, userId: owner.userId } });
}));

musicDspRouter.post("/admin/tracks", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const key = typeof req.body.key === "string" ? req.body.key.trim() : "";
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const artist = typeof req.body.artist === "string" ? req.body.artist.trim() : "";
  const assetUrl = typeof req.body.assetUrl === "string" ? req.body.assetUrl.trim() : "";
  const rightsOwnerId = typeof req.body.rightsOwnerId === "string" && req.body.rightsOwnerId ? req.body.rightsOwnerId : null;
  if (!/^[a-z0-9-]{3,80}$/.test(key) || !title || !artist || !assetUrl.startsWith("/audio/")) {
    throw new HttpError(400, "INVALID_MUSIC_TRACK", "Provide a valid key, title, artist and in-app /audio/ asset path.");
  }
  const track = await prisma.musicTrack.upsert({ where: { key }, create: { key, title, artist, assetUrl, rightsOwnerId }, update: { title, artist, assetUrl, rightsOwnerId, active: true } });
  res.status(201).json({ track: { id: track.id, key: track.key, title: track.title, artist: track.artist, rightsOwnerId: track.rightsOwnerId } });
}));

musicDspRouter.post("/admin/revenue", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const source = String(req.body.source ?? "").toUpperCase();
  const amountRaw = String(req.body.amountMinor ?? "");
  const currency = String(req.body.currency ?? "NGN").toUpperCase();
  const reference = typeof req.body.reference === "string" ? req.body.reference.trim() : "";
  const periodStart = new Date(req.body.periodStart);
  const periodEnd = new Date(req.body.periodEnd);
  if (!["ADVERTISING", "SPONSORSHIP", "OTHER"].includes(source) || !/^[1-9][0-9]*$/.test(amountRaw) || !["NGN", "USD", "GBP", "EUR"].includes(currency) || !reference || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd <= periodStart) {
    throw new HttpError(400, "INVALID_MUSIC_REVENUE", "Provide a valid source, positive amountMinor, currency, reference and period.");
  }
  const entry = await prisma.musicRevenueEntry.create({ data: { source, amountMinor: BigInt(amountRaw), currency, reference, periodStart, periodEnd, createdById: req.user!.id } });
  res.status(201).json({ entry: { id: entry.id, source: entry.source, amountMinor: entry.amountMinor.toString(), currency: entry.currency, reference: entry.reference } });
}));

musicDspRouter.post("/admin/settlements/generate", requireAuth, requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const periodStart = new Date(req.body.periodStart);
  const periodEnd = new Date(req.body.periodEnd);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodEnd <= periodStart) {
    throw new HttpError(400, "INVALID_SETTLEMENT_PERIOD", "Provide a valid periodStart and periodEnd.");
  }
  const [revenue, plays] = await Promise.all([
    prisma.musicRevenueEntry.findMany({ where: { periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } } }),
    prisma.musicPlaySession.findMany({ where: { playedAt: { gte: periodStart, lt: periodEnd }, track: { rightsOwnerId: { not: null } } }, select: { listenedSeconds: true, track: { select: { rightsOwnerId: true } } } }),
  ]);
  const totals = new Map<string, bigint>();
  for (const row of revenue) totals.set(row.currency, (totals.get(row.currency) ?? 0n) + row.amountMinor);
  const secondsByOwner = new Map<string, number>();
  for (const play of plays) {
    const ownerId = play.track.rightsOwnerId;
    if (ownerId) secondsByOwner.set(ownerId, (secondsByOwner.get(ownerId) ?? 0) + play.listenedSeconds);
  }
  const totalSeconds = [...secondsByOwner.values()].reduce((sum, n) => sum + n, 0);
  if (totalSeconds <= 0 || totals.size === 0) throw new HttpError(409, "NO_ALLOCATABLE_USAGE_OR_REVENUE", "No eligible rights-holder listening time or recorded revenue exists for this period.");
  const statements = [];
  for (const [currency, gross] of totals) {
    const allocations = allocateMusicRoyalties(gross, secondsByOwner);
    for (const allocation of allocations) {
      const { ownerId, listenedSeconds: seconds, royaltyMinor: royalty } = allocation;
      const existing = await prisma.musicRoyaltyStatement.findUnique({
        where: { ownerId_periodStart_periodEnd_currency: { ownerId, periodStart, periodEnd, currency } },
      });
      if (existing) {
        statements.push({ ownerId, currency, royaltyMinor: existing.royaltyMinor.toString(), status: existing.status, alreadyGenerated: true });
        continue;
      }
      const statement = await prisma.musicRoyaltyStatement.create({
        data: { ownerId, periodStart, periodEnd, currency, netRevenueMinor: gross, royaltyMinor: royalty, shareRateBps: MUSIC_RIGHTS_OWNER_SHARE_BPS, listenedSeconds: seconds },
      });
      statements.push({ ownerId, currency, royaltyMinor: statement.royaltyMinor.toString(), status: statement.status, alreadyGenerated: false });
    }
  }
  res.json({ shareRateBps: 3000, totalEligibleListenSeconds: totalSeconds, statements });
}));
