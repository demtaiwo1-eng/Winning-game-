import { Readable } from "node:stream";
import { Router } from "express";

const GITHUB_OTA_RELEASE_API = "https://api.github.com/repos/demtaiwo1-eng/Winning-game-/releases/tags/ephinta-web-latest";
const GITHUB_LEGACY_RELEASE_API = "https://api.github.com/repos/demtaiwo1-eng/Winning-game-/releases/latest";
const CACHE_MS = 60_000;

type ReleaseAsset = { name: string; browser_download_url: string; size?: number };
type ReleaseInfo = { assets?: ReleaseAsset[] };

let cachedAssets: { expiresAt: number; assets: ReleaseAsset[] } | undefined;

async function otaAssets(): Promise<ReleaseAsset[]> {
  if (cachedAssets && cachedAssets.expiresAt > Date.now()) return cachedAssets.assets;

  const requestOptions = () => ({
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "EPHINTA-mobile-updater",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  let response = await fetch(GITHUB_OTA_RELEASE_API, requestOptions());
  // Keep existing installed apps updating while the dedicated OTA tag is first
  // being created, or if it is temporarily absent. APK releases also carry OTA
  // assets, so the legacy latest-release fallback remains compatible.
  if (response.status === 404) {
    response = await fetch(GITHUB_LEGACY_RELEASE_API, requestOptions());
  }
  if (!response.ok) throw new Error(`GitHub OTA release lookup failed (${response.status})`);

  const release = (await response.json()) as ReleaseInfo;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (!assets.some((asset) => asset.name === "version.json") ||
      !assets.some((asset) => asset.name === "ephinta-web-bundle.zip")) {
    throw new Error("The EPHINTA OTA release is missing its required assets");
  }

  cachedAssets = { expiresAt: Date.now() + CACHE_MS, assets };
  return assets;
}

async function fetchOtaAsset(name: string): Promise<Response> {
  const assets = await otaAssets();
  const asset = assets.find((item) => item.name === name);
  if (!asset) throw new Error(`OTA asset not found: ${name}`);
  const assetUrl = new URL(asset.browser_download_url);
  if (assetUrl.protocol !== "https:" || assetUrl.hostname !== "github.com") {
    throw new Error("OTA asset host is not trusted");
  }
  if (typeof asset.size === "number" && asset.size > 100 * 1024 * 1024) {
    throw new Error("OTA asset exceeds the allowed download size");
  }

  const response = await fetch(assetUrl.toString(), {
    headers: { "User-Agent": "EPHINTA-mobile-updater" },
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`OTA asset download failed (${response.status})`);
  }
  return response;
}

export const appUpdatesRouter = Router();

appUpdatesRouter.get("/version.json", async (_req, res) => {
  try {
    const response = await fetchOtaAsset("version.json");
    const raw = await response.text();
    const manifest = JSON.parse(raw) as {
      version?: unknown;
      title?: unknown;
      message?: unknown;
      publishedAt?: unknown;
      updateType?: unknown;
    };
    if (typeof manifest.version !== "string" || !/^[a-zA-Z0-9._-]{1,64}$/.test(manifest.version)) {
      return res.status(502).json({ error: { code: "INVALID_UPDATE_MANIFEST", message: "The update manifest is invalid." } });
    }
    const safeText = (value: unknown, maxLength: number) =>
      typeof value === "string" ? value.replace(/[<>]/g, "").trim().slice(0, maxLength) : undefined;
    const title = safeText(manifest.title, 100);
    const message = safeText(manifest.message, 320);
    const publishedAt = typeof manifest.publishedAt === "string" && !Number.isNaN(Date.parse(manifest.publishedAt))
      ? manifest.publishedAt
      : undefined;
    const updateType = manifest.updateType === "native" ? "native" : "web";

    res.setHeader("Cache-Control", "no-store");
    res.json({
      version: manifest.version,
      url: `ephinta-web-bundle.zip?v=${encodeURIComponent(manifest.version)}`,
      ...(title ? { title } : {}),
      ...(message ? { message } : {}),
      ...(publishedAt ? { publishedAt } : {}),
      updateType,
    });
  } catch {
    res.status(503).json({ error: { code: "UPDATE_CHECK_UNAVAILABLE", message: "App updates are temporarily unavailable." } });
  }
});

appUpdatesRouter.get("/ephinta-web-bundle.zip", async (_req, res) => {
  try {
    const response = await fetchOtaAsset("ephinta-web-bundle.zip");
    res.status(200);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    const length = response.headers.get("content-length");
    if (length) res.setHeader("Content-Length", length);
    Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).pipe(res);
  } catch {
    res.status(503).json({ error: { code: "UPDATE_DOWNLOAD_UNAVAILABLE", message: "The app update is temporarily unavailable." } });
  }
});

export function clearAppUpdateCache(): void {
  cachedAssets = undefined;
}
