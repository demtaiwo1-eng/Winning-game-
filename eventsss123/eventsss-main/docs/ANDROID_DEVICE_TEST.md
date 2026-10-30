# Ephinta physical Android device test

A desktop Android Studio installation is not required to install and test the debug APK on an Android phone. Android Studio itself is a desktop IDE; it cannot be installed as a full Android Studio environment on a normal Android handset.

## Build the APK with GitHub Actions

1. Open the repository's [Actions](https://github.com/demtaiwo1-eng/Winning-game-/actions).
2. Select **EPHINTA Web Checks and Android APK**.
3. Open the newest successful run on `main` (or the Phase 2 pull request after its checks pass).
4. Confirm both jobs succeeded: **Test and build responsive web app** and **Build installable Android APK**.
5. In **Artifacts**, download `ephinta-android-debug-apk` to the phone. GitHub keeps the artifact for 30 days.

Do not install an APK from a failed or incomplete workflow run. The debug APK is for testing, not Play Store distribution.

## Install on the phone

1. Open the downloaded ZIP/artifact and extract the `.apk` file if GitHub downloaded it as a ZIP.
2. Tap the APK in Downloads or Files.
3. If Android asks, allow **Install unknown apps** for the browser or file manager you used. Only allow it for that app, install Ephinta, then turn the permission off again.
4. Open Ephinta and confirm it reaches the sign-in/home screen.
5. Test sign-in, sign-out, create an event, save/resume planner details, and open the vendor area using test accounts only.
6. Test Android Back, rotate if supported, background/foreground, slow network, and offline draft behaviour.
7. Report crashes, blank screens, permission prompts, and API errors. Never send passwords, access tokens, or signing keys.

## If Android Studio is available on a computer

1. Install Android Studio from the official Android Developers website.
2. Enable Developer options on the phone by tapping **Build number** seven times.
3. Enable **USB debugging** in Developer options.
4. Connect the phone by USB and accept the phone's debugging-authorisation prompt.
5. In Android Studio, open the Capacitor Android project at `eventsss123/eventsss-main/apps/mobile/android`, select the connected device, and run the app.
6. Use **Logcat** to capture app crashes and native plugin errors. Redact personal data and tokens before sharing logs.

Android Studio/ADB requires a computer and a USB data cable. The phone-only APK installation path above is sufficient for basic physical-device acceptance.

## Acceptance record

- [ ] APK came from a successful GitHub Actions run on the intended commit.
- [ ] Installed and launched on a physical Android device.
- [ ] Sign-in/sign-out passed.
- [ ] Event planner save and resume passed.
- [ ] Android Back and app background/foreground passed.
- [ ] Network/offline draft behaviour checked.
- [ ] No unexpected permissions or crash.
- [ ] Screenshots/logs reviewed with secrets and personal data redacted.

A CI APK build is not evidence of a physical-device test. Mark this checklist only after the owner or tester actually completes each step.
