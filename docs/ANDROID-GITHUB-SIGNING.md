# EPHINTA Android signing — GitHub-only setup

You do not need to install Java, Android Studio, or command-line tools on your own computer. The signing key is generated inside a private GitHub Codespace and the credentials are sent directly to GitHub Actions secrets.

## Important repository security note

The repository is currently public. **Never commit a keystore, password, base64 keystore value, or unencrypted signing backup.** The setup script writes no signing material into git. It uses the authenticated GitHub CLI to create repository Actions secrets.

## One-time setup from a browser (phone or computer)

1. Open [EPHINTA on GitHub](https://github.com/demtaiwo1-eng/Winning-game-).
2. Open the branch selector and choose `integration/android-production-signing`.
3. Select **Code → Codespaces → Create codespace on integration/android-production-signing**. This runs the terminal in GitHub's cloud, not on your device. If Codespaces is unavailable on your account, stop here; do not put the key in a public Actions artifact or commit it to the repository.
4. In the Codespaces terminal, run:

   ```bash
   bash scripts/setup-android-signing-github.sh
   ```

5. Enter a strong keystore password and a separate private-key password when prompted. These are entered only into the Codespaces terminal; do not paste them into ChatGPT, an issue, a commit, or a workflow input. Save both in a password manager.
6. The script generates one persistent RSA-4096 release key, then writes these values directly to GitHub Actions secrets:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_PASSWORD`
   - `ANDROID_KEY_ALIAS`

   It also writes the certificate fingerprint to the repository Actions variable `ANDROID_CERT_SHA256`.

7. The script creates an encrypted recovery copy at `~/.ephinta-android-signing/ephinta-release.jks.enc`. Use the Codespaces file explorer to download that encrypted file and store it somewhere private. Its encryption password is the keystore password. Keep the recovery copy and both passwords safe; without the original key, future APK updates signed with the same application identity cannot be produced.
8. Keep the Codespace until you have downloaded and safely stored the encrypted recovery copy. You may then stop the Codespace. Never delete or rotate the signing key merely to fix a build.

## After setup

Open [the production APK workflow](https://github.com/demtaiwo1-eng/Winning-game-/actions/workflows/ephinta-production-apk.yml) and choose **Run workflow** on the release-readiness branch. The workflow builds and signs on GitHub's hosted runner, verifies the APK certificate against `ANDROID_CERT_SHA256`, and uploads the signed APK artifact. A version-tag push is required for a public production GitHub Release and stable OTA publication.

The repository's current CI run also produces a debug APK, but that is not the production signing key and should not be treated as the long-term release identity.

## If Codespaces or repository secret-write permission is unavailable

The setup script stops without exposing the key. An account with repository Actions-secret write permission must run the one-time setup. Do not work around this by uploading a keystore to this public repository or by printing credentials into Actions logs.
