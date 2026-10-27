# ESS Android APK delivery and web-layer updates

The Android pipeline has three delivery lanes:

1. **Pull request and Actions artifact:** `ephinta-build-apk.yml` runs API/web checks, applies migrations to an isolated PostgreSQL service, runs database integration tests, verifies the deployed API `/ready` endpoint, and builds an installable debug APK. The APK is available from the successful Actions run for 30 days.
2. **Downloadable GitHub Release:** after that workflow succeeds on the repository's default branch, `ephinta-apk-download.yml` publishes the exact APK artifact and its SHA-256 checksum as release assets. It does not rebuild or publish an APK from a failed run.
3. **Signed APK and OTA web layer:** `android.yml` can build, sign, verify, and publish `ess-release.apk`; it also publishes `version.json` and `bundle.zip` to GitHub Pages. Native APK updates require Google Play, managed distribution, or a user-installed APK. OTA updates replace only the web layer, not native Android code.

## Required repository configuration

Set these GitHub Actions repository variables/secrets:

### Variables

- `VITE_API_URL` — production HTTPS API base, for example `https://api.example.com/api/v1`.
- The API URL must serve `/health` and `/ready`; `/ready` must be connected to the database used by the deployed app. Web builds and APKs use this URL, while API calls continue through the server (the APK must never connect directly to PostgreSQL).
- `VITE_UPDATE_URL` is derived automatically by CI as `https://<owner>.github.io/<repository>`; no manual variable is required. GitHub Pages must be enabled with **GitHub Actions** as the source.
- `ANDROID_CERT_SHA256` — SHA-256 certificate fingerprint of the production signing key.

### Secrets

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Enable GitHub Pages with **GitHub Actions** as the deployment source. The Android workflow publishes the web build, `version.json`, and `bundle.zip` there after every passing release.

## Build, database, and release gates

`ephinta-build-apk.yml` runs on pull requests, pushes to its configured branches, and manual dispatch:

- API and web checks, including tests and production builds
- PostgreSQL migrations and API database integration tests against a temporary CI database
- A reachability and database-readiness check against `VITE_API_URL`
- Capacitor sync and an installable Android debug APK build

A failed check prevents the APK artifact from being released. A successful default-branch run publishes the exact tested debug APK and checksum to a GitHub Release. Production-signed releases remain separate and require the signing secrets above.

## Local verification

```bash
npm ci
npm run mobile:verify
```

For a local debug APK after verification:

```bash
npm run mobile:build
```
