# ESS Phase 7 — Bluetooth/NFC and offline guest check-in

## Included
- Adds server-authoritative `checkedInAt` and `checkInMethod` fields to Guest, with a Prisma migration.
- Adds an authenticated event-owner check-in endpoint accepting exactly one guest ID or invitation token.
- Makes check-in idempotent under retries and concurrent gate devices: the first check-in timestamp/method is retained.
- Adds a lazy-loaded Guest Check-in tab with cached guest-list support, local pending indicators, manual check-in, Web NFC, and a Web Bluetooth GATT adapter.
- NFC accepts a UUID text record or a URL whose final path segment is the invitation UUID.
- Bluetooth scanners must implement the ESS custom GATT service `f0e10000-7e57-4a53-9a10-45535343484b` and characteristic `f0e10001-7e57-4a53-9a10-45535343484b`, returning the invitation UUID as UTF-8 text.

## Offline behavior and security
- Guest list must have been loaded online at least once on that device to be available offline.
- Check-in POSTs can be queued by the existing offline outbox. The UI labels queued check-ins as pending and does not claim the server has confirmed them.
- Server remains authoritative. A guest already checked in returns an idempotent response; the original server timestamp and method are not overwritten.
- The check-in route uses the existing authenticated event ownership service. NFC/Bluetooth require secure context and compatible device/browser support.
- Web Bluetooth is not a universal scanner API: hardware must implement the documented GATT contract. Manual entry is the fallback on unsupported browsers.

## Apply and validate
1. Run `bash scripts/apply-049-phase7-bluetooth-nfc-offline-checkin.sh`.
2. Review the generated migration, then deploy it with `npm run db:deploy -w apps/api` in the target environment.
3. Test offline behavior in a real browser/device: load guest list online, go offline, check in a guest, reconnect, and verify the guest's server check-in status.
4. Test NFC on a compatible HTTPS Android browser and BLE only with a device implementing the ESS GATT contract.

## Limits
- This patch does not claim physical-device validation. Browser capability detection, production builds and automated tests are not substitutes for NFC/Bluetooth device tests.
