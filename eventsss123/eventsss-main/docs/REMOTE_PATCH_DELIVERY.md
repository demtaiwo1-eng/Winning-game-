# EPHINTA remote patch delivery

## What happens after a patch is approved

1. Merge the reviewed change into the repository's `main` branch.
2. GitHub Actions runs the API, web, browser and Android verification workflow.
3. Only after that workflow succeeds, `.github/workflows/ephinta-apk-download.yml` publishes the web bundle and `version.json` to the stable `ephinta-web-latest` release.
4. The API exposes the manifest and bundle through `/api/v1/app-updates`; the app does not need to access GitHub release assets directly.
5. Every connected EPHINTA installation checks the manifest at startup, when it returns to the foreground, when connectivity returns, and every five minutes while open.
6. A newer patch appears in the app as an EPHINTA update notice. On Android/iOS Capacitor installs, choosing **Install update** downloads and activates the compatible web bundle through Capacitor Updater. On browser/PWA installs, the app refreshes its deployed origin and its service worker handles the web assets.

The manifest version is the full source commit SHA. The version embedded in the built web app uses the same SHA, so an installation does not repeatedly prompt for a patch it already contains. The API only exposes a bounded title/message and the same-origin bundle route; release-note text is sanitized before it reaches the client.

## What can be patched remotely

- React screens, styles, client-side validation and navigation.
- Web business logic and compatible frontend fixes.
- Static web assets included in the OTA bundle.

## What still needs a native app release

- Android/iOS native source, plugins, permissions, app identifiers, signing, native SDK configuration, and changes to native dependencies.
- Any change that app-store policy requires to be shipped as a new native binary.

The OTA mechanism must not be used to bypass Google Play or Apple App Store review rules.

## Connectivity and notification boundaries

- An installation that can reach the EPHINTA API receives the update notice on its next successful check. Offline devices receive it after reconnecting.
- A web page or PWA must also be served from a host where the updated web build has been deployed; a reload cannot replace files on an unrelated static host.
- The current push-token registration and notification database are present, but FCM/APNs provider delivery is not configured. Therefore, this patch notice is an in-app notification while the app is running/connected. A notification while the app is fully closed requires owner-configured Firebase service credentials, matching Android Firebase configuration, Apple APNs credentials for iOS, and real-device delivery tests. The app must never report a push as sent until the provider confirms acceptance.
- Push permission is opt-in and device tokens must remain private. Do not commit Firebase service-account JSON, APNs keys, signing files, or raw device tokens.

## Verification

The browser suite includes desktop and mobile checks for the remote patch notice. The API suite verifies that release title/message metadata is returned safely. The existing build workflow packages the OTA bundle, and the post-success publisher updates the stable OTA release.

A green CI run verifies the software path, not physical-device delivery. Before declaring full push support, verify a real Android device and a real iOS device with the owner-configured provider credentials.
