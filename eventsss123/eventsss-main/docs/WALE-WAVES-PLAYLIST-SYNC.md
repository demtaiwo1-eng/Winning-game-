# Wale Waves playlist sync

EPHINTA can refresh public Wale Waves YouTube / YouTube Music playlist metadata
without downloading or copying audio. The sync job runs every six hours and can
also be started manually from GitHub Actions.

## Required GitHub configuration

In **Settings → Secrets and variables → Actions**:

- Add secret `YOUTUBE_API_KEY` containing a YouTube Data API v3 key.
- Add repository variable `EPHINTA_WALEWAVES1_PLAYLIST_URL` with the full public
  YouTube Music playlist URL owned/curated by WaleWaves1.

Optional category playlist variables:

- `EPHINTA_WEDDING_PLAYLIST_URL`
- `EPHINTA_NAMING_PLAYLIST_URL`
- `EPHINTA_BURIAL_PLAYLIST_URL`

Only set category URLs when those playlists exist and are the intended EPHINTA
soundtracks. Do not guess playlist IDs. A playlist must be public or otherwise
readable by the configured API credentials.

## Output

The script writes:

`apps/web/public/data/wale-waves-playlists.json`

It includes playlist IDs, current item order, video IDs, titles, watch links,
YouTube embed links, and a timestamp. New songs, removed songs, and reordered
items are reflected on the next scheduled sync. The script preserves the last
known good JSON if all configured playlists unexpectedly return no videos.

## Run locally

```bash
YOUTUBE_API_KEY="your-key" \
EPHINTA_WALEWAVES1_PLAYLIST_URL="https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID" \
node eventsss123/eventsss-main/scripts/sync-wale-waves-playlists.mjs
```

Keep the API key in a secret manager or environment variable. Never commit it.

## Playback and licensing

This sync only reads YouTube playlist metadata. It does not download, rehost, or
extract audio. Playback must use the official YouTube/YouTube Music player or
the existing licensed EPHINTA audio assets. Browser autoplay may be blocked
until the visitor grants permission or interacts with the page.
