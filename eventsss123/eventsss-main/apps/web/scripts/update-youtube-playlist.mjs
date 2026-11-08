#!/usr/bin/env node
/**
 * Update EPHINTA's public Wale Waves YouTube playlist URL.
 *
 * Usage:
 *   npm run music:playlist:update -- "https://music.youtube.com/playlist?list=PLAYLIST_ID"
 *
 * The YouTube playlist itself is live: adding/removing videos in YouTube updates
 * what this link opens. This script changes the configured playlist URL when
 * the playlist ID or share URL changes. It does not download or copy YouTube audio.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(scriptDir, "../src/lib/music/ephinta-config.ts");
const suppliedUrl = process.argv[2] || process.env.EPHINTA_YOUTUBE_PLAYLIST_URL;

if (!suppliedUrl) {
  console.error("Provide a YouTube playlist URL.");
  console.error('Example: npm run music:playlist:update -- "https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID"');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(suppliedUrl);
} catch {
  console.error("Invalid URL. Paste the full YouTube playlist share link.");
  process.exit(1);
}

const allowedHosts = new Set(["youtube.com", "www.youtube.com", "music.youtube.com"]);
const playlistId = parsed.searchParams.get("list");
if (
  parsed.protocol !== "https:" ||
  !allowedHosts.has(parsed.hostname) ||
  parsed.pathname !== "/playlist" ||
  !playlistId ||
  !/^[A-Za-z0-9_-]+$/.test(playlistId)
) {
  console.error("Expected an HTTPS YouTube playlist URL containing a valid ?list=PLAYLIST_ID.");
  process.exit(1);
}

const canonicalUrl = `https://music.youtube.com/playlist?list=${playlistId}`;
const source = await readFile(configPath, "utf8");
const updated = source.replace(
  /playlistUrl:\s*"[^"]*"/,
  `playlistUrl: "${canonicalUrl}"`,
);

if (updated === source && !source.includes(`playlistUrl: "${canonicalUrl}"`)) {
  console.error("Could not find playlistUrl in ephinta-config.ts; no file was changed.");
  process.exit(1);
}

if (updated === source) {
  console.log("EPHINTA is already configured with this live YouTube playlist.");
} else {
  await writeFile(configPath, updated, "utf8");
  console.log("Updated EPHINTA's live Wale Waves playlist URL:");
  console.log(canonicalUrl);
}
console.log("Playlist contents remain managed on YouTube; changes there appear through this same link.");
