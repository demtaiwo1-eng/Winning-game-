# EPHINTA Android production signing and release

The production release workflow is prepared, but it cannot produce a signed APK until the owner configures the permanent Android signing key in GitHub Actions. No signing key or password is committed to this repository.

## Canonical production workflow

- Android application ID: `com.ephinta.app`
- Workflow: `.github/workflows/ephinta-production-apk.yml`
- Manual run: builds and verifies a signed APK and AAB, then uploads the artifacts.
- Version tag (`v*`): also publishes the production GitHub Release and the stable web OTA bundle, then verifies that the OTA manifest and bundle are reachable through the production API.
- Before signing, it requires the production API health and readiness endpoints to respond successfully.
- It verifies the APK certificate SHA-256 against the owner-configured `ANDROID_CERT_SHA256` repository variable and refuses to publish if they do not match.
- It removes the temporary keystore from the hosted runner after the job.

The separate `.github/workflows/ephinta-android-signed-release.yml` is a manual signed APK/AAB artifact workflow. It also verifies the certificate fingerprint, but the production workflow above is the release path that includes OTA publication.

## One-time owner setup from GitHub Codespaces

Run these commands from the **repository root** in a private GitHub Codespace:

```bash
bash scripts/setup-android-signing-github.sh
```

The setup script:

1. Checks that no Android signing secrets or certificate variable already exist. It refuses to create a second key or rotate a partially configured signing identity.
2. Generates a dedicated RSA-4096 JKS release key inside the Codespace.
3. Sends the keystore Base64 and passwords directly to GitHub Actions repository secrets using the authenticated GitHub CLI. Secret values are never printed.
4. Stores the certificate fingerprint as the `ANDROID_CERT_SHA256` repository variable.
5. Creates an encrypted keystore recovery copy and a SHA-256 checksum in `~/.ephinta-android-signing/`.
6. Verifies that the encrypted backup decrypts to the original keystore, then removes the plaintext keystore from the Codespace.

You will be prompted for a strong keystore password and a separate private-key password. Save both in a password manager. The encrypted backup uses the keystore password.

**Before closing the Codespace:** download both `ephinta-release.jks.enc` and `ephinta-release.jks.enc.sha256` from `~/.ephinta-android-signing/` and store them in a secure owner-controlled location. Keep the password separately. Do not commit either file or upload it as a normal repository artifact.

If GitHub reports that your account cannot manage repository Actions secrets or variables, stop and have a repository administrator perform this one-time setup. Do not paste signing credentials into chat or workflow inputs.

If the owner configures secrets manually instead, use the exact same owner-generated JKS identity and configure all four secret names plus the `ANDROID_CERT_SHA256` variable. Do not mix an existing key with a newly generated keystore. The helper deliberately refuses to rotate or overwrite an existing or partially configured signing identity.

## Build and verify the production APK

After the secrets and encrypted backup are configured and the backup has been downloaded safely, run from the repository root:

```bash
bash scripts/complete-production-apk.sh
```

The handoff script checks the repository, current pushed branch, GitHub authentication, presence of all four secret names, the certificate variable, and the encrypted backup checksum. It does not read or display secret values. It requires an explicit `YES` confirmation that the encrypted backup is stored safely before dispatching the production workflow and waiting for its result.

The four required GitHub Actions secrets are:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`

The required repository Actions variable is:

- `ANDROID_CERT_SHA256`

Optional Firebase push notification configuration:

- `GOOGLE_SERVICES_JSON_BASE64`

## Production release and OTA

A manual workflow run produces signed APK/AAB artifacts for review. Confirm the Android application ID is `com.ephinta.app` and that the generated `versionCode` is greater than the last Play Console upload. Enable Play App Signing and use the AAB for internal testing before any public rollout.

A reviewed version tag such as `v1.0.0` triggers the release path that publishes:

- `ephinta-production.apk`
- `ephinta-production.aab`
- `SHA256SUMS.txt`
- `ephinta-web-bundle.zip`
- `version.json`

The OTA assets are published under the stable `ephinta-web-latest` release tag. The workflow then checks the live `/api/v1/app-updates/version.json` and bundle download routes. Do not create the version tag until the signed artifact has been reviewed and the production API health/readiness checks are expected to pass.

## Remaining acceptance requirements

A successful GitHub build is not a substitute for owner acceptance. Before distributing, install the signed APK on a physical Android device and verify registration/sign-in, planner and vendor dashboards, navigation, permissions, API connectivity, and sandbox payment flows. The AAB is intended for Play Console internal testing; it does not mean the app has been published to Google Play. Keep the Android package ID distinct from the iOS bundle ID (`com.eventselfsolutions.app`).
