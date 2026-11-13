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


| `eventsss123/eventsss-main/scripts/app-audit.mjs` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/scripts/app-audit.mjs` | `a1ebb7d4e7052b9f2a21eb9f8e9552bb1486dd8d` | Orphaned source-rewriting audit/repair script; its only callers were the quarantined legacy launchers and its `--fix` mode rewrites application source |
| `scripts/ephinta-complete-verify.sh` | `maintenance/quarantine/2026-11-14/original/scripts/ephinta-complete-verify.sh` | `d17861fc036628693dc6240b6bac8caab6e76921` | Unreferenced one-off PR merger with stale default PR numbers 124/123; superseded by current GitHub Actions verification and explicit PR review |
| `eventsss123/eventsss-main/setup-local-postgres.sh` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/setup-local-postgres.sh` | `4b23a5af03e1f1f5ac8182b908307ddc11f6ee51` | Unreferenced legacy DB setup script with hard-coded development password, source patching and npm install fallback; current `scripts/with-database.mjs` uses `compose.dev.yml` |
| `eventsss123/eventsss-main/local-postgres.patch` | `maintenance/quarantine/2026-11-14/original/eventsss123/eventsss-main/local-postgres.patch` | `4bafba32972c1defb57ccc391af6fe3be543a62f` | Patch belonged only to the quarantined local DB script and creates a SQL path that is absent from the active tree |


## Final disposition — quarantine stage passed, copies removed

**Quarantine-stage verification passed before deletion** on commit `a0aef084ea04c98939ac9910119752588df8f1a8`:

- API/type/unit and KYC research checks passed.
- Production API/web builds and browser desktop/mobile journeys passed.
- Database integration and the 300-user workflow regression passed.
- 7,000 portal fixtures (1,000 per active role) seeded and cleaned successfully.
- Strict responsive/design audit passed at 390px, 768px and 1440px.
- Windows verification and iOS Simulator build passed.
- Android Gradle lint, unit tests and debug APK assembly passed; no physical Android device was connected for install/launch verification.
- 5,000 mocked payment journeys passed (60,000 assertions; 2% fee policy; zero provider calls and no real-money movement).
- IP/asset rights gate and dependency licence inventory passed.
- The separate 5,000 one-node health-probe campaign remains a staging health check, not authenticated end-to-end users or real financial transactions.

After those checks, the 12 quarantine copies and the quarantine README were removed in follow-up commits on the final cleanup branch. The original blob SHAs above remain in Git history and are the recovery source. Example recovery command:

```bash
git show <original-blob-sha> > <original-repository-path>
```

No active application imports or package/workflow references were found for the removed paths. The active application source, package manifests/lockfile, migrations, provider adapters, secrets and customer data were not changed by this final copy removal.

## Verification policy

1. The application source, package manifests, lockfile, workflows, payment adapters, migrations, native project, and data are unchanged by this script quarantine.
2. Run the repository's API, web, licence, asset-rights, responsive/browser, and Android checks while the copies are quarantined.
3. If any required check fails due to a missing script or behavior, restore that exact file from the quarantine path and rerun.
4. Only after the quarantine-stage checks pass, remove the eight quarantined copies. Preserve this manifest and the Git commit history as the recovery record.
5. Keep `scripts/verify-all.sh`, `scripts/ephinta-complete-verify.sh`, `scripts/verify-ephinta.ps1`, `scripts/search-code.sh`, `scripts/setup-local-postgres.sh`, and `scripts/fix-ephinta-signing.sh` for now: they serve current verification, support, database setup, or signing-recovery purposes and require separate validation before any removal.
