# EPHINTA YouTube account playlist discovery

EPHINTA can discover playlists owned by the connected YouTube account. You do not
need to copy playlist URLs or IDs into GitHub. The owner authorises EPHINTA once
through Google's OAuth consent screen. The scheduled job then refreshes the
account's playlist catalogue every six hours.

## 1. Create Google OAuth credentials

In Google Cloud Console:

1. Select a project and enable **YouTube Data API v3**.
2. Configure the OAuth consent screen.
3. Create an OAuth client:
   - **Desktop app** if you run the authorisation script on your own Windows,
     macOS or Linux computer. Use the loopback callback shown below.
   - **Web application** if you run it inside Codespaces. Add the exact forwarded
     callback URL to **Authorised redirect URIs**.
4. Keep the client ID and client secret private. The script uses PKCE (S256)
   and validates OAuth state for both flows.

The only requested permission is `https://www.googleapis.com/auth/youtube.readonly`.
EPHINTA never asks for your Google password. Google handles sign-in and consent.\nThe bootstrap uses a random OAuth state value and PKCE (S256) for the\nauthorisation-code exchange.

## 2. Authorise the YouTube account once

Run from the repository root. Choose one of these two setups:

**Local computer (recommended if you have Node.js installed):** use a Desktop
app OAuth client and a loopback redirect. The script listens only on the local
loopback interface.

**Codespaces:** forward port `53682` as **Public** in the Ports panel. Use a
Web application OAuth client, set the forwarded URL including
`/oauth2callback` as the redirect URI, and register that exact URI in Google
Cloud Console. If Google rejects the Codespaces domain as a redirect URI, use
the local Desktop app flow instead.

Local example:

```bash
export YOUTUBE_CLIENT_ID="your-oauth-client-id"
export YOUTUBE_CLIENT_SECRET="your-oauth-client-secret"
export YOUTUBE_OAUTH_REDIRECT_URI="http://127.0.0.1:53682"
node eventsss123/eventsss-main/scripts/authorize-youtube-account.mjs
```

For Codespaces, change the redirect variable to
`https://YOUR-CODESPACE-53682.app.github.dev/oauth2callback`.

Open the printed Google authorisation URL, choose the YouTube account that owns
the EPHINTA music playlists, and approve read-only access. The callback saves a
refresh token in `.secrets/youtube-oauth.json` with restricted file permissions.
Do not commit or share that file.

If the account has multiple YouTube channels, select the channel that owns the
playlists in the Google consent/account context. The sync output records the
channel ID and title it discovers.

## 3. Add GitHub Actions secrets

Repository → Settings → Secrets and variables → Actions → New repository secret:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN` (copy only the refresh_token value from the local
  .secrets/youtube-oauth.json file)

Do not put credentials in repository variables, source code, or chat.\n\n**Important for uninterrupted scheduling:** Google issues refresh tokens that expire\nafter seven days when an external OAuth consent screen is left in Testing mode\nwith YouTube scopes. For a persistent six-hour sync, publish the consent screen\nto Production and complete any verification Google requires for your intended\naudience. If you deliberately keep it in Testing, expect to repeat authorisation\nwhen the token expires. Google can also revoke refresh tokens for other security\nreasons, so the workflow reports authentication failures rather than silently\npretending the catalogue was refreshed.

## 4. Name your playlists so EPHINTA can recognise them

Use these exact playlist-title prefixes:

- `[EPHINTA:WEDDING] Wale Waves Wedding`
- `[EPHINTA:NAMING] Wale Waves Naming`
- `[EPHINTA:BURIAL] Wale Waves Burial`

You can keep all three playlists in the same YouTube account. The sync job
discovers the account's owned playlists and identifies the category by title.
Playlist order is preserved. Set each EPHINTA playlist to **Public** or\n**Unlisted** so visitors can play it. Private playlists and private videos are\nexcluded from the public catalogue to protect account-only content.

For a mixed playlist, use a tag at the start of each video title instead:

- `[EPHINTA:WEDDING] Here We Are - Wale Waves (Wedding 1)`
- `[EPHINTA:NAMING] Welcome, Little One - Wale Waves (Naming 1)`
- `[EPHINTA:BURIAL] You Will Live in Our Hearts - Wale Waves (Burial 1)`

The first matching video-title tag overrides the playlist category. Untagged
items in a mixed playlist remain `unclassified` and should not be auto-selected.

## 5. Automatic refresh

The workflow `.github/workflows/sync-wale-waves-playlists.yml` runs every six
hours and can also be started manually from GitHub Actions. It:

1. Refreshes the OAuth access token using the stored refresh token.
2. Calls YouTube `channels.list(mine=true)`, then `playlists.list(channelId=...)` for each accessible channel.
3. Reads every playlist's entries, following pagination.
4. Writes `eventsss123/eventsss-main/apps/web/public/data/wale-waves-playlists.json`.
5. Opens a pull request containing only the changed catalogue JSON for review.

The workflow uses the repository's `GITHUB_TOKEN` with contents and pull-request
write permissions to create or update a dedicated automation pull request. It
never pushes generated catalogue data directly to `main`; review and merge the
catalogue update like any other code change. Branch protection remains intact.

## 6. Playback and rights

This job discovers and synchronises playlist metadata. It does not download,
extract, or rehost YouTube audio. The application must use the official YouTube
embedded player for YouTube-hosted tracks, or use audio files EPHINTA is licensed
to serve. YouTube embeds are visible players; browsers may block autoplay until
the visitor has granted music permission or interacted with the page. Respect
saved music-off preferences.

## 7. Check the deployed web/API connections

After deployment, run from the application directory:

```bash
EPHINTA_WEB_URL="https://YOUR-WEB-DOMAIN" \
EPHINTA_API_URL="https://ephinta-wss.onrender.com" \
npm run connection:check
```

The report checks the web homepage, API health, database readiness, the logo
asset, the first wedding audio asset, and the API CORS preflight. It reports
which connection failed rather than treating every network error as a generic
registration failure. A failing `/ready` check points to API/database
availability; a failing CORS check points to the configured allowed origins;
a failed asset check points to the deployed static files or web build.
