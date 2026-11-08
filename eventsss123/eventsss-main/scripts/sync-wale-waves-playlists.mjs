#!/usr/bin/env node
/**
 * Refresh public Wale Waves YouTube playlist metadata for EPHINTA.
 *
 * Required:
 *   YOUTUBE_API_KEY
 *   EPHINTA_WALEWAVES1_PLAYLIST_URL (YouTube / YouTube Music playlist URL)
 *
 * Optional category playlists:
 *   EPHINTA_WEDDING_PLAYLIST_URL
 *   EPHINTA_NAMING_PLAYLIST_URL
 *   EPHINTA_BURIAL_PLAYLIST_URL
 *
 * This only reads playlist metadata/video IDs. It never downloads audio.
 */
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API_ENDPOINT = "https://www.googleapis.com/youtube/v3/playlistItems";
const OUTPUT = resolve(
  process.env.EPHINTA_PLAYLIST_OUTPUT || "apps/web/public/data/wale-waves-playlists.json",
);
const API_KEY = process.env.YOUTUBE_API_KEY?.trim();

function playlistIdFromUrl(raw, variableName) {
  if (!raw?.trim()) return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(`${variableName} must be a valid YouTube playlist URL.`);
  }

  const allowedHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
  ]);
  if (!allowedHosts.has(url.hostname.toLowerCase()) || url.pathname !== "/playlist") {
    throw new Error(`${variableName} must be a YouTube or YouTube Music /playlist URL.`);
  }

  const id = url.searchParams.get("list");
  if (!id || !/^[A-Za-z0-9_-]{10,}$/.test(id)) {
    throw new Error(`${variableName} does not contain a valid playlist ID.`);
  }
  return id;
}

const CATEGORIES = new Set(["wedding", "naming", "burial"]);

function categoryFromTitle(title) {
  const match = title.match(/\[EPHINTA:(WEDDING|NAMING|BURIAL)\]/i);
  return match ? match[1].toLowerCase() : null;
}

async function fetchPlaylist(name, playlistId) {
  const defaultCategory = CATEGORIES.has(name) ? name : null;
  const items = [];
  let pageToken;

  do {
    const url = new URL(API_ENDPOINT);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", API_KEY);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const reason = payload?.error?.errors?.[0]?.reason || payload?.error?.message || response.statusText;
      throw new Error(`YouTube could not read playlist "${name}" (${response.status}): ${reason}`);
    }

    for (const item of payload.items || []) {
      const videoId = item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      const title = item.snippet?.title || "Untitled video";
      items.push({
        videoId,
        title,
        category: categoryFromTitle(title) || defaultCategory || "unclassified",
        categorySource: categoryFromTitle(title) ? "title-tag" : defaultCategory ? "category-playlist" : "unclassified",
        channelTitle: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || "",
        position: Number.isInteger(item.snippet?.position) ? item.snippet.position : items.length,
        publishedAt: item.contentDetails?.videoPublishedAt || null,
        watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      });
    }
    pageToken = payload.nextPageToken || null;
  } while (pageToken);

  return {
    name,
    category: defaultCategory || "mixed",
    playlistId,
    playlistUrl: `https://music.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
    embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(playlistId)}`,
    itemCount: items.length,
    items,
  };
}

async function main() {
  if (!API_KEY) {
    throw new Error("YOUTUBE_API_KEY is required. Store it as a GitHub Actions secret; do not commit it.");
  }

  const definitions = [
    ["waleWaves1", "EPHINTA_WALEWAVES1_PLAYLIST_URL", process.env.EPHINTA_WALEWAVES1_PLAYLIST_URL],
    ["wedding", "EPHINTA_WEDDING_PLAYLIST_URL", process.env.EPHINTA_WEDDING_PLAYLIST_URL],
    ["naming", "EPHINTA_NAMING_PLAYLIST_URL", process.env.EPHINTA_NAMING_PLAYLIST_URL],
    ["burial", "EPHINTA_BURIAL_PLAYLIST_URL", process.env.EPHINTA_BURIAL_PLAYLIST_URL],
  ];

  const configured = definitions
    .map(([name, variableName, value]) => ({
      name,
      playlistId: playlistIdFromUrl(value, variableName),
    }))
    .filter((entry) => entry.playlistId);

  if (!configured.length) {
    throw new Error("Set EPHINTA_WALEWAVES1_PLAYLIST_URL to the public WaleWaves1 YouTube Music playlist URL.");
  }

  const playlists = {};
  for (const entry of configured) {
    playlists[entry.name] = await fetchPlaylist(entry.name, entry.playlistId);
    console.log(`Synced ${entry.name}: ${playlists[entry.name].itemCount} videos`);
  }

  const result = {
    schemaVersion: 1,
    provider: "YouTube",
    updatedAt: new Date().toISOString(),
    playlists,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  const temporary = `${OUTPUT}.tmp`;
  await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  // Keep the previous good file if a sync produces invalid/empty data.
  const previous = await readFile(OUTPUT, "utf8").catch(() => null);
  if (previous) {
    const parsed = JSON.parse(previous);
    const previousTotal = Object.values(parsed.playlists || {}).reduce(
      (sum, playlist) => sum + (playlist.items?.length || 0),
      0,
    );
    const nextTotal = Object.values(playlists).reduce((sum, playlist) => sum + playlist.items.length, 0);
    if (previousTotal > 0 && nextTotal === 0) {
      throw new Error("YouTube returned zero videos for all configured playlists; keeping the previous JSON.");
    }
  }

  await rename(temporary, OUTPUT);
  console.log(`Wrote ${OUTPUT}`);
}

main().catch((error) => {
  console.error(`Playlist sync failed: ${error.message}`);
  process.exitCode = 1;
});
