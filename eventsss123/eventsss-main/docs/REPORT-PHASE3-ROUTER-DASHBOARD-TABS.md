# React Router dashboard-tab state

## Changelog

- Connected client, vendor, and rider dashboard tab controls to React Router query state (`?tab=...`).
- Preserved each portal’s existing default tab and screen content while enabling direct links and browser back/forward restoration.
- Preserved other route query parameters when a dashboard tab changes.

## Verification

- Web production build — passed; service worker generated.
- Web tests — 6 passed.
- TypeScript/editor diagnostics — no errors.

## Phone/browser tap-through checklist

1. Sign in and open the client Marketplace tab; confirm the address includes `?tab=marketplace`.
2. Select Wallet, then use browser Back and Forward; confirm the active tab tracks the URL.
3. Open a direct dashboard URL such as `/dashboard/client?tab=feedback` and confirm Feedback opens.
4. Repeat for vendor `?tab=wallet` and rider `?tab=jobs` / `?tab=wallet`.
5. In the Capacitor build, confirm the same tab query works inside the hash route.

This connects the primary role-dashboard navigation surfaces; marketplace filters and in-panel form controls remain local state because they are not separate dashboard destinations.
