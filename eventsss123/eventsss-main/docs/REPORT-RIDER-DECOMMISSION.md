# Rider decommission report

## Outcome

Rider is no longer an active product role. New Rider registration was already unavailable; this increment removes the remaining active and legacy Rider portals, job API routes, and payout paths.

Existing Rider access is denied at sign-in, refresh-token renewal, and authenticated API requests. A previously issued Rider access token receives `403 ACCOUNT_DISABLED`. Retired `GET` and `PATCH /api/v1/rider/jobs` endpoints return `410 Gone` with a stable `ROLE_RETIRED` response. Legacy saved Rider sessions in the active web app are cleared and shown a notice.

The Prisma `RIDER` role, user rows, dispatch jobs, and associated history remain intact. After explicit approval, the one-time status script was run against the Codespaces development database. It reported zero active Rider accounts to suspend, so no database rows were changed.

## Files changed

- `apps/api/src/app.ts` — removed Rider job routes.
- `apps/api/src/middleware/auth.ts` — rejects Rider JWTs and validates authenticated roles.
- `apps/api/src/modules/auth/auth.service.ts` — blocks Rider login and refresh.
- `apps/api/src/types/express.d.ts` — Rider removed from active request roles.
- `apps/api/src/modules/payments/payments.routes.ts` — removed Rider payout authorization.
- `apps/api/src/modules/payments/escrow.service.ts` — removed the unused Rider-fee credit operation.
- `apps/api/tests/app.test.ts` — added stale-token and removed-route coverage.
- `apps/api/scripts/deactivate-rider-accounts.ts` — idempotent status update for an explicitly selected database.
- `apps/web/src/EnterpriseApp.tsx` and `apps/web/src/App.tsx` — removed active and fallback Rider portals.
- `apps/web/src/lib/roleLabels.ts` and `apps/web/src/components/LandingPage.tsx` — removed user-facing Rider role text.

No files were deleted. No database migration, schema change, dependency change, or data update was performed.

## Database action

The approved Codespaces development database run completed successfully and returned `0` active Rider accounts. No account data or dispatch history was deleted or changed. The operation remains safe to rerun if accounts are later reactivated.

To rerun against the approved development database:

```sh
cd apps/api
npx tsx scripts/deactivate-rider-accounts.ts
```

The operation is idempotent: it changes only active users whose role is `RIDER` to `SUSPENDED`. It prints only the number of affected records, never account details. Do not run it against another environment or production without separate explicit approval and the appropriate database backup.

## Validation

The apply script runs API and web builds and the repository test suite. The API tests verify that an old signed Rider token is denied and both retired Rider job methods return `410 Gone`. No active Rider user needed a status change in the approved database. A real sign-in/refresh flow, provider sandbox behavior, and physical-device flows require environment-specific testing.

## Phone tap-through checklist

1. Open the app and verify that the landing page has no Rider registration or role entry.
2. Sign in as an existing non-Rider role and verify its dashboard still opens.
3. On a device/browser with an old Rider session saved, reload the app; verify the session is cleared and a notice says existing records were preserved.
4. The approved development database contained no active Rider accounts. If an account is later reactivated, rerun the command above and confirm the account count printed; verify that a suspended account cannot sign in.
