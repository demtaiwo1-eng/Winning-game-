# EPHINTA Android signing — safe recovery and release setup

The repository's production APK workflow is prepared, but an update that installs over existing Build 869 installations must use the **same original Android signing key**.

## Critical: do not generate a replacement key

The production app package is `com.ephinta.app`. A new keystore has a different signing identity and cannot update an installation signed with the Build 869 key. The public APK contains the signing certificate, not the private keystore; the private key cannot be reconstructed from the APK.

Do not follow old instructions that say to generate a new RSA release key or use the `integration/android-production-signing` branch. The automatic key-initialization workflow is intentionally disabled to protect existing installations.

## What to recover

Locate the original private keystore used to sign Build 869, plus its alias, keystore password, and private-key password. Check owner-controlled password managers, secure backups, and the original release machine or CI environment. Never upload the keystore or passwords to this public repository, a chat, an issue, or a workflow input.

If the original key is unavailable, stop and decide on a deliberate migration. Existing installations may need to uninstall and reinstall a differently signed APK, with possible loss of local app data. If Google Play App Signing was enabled, check Play Console's supported upload-key reset process; that does not automatically replace an app-signing key held outside Play.

## Import the original key into GitHub Actions

Run the reviewed helper from the repository root in a private environment with GitHub CLI, Java, Android SDK build-tools, OpenSSL, and repository Actions-secret/variable write permission:

```bash
bash scripts/setup-android-signing-github.sh
```

The script:
1. Prompts for the original Build 869 keystore, alias, and passwords locally in the terminal.
2. Verifies the key's SHA-256 certificate fingerprint against the published Build 869 APK and confirms package ID `com.ephinta.app`.
3. Stops without changing GitHub configuration if the certificate does not match.
4. Creates and verifies an encrypted recovery backup at `~/.ephinta-android-signing/ephinta-release.jks.enc` plus its checksum.
5. Sends the verified key material directly to GitHub Actions secrets and sets the matching `ANDROID_CERT_SHA256` repository variable. Secret values are not printed.

Required GitHub Actions secrets:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Required repository Actions variable:
- `ANDROID_CERT_SHA256`

Download and securely retain both encrypted backup files before closing the private environment. Keep the encryption password separately. Never commit or publish either backup file.

## Build and publish

After the original signing configuration and recovery backup are in place, follow [the production release guide](../eventsss123/eventsss-main/docs/ANDROID_SIGNED_RELEASE.md) and run:

```bash
bash scripts/complete-production-apk.sh
```

That handoff checks the configuration names without displaying secret values, validates the encrypted backup checksum, and requires explicit confirmation that the backup is stored safely and the latest test APK has been accepted on a physical Android device.

The production workflow verifies API health/readiness, the signing certificate, APK/AAB integrity, and version code. A manual workflow run uploads signed artifacts; a reviewed `v*` tag triggers the GitHub production release and stable OTA publication.

A passing CI build is not physical-device acceptance. Do not claim a production release until the signed APK has been reviewed and installed successfully on a real device.
