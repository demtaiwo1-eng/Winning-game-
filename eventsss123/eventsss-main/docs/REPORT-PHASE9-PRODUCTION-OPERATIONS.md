# ESS Phase 9 Report — Production Operations

## Scope

- Add `scripts/phase9-production-smoke-test.sh` to check API liveness, API readiness/database reachability, and web root response.
- Add `.github/workflows/ess-phase9-staging-smoke.yml`, manually triggered and configured with repository variables for staging URLs.
- Add `docs/PHASE9-OPERATIONS-RUNBOOK.md` covering release sequence, operational troubleshooting, migration/backup precautions, and rollback boundaries.

## Files added

- `.github/workflows/ess-phase9-staging-smoke.yml`
- `docs/PHASE9-OPERATIONS-RUNBOOK.md`
- `docs/REPORT-PHASE9-PRODUCTION-OPERATIONS.md`
- `scripts/phase9-production-smoke-test.sh`

No existing application source, database schema, migration, or payment flow is changed.

## Apply and verify

```bash
bash scripts/apply-051-phase9-production-operations.sh
bash -n scripts/phase9-production-smoke-test.sh
API_BASE_URL="https://staging-api.example.com" WEB_BASE_URL="https://staging.example.com" bash scripts/phase9-production-smoke-test.sh
```

The last command requires real reachable staging URLs and is not run during patch installation.

## Safety boundaries

- No automatic deployment or database migration is performed.
- No secrets are required or printed by the smoke-test script.
- The workflow runs only when manually dispatched.
- Staging and production must be verified by the project owner.

## Status

Patch artifact preparation includes shell syntax checks. Live staging checks, full repository CI, production migration state, backup restoration, and real-device tests remain to be performed in the target environment.
