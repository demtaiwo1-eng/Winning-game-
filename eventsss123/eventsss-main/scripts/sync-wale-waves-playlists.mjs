#!/usr/bin/env node
/**
 * Discover and sync playlists owned by the authorised EPHINTA YouTube account.
 * Uses OAuth refresh tokens and YouTube Data API v3; never downloads audio.
 *
 * Required environment:
 *   YOUTUBE_CLIENT_ID
 *   YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_REFRESH_TOKEN
 *
 * Playlist title convention:
 *   [EPHINTA:WEDDING] Wale Waves Wedding
 *   [EPHINTA:NAMING] Wale Waves Naming
 *   [EPHINTA:BURIAL] Wale Waves Burial
 *
 * Video-level tags may also classify tracks in a mixed playlist:
 *   [EPHINTA:WEDDING] Here We Are - Wale Waves (Wedding 1)
 */
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API = "https://www.googleapis.com/youtube/v3";
const OUTPUT = resolve(process.env.EPHINTA_PLAYLIST_OUTPUT || "eventsss123/eventsss-main/apps/web/public/data/wale-waves-playlists.json");
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET?.trim();
const REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN?.trim();
const CATEGORIES = ["wedding", "naming", "burial"];

function categoryFromTitle(title = "") {
  const match = title.match(/^\s*\[EPHINTA\s*:\s*(WEDDING|NAMING|BURIAL)\s*\]/i);
  return match ? match[1].toLowerCase() : null;
}
function safeText(value) {
  return typeof value === "string" ? value : "";
}
async function getAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Google token refresh failed: " + (payload.error_description || payload.error || response.status));
  return payload.access_token;
}
async function youtubeList(resource, params, token) {
  const items = [];
  let pageToken = "";
  do {
    const url = new URL(API + "/" + resource);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { "Authorization": "Bearer " + token, "Accept": "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = payload?.error?.errors?.[0]?.reason || payload?.error?.message || response.statusText;
      throw new Error("YouTube " + resource + " request failed (" + response.status + "): " + reason);
    }
    items.push(...(payload.items || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return items;
}
async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN as GitHub Actions secrets.");
  }
  const token = await getAccessToken();
  const channels = await youtubeList("channels", { part: "snippet,contentDetails", mine: "true" }, token);
  if (!channels.length) throw new Error("The authorised Google account has no accessible YouTube channel.");
  const playlists = [];
  const categories = Object.fromEntries(CATEGORIES.map((category) => [category, []]));
  for (const channel of channels) {
    const channelTitle = safeText(channel.snippet?.title);
    const ownedPlaylists = await youtubeList("playlists", {
      part: "snippet,contentDetails,status",
      channelId: channel.id,
    }, token);
    for (const playlist of ownedPlaylists) {
      const playlistId = playlist.id;
      const privacyStatus = safeText(playlist.status?.privacyStatus);
      // Private playlists cannot be played by the public audience. Never publish
      // their titles, IDs, or item metadata into the public app catalogue.
      if (!playlistId || !["public", "unlisted"].includes(privacyStatus)) continue;
      const title = safeText(playlist.snippet?.title);
      const playlistCategory = categoryFromTitle(title);
      const playlistItems = await youtubeList("playlistItems", {
        part: "snippet,contentDetails,status",
        playlistId,
      }, token);
      const items = playlistItems.flatMap((entry, index) => {
        const videoId = entry.contentDetails?.videoId || entry.snippet?.resourceId?.videoId;
        const itemPrivacy = safeText(entry.status?.privacyStatus);
        if (!videoId || itemPrivacy === "private") return [];
        const videoTitle = safeText(entry.snippet?.title) || "Untitled video";
        const taggedCategory = categoryFromTitle(videoTitle);
        const category = taggedCategory || playlistCategory || "unclassified";
        const item = {
          videoId,
          title: videoTitle,
          category,
          categorySource: playlistCategory === category ? "playlist-title-tag" : taggedCategory ? "video-title-tag" : "unclassified",
          channelTitle: safeText(entry.snippet?.videoOwnerChannelTitle || entry.snippet?.channelTitle),
          position: Number.isInteger(entry.snippet?.position) ? entry.snippet.position : index,
          publishedAt: entry.contentDetails?.videoPublishedAt || null,
          watchUrl: "https://www.youtube.com/watch?v=" + encodeURIComponent(videoId),
        };
        if (category !== "unclassified") categories[category].push({ ...item, playlistId, playlistTitle: title });
        return [item];
      });
      playlists.push({
        playlistId,
        channelId: channel.id,
        channelTitle,
        title,
        description: safeText(playlist.snippet?.description),
        category: playlistCategory || "mixed",
        privacyStatus,
        itemCount: items.length,
        playlistUrl: "https://www.youtube.com/playlist?list=" + encodeURIComponent(playlistId),
        embedUrl: "https://www.youtube.com/embed/videoseries?list=" + encodeURIComponent(playlistId),
        items,
      });
    }
  }
  const result = {
    schemaVersion: 2,
    provider: "YouTube",
    account: { channels: channels.map((channel) => ({ channelId: channel.id, channelTitle: safeText(channel.snippet?.title) })) },
    updatedAt: new Date().toISOString(),
    discoveredPlaylistCount: playlists.length,
    playlists,
    categories,
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  const temporary = OUTPUT + ".tmp";
  await writeFile(temporary, JSON.stringify(result, null, 2) + "\n", "utf8");
  const previous = await readFile(OUTPUT, "utf8").catch(() => null);
  if (previous) {
    try {
      const old = JSON.parse(previous);
      const oldCount = old.playlists?.reduce((sum, item) => sum + (item.items?.length || 0), 0) || 0;
      const newCount = playlists.reduce((sum, item) => sum + item.items.length, 0);
      if (oldCount > 0 && newCount === 0) throw new Error("The account returned no playlist items; preserving the last known-good catalogue.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("preserving")) throw error;
    }
  }
  await rename(temporary, OUTPUT);
  console.log("Discovered " + playlists.length + " owned playlists across " + channels.length + " authorised channel(s).");
  for (const category of CATEGORIES) console.log(category + ": " + categories[category].length + " classified tracks");
  console.log("Updated " + OUTPUT);
}
main().catch((error) => {
  console.error("YouTube playlist sync failed: " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
