# Phase 6 — Messaging, notifications and trust

Status: implementation increment prepared; CI and database integration validation pending.

## Implemented in this increment

- Event messages remain restricted to verified event participants. Message reads remain scoped to the current sender/recipient, and event context is retained.
- Added a per-account send limit of 20 messages per minute.
- Successful event messages create private in-app notifications for each intended recipient. Notification creation is best-effort and cannot roll back a successfully persisted message.
- Notification inbox pagination validates that cursors belong to the signed-in user. Read-one and read-all operations are scoped to the signed-in user.
- Added per-user preferences for in-app notifications, push opt-in, message/booking/payment categories, and marketing updates (marketing defaults off; push defaults off).
- Added device registration/revocation using SHA-256 token hashes. Raw device tokens are no longer written to audit-log metadata.
- Added account security history for account registration, successful login, session refresh, logout, password reset, and refresh-token reuse.
- Added a client/vendor notification panel and wired native registration after an authenticated session is established.

## Delivery limits and safety

- FCM/APNs credentials and a provider sender are not configured in this repository/environment. Push sends are not simulated: notifications show `NOT_CONFIGURED` when a user opts into push, and the test-push endpoint returns `501 PUSH_PROVIDER_NOT_CONFIGURED`.
- Native registration remains opt-in through `VITE_ENABLE_PUSH=true`; it uses the configured API base URL. Physical-device registration and delivery are not claimed.
- No secrets, raw device tokens, production migrations, or production deployments are included.

## Validation required

- Prisma schema validation and migration against a disposable PostgreSQL database.
- API unit and database integration tests, including participant isolation, notification isolation, preferences, and token hashing.
- Web TypeScript/tests/build and Android debug APK build.
- Provider-backed push delivery, web push, and physical-device checks remain blocked until owner/provider configuration is available.
