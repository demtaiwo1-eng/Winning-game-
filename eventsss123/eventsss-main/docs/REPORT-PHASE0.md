# ESS Phase 0 Report — Audit Refresh

## 1. Requirements covered

- Updated the source audit to reflect the complete prompt supplied in this
  session and the repository as it exists now.
- Corrected the original P1–P13 findings with current source evidence.
- Added API method/path/guard/validation/ownership inventories and active,
  legacy, or missing UI caller status.
- Added the web entry/import inventory and a Phase 8 candidate deletion list.
- Confirmed the existing `scripts/lib.sh` supplies backup, patch check/apply,
  conditional install/Prisma actions, builds, tests, rollback, and summary.
- **No feature changes and no deletions.**

The prompt's Part 10 lists Phase 0 through Phase 8 (nine numbered phases);
Part 9's three offline/performance/Bluetooth tracks map to Phases 5–7. It does
not provide an 11-phase acceptance matrix. An all-11-phases claim is blocked
until the owner defines the additional two phases, if intended.

## 2. Files changed

- `docs/REPORT-PHASE0.md` — this updated Phase 0 report.
- `docs/REPORT-031-COMPLETENESS-AUDIT.md` — corrected stale scope claims and
  extended the status matrix through R26.

The current `docs/AUDIT.md`, `scripts/lib.sh`,
`scripts/apply-000-phase0-tooling.sh`, and
`scripts/apply-032-phase0-audit-refresh.sh` were already present at the start of
this report amendment and are unchanged by patch 032. The audit describes their
existing behavior. No application source, database schema, migrations,
dependencies, or data were changed. No files were deleted. No secrets were
added.

## 3. Patch and script

- Patch: `patches/032-phase0-audit-refresh.patch`
- Runner: `scripts/apply-032-phase0-audit-refresh.sh`
- Compatibility entry: `scripts/apply-000-phase0-tooling.sh` (existing; forwards
  to the 032 runner)
- Run with: `bash scripts/apply-032-phase0-audit-refresh.sh`

The runner creates a timestamped repository backup, checks/applies the patch
idempotently, skips install and Prisma work because their manifests/schema are
unchanged, builds API and web, runs both test suites, prints a PASS/FAIL
summary, and restores the backed-up files if a step fails.

## 4. Migrations

None.

## 5. Tests

The phase runner executes the existing API/web builds and API/web test suites.
Results are reported by the runner when applied; static route inventory is not
a substitute for provider, database, or device tests.

## 6. Security notes and sign-off

- The former P9 webhook issue has verification code and automated tests; a
  provider sandbox/live callback remains unverified.
- Payouts intentionally return `501 PAYOUT_NOT_CONFIGURED`; do not enable a
  simulated withdrawal that debits user balances without transferring money.
- App-level escrow ledger accounting does not establish separate regulated
  custody.
- Phase 8 deletions require owner approval. No deletion was performed.

## 7. Known issues / next phase

- The wizard draft is not yet reliably converted to a persisted event after
  account creation.
- Admin is still a static preview; messaging threads are absent; external
  payout integration is unavailable.
- Bluetooth/NFC, offline replay and safe-area behavior require device tests.
- The supplied prompt and past requests conflict on phase count. The supplied
  checklist has Phase 0–8; no two additional phase definitions were found.
- Do not start Phase 1 until the owner says “go,” as required by the prompt.

## 8. Phone tap-through checklist

Phase 0 changes documentation/tooling only, so there are no new product taps.
After running the script, confirm it reports PASS and that the backup path is
printed. For product acceptance, later phases still require device/browser
checks listed in the audit and Phase 031 report.
