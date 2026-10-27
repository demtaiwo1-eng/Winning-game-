# ESS Patch 048 — Phase 5 Recovery + Phase 6 Performance Preservation

## Why this patch exists

Patch 047 was created against an older source shape and later failed to apply cleanly. Patch 048 does not force-apply the stale patch or require a clean Git working tree. It repairs the current offline mutation rules in-place, backs up every source file it changes, and rolls back only those files if validation fails.

## Phase 5 recovery

- Only POST, PUT, PATCH, and DELETE are eligible for offline mutation queuing.
- Only `/api/v1/` paths are eligible.
- Authentication, payment, wallet, and escrow mutations remain online-only.
- Checkout mutations are online-only except `/api/v1/checkout/cart/...`, which remains eligible for offline cart editing.
- The rule handles relative URLs, absolute URLs, and query strings and blocks normalized traversal paths.
- Offline fetch routing uses the same cart-versus-checkout boundary.
- Tests cover nested checkout-session wallet payment, query strings, normalized traversal, absolute URLs, unsupported methods, and ordinary event/message mutations.
- The build must produce a non-empty service worker with the ESS precache code and with the Workbox manifest placeholder replaced.

## Phase 6 performance

The uploaded source snapshot already contains the Phase 6 implementation. Patch 048 deliberately preserves those files instead of overwriting them with an older patch:

- Lazy-loaded landing page and dashboard panels in `apps/web/src/EnterpriseApp.tsx`.
- Rollup manual chunks in `apps/web/vite.config.ts`.
- KYC image compression and size limits in `apps/web/src/lib/prepareKycUpload.ts`.
- Server-side KYC encoded-document size rejection in `apps/api/src/modules/kyc/kyc.routes.ts`.
- Bundle-size report script and performance guidance in `scripts/report-web-bundle.mjs` and `docs/PERF.md`.

The apply script verifies these markers are present before claiming Phase 6 is preserved.

## Apply

From inside the ESS repository:

```bash
bash scripts/apply-048-phase5-recovery-phase6-performance.sh
```

The script does not run `git clean`, `git reset`, `git checkout`, or `git apply` against the stale Patch 047. It preserves a backup of the three touched source files, runs API validation/typecheck/tests, builds the web app, verifies Workbox output, reports bundles, and runs web tests. It never converts a failed test into a success.

## Roll back

```bash
bash scripts/rollback-048-phase5-recovery-phase6-performance.sh
```

Or pass a specific backup directory:

```bash
bash scripts/rollback-048-phase5-recovery-phase6-performance.sh .ess-backups/phase56-048-YYYYMMDD-HHMMSS
```

Rollback restores only the three source files changed by Patch 048. Build output and backup directories are left untouched.

## Validation status

The source archive did not include `node_modules` or Git metadata, so a complete repository build/test run could not be executed while preparing this artifact. The apply script performs those validations in the user's Codespace and reports failures honestly. No claim is made that Phase 5/6 has passed the full suite until that script completes successfully.
