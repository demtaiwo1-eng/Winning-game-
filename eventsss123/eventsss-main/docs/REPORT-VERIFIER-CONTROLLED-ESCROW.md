# Verifier-controlled escrow release

## Changelog

- Restricted booking escrow release to the event's assigned lead verifier. Buyer, administrator, and legacy Rider-triggered release paths can no longer settle the booking.
- Added server-enforced event finalization: the event must have ended, all readiness checks must be green, every paid booking must have matching service checks, and the assigned lead verifier must confirm completion.
- Prevented owners and other readiness routes from changing event status, verifier assignments, or service checks after completion.
- Required an event and selected lead verifier before checkout or legacy direct booking; wallet checkout now creates readiness checks for each purchased service.
- Kept settlement idempotent and blocked vendor credit if the payer's escrow balance does not cover the booking.
- Added verifier queue visibility for recent ended events and completed events with pending escrow releases, plus a retryable finalization/release action.
- Updated checkout and wallet messaging to describe the payer/payee protection and verifier release rule.
- No Prisma schema or dependency manifest changes.

## Verification

- API TypeScript build — passed.
- Web production build — passed.
- API tests — 31 passed, 1 database-dependent test skipped.
- Web tests — 6 passed.
- Focused escrow policy tests — 6 passed.
- Changed-file diagnostics and `git diff --check` — passed.

The database-dependent API test was skipped because no test database is configured. Database-backed checkout/ledger behavior and device/provider sandbox flows therefore still need a Codespaces database and phone-based tap-through verification.

The existing implementation represents escrow in the platform's wallet/ledger records; it does not establish that funds are held in a separate regulated bank or payment-provider custody account. Events must have an `endsAt` time, a selected lead verifier, and green checks before verifier-authorized release. Existing eventless bookings cannot be released through this flow and require separate review.

## Phone tap-through checklist

1. Create an event with both start and end times, then select a lead verifier before checkout.
2. Try starting checkout without an event or lead verifier; confirm the API reports the missing requirement.
3. With a verifier selected, add marketplace services to the event cart and pay from the wallet. Confirm the payer's escrow balance rises and each service appears as a pending readiness check.
4. Sign in as the assigned lead verifier. Confirm the event remains in the verifier queue after it starts and after it ends.
5. Before the event end time, attempt finalization; confirm release is blocked. After the end time, leave one check pending or red and confirm release remains blocked.
6. Mark every service green. As the assigned lead, confirm event completion and escrow release; verify the vendor balance receives the net amount and the payer's escrow balance decreases.
7. Retry after a partial/network failure; confirm only still-unreleased bookings remain pending and duplicate settlement does not double-credit.
8. As a buyer, non-lead verifier, administrator, and legacy Rider account, attempt to release escrow; confirm each is denied.

## Delivery files

- Patch: [027-verifier-controlled-escrow-release.patch](../patches/027-verifier-controlled-escrow-release.patch)
- Apply and validate: [apply-027-verifier-controlled-escrow-release.sh](../scripts/apply-027-verifier-controlled-escrow-release.sh)

## Files changed

- `apps/api/src/app.ts`
- `apps/api/src/modules/checkout/checkout.routes.ts`
- `apps/api/src/modules/events/events.service.ts`
- `apps/api/src/modules/payments/escrow.service.ts`
- `apps/api/src/modules/payments/escrowPolicy.ts`
- `apps/api/src/modules/payments/payments.routes.ts`
- `apps/api/src/modules/readiness/readiness.routes.ts`
- `apps/api/tests/escrowPolicy.test.ts`
- `apps/web/src/EnterpriseApp.tsx`
- `apps/web/src/components/EventReadinessBoard.tsx`
- `apps/web/src/components/MarketplaceBrowse.tsx`
- `apps/web/src/components/WalletPanel.tsx`
