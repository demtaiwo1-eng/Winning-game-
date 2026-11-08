# EPHINTA Android production signing

This workflow builds a production-signed APK and Android App Bundle (AAB) only when an authorized repository maintainer manually starts it:

- Workflow: `.github/workflows/ephinta-android-signed-release.yml`
- Trigger: GitHub Actions → EPHINTA signed Android release → Run workflow
- Outputs: signed `app-release.apk` and `app-release.aab` as a 30-day workflow artifact
- It does not publish to Google Play or create a public GitHub release.

## Owner-controlled signing key

Use a dedicated release/upload key that the app owner controls. Do not reuse debug keys, commit the keystore, paste it into chat, or upload it as a normal repository artifact. Back it up offline in at least two secure owner-controlled locations. Loss of the key can complicate updates unless Play App Signing is enabled and the upload key can be reset.

Generate a key on a trusted computer with Java's `keytool` (replace the example alias and identity fields; keep the passwords private):

```bash
keytool -genkeypair -v -keystore ephinta-upload.jks -alias ephinta-upload -keyalg RSA -keysize 4096 -validity 10000
```

For Windows PowerShell, Base64-encode the binary keystore without line breaks:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\\ephinta-upload.jks")) | Set-Clipboard
```

For macOS/Linux:

```bash
base64 < ephinta-upload.jks | tr -d '\n' | pbcopy
```

On Linux without a clipboard utility, redirect the output to a protected local text file and remove it securely after entering the secret. Never commit either file.

## Configure GitHub Actions secrets

If working in GitHub Codespaces, the repository includes a helper that generates the key in your Codespace home directory and sends the four values directly to protected GitHub Actions secrets without printing them:

```bash
bash scripts/setup-android-signing.sh
```

The helper refuses to overwrite an existing keystore or any of the four existing Android signing secrets. At the key-password prompt, press Enter to reuse the keystore password. After it finishes, copy both files from `~/.ephinta-signing/` to two secure owner-controlled backups. Do not commit them and do not delete the only keystore copy.

If you prefer to configure the secrets manually, use the steps below.

In the canonical repository, open Settings → Secrets and variables → Actions → New repository secret. Add:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64 representation of the owner-generated JKS file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Exact alias used by keytool |
| `ANDROID_KEY_PASSWORD` | Private-key password |

The workflow checks that all four secrets exist without printing their values. It writes the keystore to the ephemeral runner, signs APK/AAB, verifies both signatures, records SHA-256 checksums, uploads artifacts, and removes the temporary keystore.

## Before distributing

1. Confirm the application ID is `com.ephinta.app` and versionCode is greater than the last Play upload.
2. Run the workflow from a reviewed `main` commit after the secrets are configured.
3. Download the artifact and independently verify its certificate fingerprint and SHA-256.
4. Install the signed APK on the owner's Android device and test registration/sign-in, navigation, permissions, API connectivity, and sandbox payments.
5. If publishing through Play, enable Play App Signing and use the AAB in Play Console internal testing first.

## Current status

The unsigned/debug Android APK and emulator compatibility workflows have passed. That is not a production signature. This workflow is prepared but cannot produce a signed artifact until the owner configures the four protected GitHub secrets. Do not mark production signing complete before a successful signed build and independent install test.
