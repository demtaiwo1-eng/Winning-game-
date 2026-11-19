# EPHINTA Android production signing and release

The production release workflow is prepared, but it cannot produce a signed APK until the owner configures the permanent Android signing key in GitHub Actions. No signing key or password is committed to this repository.

## Canonical production workflow

- Android application ID: `com.ephinta.app`
- Workflow: `.github/workflows/ephinta-production-apk.yml`
- Manual run: builds and verifies a signed APK and AAB, then uploads the artifacts. The workflow requires the `confirm_device_tested` checkbox: tick it only after installing the latest passing test APK on a physical Android phone and confirming the main journeys work.
- Version tag (`v*`): also publishes the production GitHub Release and the stable web OTA bundle, then verifies that the OTA manifest and bundle are reachable through the production API.
- Before signing, it requires the production API health and readiness endpoints to respond successfully.
- It verifies the APK certificate SHA-256 against the owner-configured `ANDROID_CERT_SHA256` repository variable and refuses to publish if they do not match.
- It removes the temporary keystore from the hosted runner after the job.

The separate `.github/workflows/ephinta-android-signed-release.yml` is a manual signed APK/AAB artifact workflow. It also verifies the certificate fingerprint, but the production workflow above is the release path that includes OTA publication.

## One-time owner setup

**Important:** the original Build 869 private keystore is required to update existing installations. The APK does not contain the private key, and it cannot be reconstructed from the APK. If the original key is lost, stop: do not generate a replacement and assume it can update existing installs. If Google Play App Signing was enabled, check Play Console's upload-key reset process; otherwise a new signing identity requires a deliberate migration plan.

Run these commands from the **repository root** in a private environment with GitHub CLI, Java, Android SDK build-tools, OpenSSL and access to the original keystore. A Codespace is one possible environment:

```bash
bash scripts/setup-android-signing-github.sh
```

The setup script:

1. Checks that the supplied original Build 869 keystore, alias and passwords are valid.
2. Downloads the published Build 869 APK and verifies that the supplied keystore certificate exactly matches its signing certificate and package ID. A mismatch stops the script before any GitHub configuration changes.
3. Creates an encrypted recovery copy and SHA-256 checksum in `~/.ephinta-android-signing/`, then decrypts the copy temporarily and verifies it byte-for-byte against the original keystore.
4. Only after those checks succeed, sends the keystore Base64 and passwords directly to GitHub Actions repository secrets using the authenticated GitHub CLI. Secret values are never printed.
5. Stores the verified certificate fingerprint as the `ANDROID_CERT_SHA256` repository variable.

You will be prompted for the original keystore path, alias, keystore password and separate private-key password. Save both passwords securely. The encrypted backup uses the keystore password.

**Before closing the environment:** download both `ephinta-release.jks.enc` and `ephinta-release.jks.enc.sha256` from `~/.ephinta-android-signing/` and store them in a secure owner-controlled location. Keep the password separately. Do not commit either file or upload it as a normal repository artifact.

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
