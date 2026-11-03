# ESS Android APK delivery and web-layer updates

The active root-level Android pipeline has two delivery lanes:

1. **Verified test APK and OTA release:** `.github/workflows/ephinta-build-apk.yml` runs the API/web checks, database integration tests, and Android build. It packages the web build as an OTA bundle and creates a version manifest. After a successful default-branch run, `.github/workflows/ephinta-apk-download.yml` publishes the unsigned debug APK and checksum as a test prerelease, and updates the separate stable `ephinta-web-latest` OTA release with `ephinta-web-bundle.zip` and `version.json`.
2. **Native Android changes:** changes to Android/Capacitor native code, permissions, plugins, or signing still require a newly built APK and a normal install/update. OTA delivery replaces only the web UI and web logic.

The app checks the CORS-enabled API proxy at `https://ephinta-wss.onrender.com/api/v1/app-updates`. The API reads the dedicated `ephinta-web-latest` GitHub release tag server-side and streams the versioned web bundle to the app, avoiding browser CORS restrictions on GitHub release assets. This OTA tag is kept separate from APK releases, so publishing an unsigned test APK or a signed production APK cannot interrupt web-layer updates. GitHub Pages is not required.

## Required repository configuration

Set these GitHub Actions repository variables/secrets:

### Variables

- `VITE_API_URL` — production HTTPS API base, for example `https://api.example.com/api/v1`.
- The API URL must serve `/health` and `/ready`; `/ready` must be connected to the database used by the deployed app. Web builds and APKs use this URL, while API calls continue through the server (the APK must never connect directly to PostgreSQL).
- `VITE_UPDATE_URL` is injected automatically by the verified APK workflow as the EPHINTA API update-proxy URL; no manual variable is required for that workflow.
- `ANDROID_CERT_SHA256` — SHA-256 certificate fingerprint of the production signing key.

### Secrets

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_SERVICES_JSON_BASE64` — optional base64-encoded Firebase `google-services.json` for package `com.ephinta.app`; without it, Android push notifications are not configured.

The post-build publisher updates the dedicated `ephinta-web-latest` OTA release with `ephinta-web-bundle.zip` and `version.json`; the debug APK remains in its own test prerelease.

## Production-signed Android release

The active repository-root workflow is `.github/workflows/ephinta-production-apk.yml`. It can be started manually from GitHub Actions to produce a signed APK artifact, or by pushing a version tag such as `v1.0.0` to publish a production GitHub Release.

Before running it, configure these repository Actions secrets:

- `ANDROID_KEYSTORE_BASE64` — base64-encoded production keystore
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Also configure the repository Actions variable `ANDROID_CERT_SHA256` with the SHA-256 fingerprint of the same signing certificate. The workflow verifies the APK signature and fingerprint and refuses to publish if they do not match. It also checks the configured production API's `/health` and `/ready` endpoints before building. Versioned OTA bundle assets (`ephinta-web-bundle.zip` and `version.json`) are included in each tagged production release so the app updater continues to receive the matching web layer.

The automatically published APK from `ephinta-apk-download.yml` is deliberately an **unsigned debug/test APK**. It is marked as a prerelease and is not set as the latest release. Only the signed workflow publishes the production release.

## Build, database, and release gates

`ephinta-build-apk.yml` runs on pull requests, pushes to its configured branches, and manual dispatch:

- API and web checks, including tests and production builds
- PostgreSQL migrations and API database integration tests against a temporary CI database
- A reachability and database-readiness check against `VITE_API_URL`
- Capacitor sync and an installable Android debug APK build

A failed check prevents the APK artifact from being released. A successful default-branch run publishes the exact tested debug APK and checksum as a test prerelease, and refreshes the independent OTA release tag. Production-signed releases remain separate and require the signing secrets above.

## Local verification

```bash
npm ci
npm run mobile:verify
```

For a local debug APK after verification:

```bash
npm run mobile:build
```
