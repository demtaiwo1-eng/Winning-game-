# Phase 5 — Offline runtime integration

Apply this update after `scripts/apply-019-phase5-offline-pwa.sh`, which establishes the offline storage and PWA files referenced here.

## Changelog

- Registered the generated service worker for browser builds and surfaced registration errors in the console.
- Routed application fetches through the offline request layer while preserving native API-origin rewriting.
- Kept requests outside `/api/v1/` on the ordinary network path and prevented outbox replay from recursively entering the wrapper.
- Applied safe-area padding to the active app root, modal backdrops, and dropdown menus; enabled `viewport-fit=cover`.

## Verification

- `npm run build:web` — passed; Vite generated `dist/sw.js` and Workbox runtime assets.
- `npm test -w apps/web` — passed (6 tests).
- Editor diagnostics on touched TypeScript and CSS files — no errors.

## Phone tap-through checklist

1. Open the web app on a phone and confirm the page starts below the status bar/notch without clipping.
2. Open the navigation dropdown and a modal; confirm their contents remain scrollable and do not cover the cutout.
3. In browser developer tools, confirm a service worker is installed and the app shell loads after a reload.
4. With the network disabled, submit a non-financial event/task change and confirm it is reported as queued.
5. While still offline, try sign-in and a payment/wallet/escrow/checkout action; confirm none is reported as queued.
6. Restore the network and confirm queued changes replay when the app resumes.

Physical phone, installed-PWA update behavior, API connectivity, and provider sandbox checks still require the user's device/environment.
