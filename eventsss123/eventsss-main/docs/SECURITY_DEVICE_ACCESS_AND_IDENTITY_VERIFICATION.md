# EPHINTA account security and device-access rollout

## Implemented in this branch

- Authenticated web sessions are gated by a six-digit device PIN.
- First authenticated use on each browser/device prompts the user to create and confirm a PIN.
- PIN material is derived with Web Crypto PBKDF2-HMAC-SHA-256 (310,000 iterations) and a per-device random salt. The raw PIN is never persisted.
- Five minutes without pointer, keyboard, touch, wheel or scroll activity locks the app. Returning to a hidden tab after the inactivity threshold also locks it.
- Five failed PIN attempts sign the user out. Users can always choose to sign out from the lock screen.
- The Capacitor 6-compatible native biometric plugin is included and wired to the lock screen. Supported Android/iOS devices can use OS fingerprint/Face ID/other supported biometrics, with the device credential and EPHINTA PIN as fallbacks. The lock is a device privacy feature, not a replacement for server authentication, a native secure enclave, or biometric identity verification.

## Native biometric integration and acceptance criteria

EPHINTA uses `@aparajita/capacitor-biometric-auth` 8.0.2, which targets Capacitor 6, to invoke Android BiometricPrompt and iOS LocalAuthentication. The app checks whether biometrics or a device credential are available and offers native authentication on supported devices. The Android biometric permission and iOS Face ID usage description are declared. Do not request, capture, upload or store fingerprint images, face templates, or biometric sensor data. The OS returns only an authentication result.

Required acceptance criteria:
1. Check device capability and enrollment before showing the biometric option.
2. Require a device PIN/passcode fallback supported by the operating system.
3. Handle cancellation, lockout, unavailable hardware and unenrolled biometrics without trapping the user.
4. Keep biometric enrollment per device; never sync biometric material to the API.
5. Add Android and iOS physical-device tests before enabling it in production.

## Identity verification: selfie, video and documents

A camera upload is evidence collection, not facial verification. Production identity/liveness verification must be performed by an approved KYC/identity provider. The integration must:
- obtain explicit, purpose-specific consent before camera/microphone capture;
- explain what is collected, who processes it, retention and deletion choices;
- use a provider-hosted capture flow or short-lived signed upload URL to private object storage;
- validate file type by content, size and duration; reject executable content; scan uploads; encrypt at rest and in transit;
- keep evidence private and issue short-lived, user-authorized access URLs only;
- persist verification status/provider reference and audit events, not biometric templates;
- support manual review, retries, provider outage, appeal and deletion workflows;
- never claim a user is verified based only on a successful upload.

No KYC vendor credentials or production storage secrets are included in this branch. Select the provider and configure secrets in the hosting dashboard, not source control or chat.

## NFC and Bluetooth

The existing Phase 7 check-in implementation already supports Web NFC and a documented Web Bluetooth GATT scanner contract for event guest check-in. It is not a biometric login method or a general-purpose device-pairing feature.

For device pairing, implement a separate authenticated pairing flow with explicit user confirmation, short-lived challenges, encrypted transport and revocation. NFC is available only on supported devices/browsers and secure contexts; Web Bluetooth is not supported by every browser and requires compatible GATT hardware. Keep manual/QR alternatives. Never use a scanned NFC tag or BLE advertisement alone as proof of identity.

## Session and server controls still required

The current PIN gate is client-side. Production hardening should additionally:
- store access/refresh tokens in platform-secure storage on native builds rather than browser localStorage;
- rotate and revoke refresh tokens on sign-out, password change, suspicious activity and device removal;
- support server-managed device sessions with device label, last-used time, revoke action and audit log;
- enforce server-side step-up authentication for payouts, refunds, credential changes and sensitive KYC actions;
- add a configurable inactivity policy from the admin console, with five minutes as the default;
- ensure API authorization remains valid independently of the visual lock screen.

## Verification matrix

| Scenario | Expected result |
|---|---|
| First login on a device | PIN setup is required before entering authenticated workspace |
| Reload after PIN setup | Lock screen appears; valid PIN unlocks |
| Five minutes without activity | Workspace is hidden and lock screen appears |
| Activity before five minutes | Idle timer resets |
| App/tab backgrounded beyond five minutes | App locks when resumed |
| Wrong PIN | Access remains locked; error is shown |
| Five wrong PIN attempts | Session is signed out |
| Sign out | Auth tokens are removed; user must authenticate again |
| Unsupported Web Crypto / insecure context | Fail closed with a clear recovery message |
| Fingerprint/Face ID | Must be tested on physical Android and iOS devices after native plugin integration |
| Video/selfie KYC | Must remain pending until provider verifies; upload alone is not approval |
| NFC/Bluetooth | Only supported secure-context devices and compatible hardware; manual fallback remains |

## Release gates

Do not enable biometric identity verification, video KYC approval, or NFC/Bluetooth login in production until the provider, consent copy, data-protection review, secure storage, server-side authorization, and physical-device test results are approved. The present branch implements the device PIN/inactivity gate and documents the remaining integrations explicitly.
