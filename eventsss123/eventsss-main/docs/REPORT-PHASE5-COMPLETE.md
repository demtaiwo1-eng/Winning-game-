# Phase 5 — PWA and offline-first foundation

## 1. Requirements covered

Phase 5 (9.1) is completed on top of the Phase 4 messaging/readiness baseline.

Covered:
- Browser PWA service worker with injected precache manifest and offline navigation fallback.
- Installable web manifest with SVG plus 192px/512px PNG icons.
- Browser-only service-worker registration; Capacitor remains on Capgo native web-layer updates.
- IndexedDB stores for events, guests, tasks, budget, cart, listing snapshots, questionnaire drafts, messages, mutation outbox, conflicts, and metadata.
- Ordered/idempotent offline mutation queue with deterministic monotonic sequence numbers.
- Cart editing is offline-capable; checkout-session/payment/wallet/escrow operations remain network-only.
- Real service-worker Background Sync handler for the application mutation outbox.
- Online/focus/visibility/timer replay and Capacitor app-resume replay remain as fallbacks.
- Visible pending-sync controls and visible unresolved sync-conflict list.
- Structured GET snapshots are written to IndexedDB for supported domain resources and are used as a network-failure fallback.
- Auth/payment/wallet/escrow/checkout-sensitive operations are never queued or cached.

## 2. Files changed/added

- apps/web/index.html
- apps/web/vite.config.ts
- apps/web/src/main.tsx
- apps/web/src/sw.ts
- apps/web/src/lib/offline/db.ts
- apps/web/src/lib/offline/fetch.ts
- apps/web/src/lib/offline/outbox.ts
- apps/web/src/components/SyncConflictList.tsx
- apps/web/src/lib/offline/__tests__/offlinePolicy.test.ts
- apps/web/public/icons/ess-icon-192.png
- apps/web/public/icons/ess-icon-512.png
- docs/REPORT-PHASE5-COMPLETE.md

No database migration is required.

## 3. Patch/script

Patch: `patches/046-phase5-offline-first-complete.patch`
Script: `scripts/apply-046-phase5-offline-first-complete.sh`

Run:

```bash
chmod +x scripts/apply-046-phase5-offline-first-complete.sh
./scripts/apply-046-phase5-offline-first-complete.sh
```

## 4. Migrations

None.

## 5. Tests

The apply script runs API typecheck, web production build, and web/API tests. The new offline-policy suite verifies cart-vs-checkout safety and financial/authentication exclusions.

## 6. Security and decisions

- Financial state remains server-authoritative.
- Authentication and token refresh remain network-only.
- Offline mutation replay preserves the original idempotency key.
- Mutations replay in deterministic sequence order and stop at the first unavailable mutation.
- HTTP 409 responses become visible conflict records instead of being silently discarded.
- Browser service workers are not registered inside Capacitor, avoiding conflict with Capgo updater behavior.

## 7. Known issues / next phase

- Service-worker and IndexedDB behavior still requires a real browser offline/online tap-through.
- Phase 6 handles performance/code splitting/image optimization/Lighthouse work.
- Phase 7 handles Bluetooth/NFC and offline guest check-in.

## 8. Phone/browser checklist

1. Install the PWA and confirm the manifest/icons are accepted.
2. Reload once offline and confirm the app shell/offline page remains available.
3. Disable network and edit an event/task/cart; confirm a pending sync indicator appears.
4. While offline, attempt login, payment, wallet, escrow and checkout payment; confirm they are rejected rather than queued.
5. Reconnect and confirm the mutation outbox replays.
6. If a server 409 is returned, confirm the visible sync-conflict panel appears.
7. In Capacitor, confirm service-worker registration is skipped and Capgo remains the update path.
