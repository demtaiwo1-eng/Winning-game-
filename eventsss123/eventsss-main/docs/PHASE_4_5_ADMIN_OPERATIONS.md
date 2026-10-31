# Phase 4.5 — Admin experience and mobile operations

## Delivered

- Admin-only finance feed, payment-intent and wallet-ledger tables, filters, and CSV exports.
- Maker-checker approval request queue with optional amount/currency, required decision notes, and separate requester/approver identities.
- Explicit UI safety messaging: approval records do not execute payouts, refunds, or ledger adjustments.
- Reconciliation report for stale pending intents, dead-lettered payment intents, and successful deposits with ledger exceptions.
- Audited dead-letter requeue control with confirmation; requeue schedules provider verification and does not itself credit funds.
- Responsive table overflow, wrapping action controls, refresh/loading/error feedback for narrow admin viewports.

## Access and safety

- The admin router applies authentication and ADMIN-role authorization to every route.
- API tests verify unauthenticated and vendor-role requests are denied for approval reads/creation/decisions and dead-letter replay.
- Maker-checker separation is enforced server-side; a requester cannot approve their own request.
- Every approval request/decision and dead-letter replay writes an audit event.
- No live payout, refund, or FX execution has been introduced.

## Validation gates

- API and web checks, disposable PostgreSQL migration/integration tests, web build, and Android APK build pass in CI.
- CI does not replace physical-device accessibility/viewport review or owner sign-off on a staging environment.
