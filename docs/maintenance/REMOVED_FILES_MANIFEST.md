# EPHINTA staged cleanup manifest — 2026-11-14

The following eight maintenance scripts were copied byte-for-byte into `maintenance/quarantine/2026-11-14/original/` before their active-tree paths were removed. The preserved blob SHAs identify the exact recovery content in Git history.

| Original path | Quarantine path | Original blob SHA | Reason for quarantine |
| --- | --- | --- | --- |
| `eventsss123/eventsss-main/ephinta-fix.sh` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/ephinta-fix.sh` | `b6a4912824ce3dd6b56051a0777772ba4d5b0346` | Legacy Codespaces/Codex CLI workflow; not referenced by active package scripts or workflows |
| `eventsss123/eventsss-main/ephinta-complete.sh` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/ephinta-complete.sh` | `f890200e36e6df62b313f59ff41aa10ac7255fd1` | Obsolete completion workflow with stale PR IDs and Codex CLI dependency; superseded by current verification commands |
| `eventsss123/eventsss-main/update-ephinta.sh` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/update-ephinta.sh` | `3937be49f2ae6eca4b2c7cc273b380d1d10ae6d3` | Generic legacy install/build/deploy helper superseded by locked npm workspace scripts |
| `eventsss123/eventsss-main/apply-ephinta-ui-money-fixes.sh` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/apply-ephinta-ui-money-fixes.sh` | `cb57c39fa37fbe59a3db0eb3fbf6497866d16823` | One-time source-rewriting patch; not a runtime feature and unsafe to retain as a normal launcher |
| `eventsss123/eventsss-main/run-dev-safe.sh` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/run-dev-safe.sh` | `3d24f5e4b7c178655a1a97b19888629017d663d0` | Duplicate outdated shell launcher; maintained `npm run dev` delegates to `scripts/dev-safe.mjs` |
| `eventsss123/eventsss-main/run-ess-app.sh` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/run-ess-app.sh` | `990a2c7b00f89ca826a630e2e6b1d1b7308b57a5` | Legacy launcher deletes installed dependencies and lockfile before a non-reproducible install |
| `eventsss123/eventsss-main/run-ess-app-force.sh` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/run-ess-app-force.sh` | `26db10601c0c19a68169b957440d2294ad26002c` | Force installer deletes lockfile and node_modules, runs npm install --force and automatic source repair |
| `eventsss123/eventsss-main/ess-cleanup.sh` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/ess-cleanup.sh` | `25e5f0a117d6f5daa5a52fa1e9f5ab49ebe92d81` | Legacy interactive scanner for ESSAuthModal; unrelated to current EPHINTA runtime |

## Verification policy

1. The application source, package manifests, lockfile, workflows, payment adapters, migrations, native project, and data are unchanged by this script quarantine.
2. Run the repository's API, web, licence, asset-rights, responsive/browser, and Android checks while the copies are quarantined.
3. If any required check fails due to a missing script or behavior, restore that exact file from the quarantine path and rerun.
4. Only after the quarantine-stage checks pass, remove the eight quarantined copies. Preserve this manifest and the Git commit history as the recovery record.
5. Keep `scripts/verify-all.sh`, `scripts/ephinta-complete-verify.sh`, `scripts/verify-ephinta.ps1`, `scripts/search-code.sh`, `scripts/setup-local-postgres.sh`, and `scripts/fix-ephinta-signing.sh` for now: they serve current verification, support, database setup, or signing-recovery purposes and require separate validation before any removal.
