# ESS Android APK delivery and web-layer updates

The active root-level Android pipeline has two delivery lanes:

1. **Verified APK and OTA release:** `.github/workflows/ephinta-build-apk.yml` runs the API/web checks, database integration tests, and Android build. It also packages the web build as an OTA bundle and creates a version manifest. After the workflow succeeds on the default branch, `.github/workflows/ephinta-apk-download.yml` publishes the exact tested APK, checksum, web bundle, and `version.json` together in a GitHub Release.
2. **Native Android changes:** changes to Android/Capacitor native code, permissions, plugins, or signing still require a newly built APK and a normal install/update. OTA delivery replaces only the web UI and web logic.

The app checks the CORS-enabled API proxy at `https://ephinta-wss.onrender.com/api/v1/app-updates`. The API reads the latest GitHub Release server-side and streams the versioned web bundle to the app, avoiding browser CORS restrictions on GitHub release assets. GitHub Pages is not required.

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

The verified APK workflow publishes `ephinta-web-bundle.zip` and `version.json` alongside the APK release assets after every passing default-branch build.

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
