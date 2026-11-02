import { Readable } from "node:stream";
import { Router } from "express";

const GITHUB_RELEASE_API = "https://api.github.com/repos/demtaiwo1-eng/Winning-game-/releases/latest";
const CACHE_MS = 60_000;

type ReleaseAsset = { name: string; browser_download_url: string };
type ReleaseInfo = { assets?: ReleaseAsset[] };

let cachedAssets: { expiresAt: number; assets: ReleaseAsset[] } | undefined;

async function latestAssets(): Promise<ReleaseAsset[]> {
  if (cachedAssets && cachedAssets.expiresAt > Date.now()) return cachedAssets.assets;

  const response = await fetch(GITHUB_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "EPHINTA-mobile-updater",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub release lookup failed (${response.status})`);

  const release = (await response.json()) as ReleaseInfo;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (!assets.some((asset) => asset.name === "version.json") ||
      !assets.some((asset) => asset.name === "ephinta-web-bundle.zip")) {
    throw new Error("Latest EPHINTA release is missing its OTA assets");
  }

  cachedAssets = { expiresAt: Date.now() + CACHE_MS, assets };
  return assets;
}

async function fetchLatestAsset(name: string): Promise<Response> {
  const assets = await latestAssets();
  const asset = assets.find((item) => item.name === name);
  if (!asset) throw new Error(`OTA asset not found: ${name}`);

  const response = await fetch(asset.browser_download_url, {
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
    const response = await fetchLatestAsset("version.json");
    const raw = await response.text();
    const manifest = JSON.parse(raw) as { version?: unknown };
    if (typeof manifest.version !== "string" || !/^[a-zA-Z0-9._-]{1,64}$/.test(manifest.version)) {
      return res.status(502).json({ error: { code: "INVALID_UPDATE_MANIFEST", message: "The update manifest is invalid." } });
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ version: manifest.version, url: `ephinta-web-bundle.zip?v=${encodeURIComponent(manifest.version)}` });
  } catch {
    res.status(503).json({ error: { code: "UPDATE_CHECK_UNAVAILABLE", message: "App updates are temporarily unavailable." } });
  }
});

appUpdatesRouter.get("/ephinta-web-bundle.zip", async (_req, res) => {
  try {
    const response = await fetchLatestAsset("ephinta-web-bundle.zip");
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
