# Wale Waves playlist sync and EPHINTA music naming convention

EPHINTA checks configured public YouTube / YouTube Music playlists every six hours.
The updater reads playlist metadata only; it does not download, copy, or rehost audio.
You can also run the workflow manually from GitHub Actions.

## Required GitHub configuration

In **Settings → Secrets and variables → Actions**:

- Add secret `YOUTUBE_API_KEY` containing a YouTube Data API v3 key.
- Add repository variable `EPHINTA_WALEWAVES1_PLAYLIST_URL` with the exact public
  WaleWaves1 YouTube Music playlist URL.

Optional category playlist variables:

- `EPHINTA_WEDDING_PLAYLIST_URL`
- `EPHINTA_NAMING_PLAYLIST_URL`
- `EPHINTA_BURIAL_PLAYLIST_URL`

Use category playlists when you have separate lists. The playlist variable itself
classifies every item in that list. If you use one mixed WaleWaves1 list, use the
title tags below so EPHINTA can identify each track. Do not guess playlist IDs.
The playlist must be public or otherwise readable by the API credentials.

## Required track-title convention

For a mixed playlist, begin each YouTube video title with exactly one category tag:

- `[EPHINTA:WEDDING] Here We Are - Wale Waves (Wedding 1)`
- `[EPHINTA:NAMING] Welcome, Little One - Wale Waves (Naming 1)`
- `[EPHINTA:BURIAL] You Will Live in Our Hearts - Wale Waves (Burial 1)`

Rules:

1. Use one of the three tags exactly: `[EPHINTA:WEDDING]`,
   `[EPHINTA:NAMING]`, or `[EPHINTA:BURIAL]`.
2. Put the tag at the beginning of the video title. Capitalisation is flexible.
3. Keep the descriptive song title and artist after the tag.
4. Add an optional sequence number in parentheses, such as `(Wedding 1)`,
   `(Wedding 2)`, `(Burial 1)`. Playlist order remains the playback order.
5. Do not use a category tag for unrelated tracks. Untagged items in the mixed
   WaleWaves1 playlist are marked `unclassified` and must not be played as a
   category soundtrack until reviewed.
6. Prefer the separate category playlist variables if WaleWaves1 maintains
   different playlists for each event type; category playlist membership takes
   precedence unless an explicit title tag is present.

**First wedding selection:** `Here We Are - Wale Waves (Wedding 1)`.
**Burial selection:** when the visitor chooses **Plan a Burial**, EPHINTA should
select the `burial` category; it must not play wedding or naming tracks.

## What the updater writes

The script writes:

`apps/web/public/data/wale-waves-playlists.json`

Each item includes the YouTube video ID, title, channel, position, watch URL,
category and category source. The output also includes playlist/embed URLs and
the last update timestamp. New, removed, or reordered playlist entries appear
on the next sync. The last known good output is retained if YouTube unexpectedly
returns an empty result for every configured playlist.

YouTube's `playlistItems.list` API supports page tokens and up to 50 results per
request; the script follows `nextPageToken` until the playlist is fully read.
See [the official API reference](https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list).

## Run locally

```bash
YOUTUBE_API_KEY="your-key" \
EPHINTA_WALEWAVES1_PLAYLIST_URL="https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID" \
node eventsss123/eventsss-main/scripts/sync-wale-waves-playlists.mjs
```

Keep the API key in GitHub Actions secrets or an environment variable. Never
commit it or paste it into chat.

## Playback, permission and rights

The sync job is a catalogue updater, not a music player. The EPHINTA player must
select the category list for the visitor's journey and play through the official
YouTube embed/player or properly licensed EPHINTA audio files. Do not extract
audio from YouTube. Respect the visitor's saved music-off preference. Browser
autoplay may be blocked until the visitor grants permission or interacts with
the page. A category switch can be selected immediately, but actual playback
must obey browser and YouTube player requirements.
