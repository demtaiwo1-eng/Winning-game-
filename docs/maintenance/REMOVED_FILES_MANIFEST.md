# EPHINTA staged cleanup manifest — 2026-11-14

The following twelve maintenance files were reviewed, preserved by their original Git blob SHAs, staged for verification, and then removed from the active application workspace. The original blobs remain recoverable through Git history.

| Original path | Original blob SHA | Reason for removal |
| --- | --- | --- |
| `eventsss123/eventsss-main/ephinta-fix.sh` | `b6a4912824ce3dd6b56051a0777772ba4d5b0346` | Legacy Codespaces/Codex CLI workflow; no active package-script or workflow caller |
| `eventsss123/eventsss-main/ephinta-complete.sh` | `f890200e36e6df62b313f59ff41aa10ac7255fd1` | Obsolete completion workflow with stale PR IDs and Codex CLI dependency |
| `eventsss123/eventsss-main/update-ephinta.sh` | `3937be49f2ae6eca4b2c7cc273b380d1d10ae6d3` | Generic legacy install/build/deploy helper superseded by locked npm workspace scripts |
| `eventsss123/eventsss-main/apply-ephinta-ui-money-fixes.sh` | `cb57c39fa37fbe59a3db0eb3fbf6497866d16823` | One-time source-rewriting patch, not a runtime feature |
| `eventsss123/eventsss-main/run-dev-safe.sh` | `3d24f5e4b7c178655a1a97b19888629017d663d0` | Duplicate outdated shell launcher; maintained `npm run dev` uses `scripts/dev-safe.mjs` |
| `eventsss123/eventsss-main/run-ess-app.sh` | `990a2c7b00f89ca826a630e2e6b1d1b7308b57a5` | Legacy launcher deletes dependencies and lockfile before a non-reproducible install |
| `eventsss123/eventsss-main/run-ess-app-force.sh` | `26db10601c0c19a68169b957440d2294ad26002c` | Force installer deletes lockfile and node_modules, installs with --force and repairs source automatically |
| `eventsss123/eventsss-main/ess-cleanup.sh` | `25e5f0a117d6f5daa5a52fa1e9f5ab49ebe92d81` | Legacy interactive scanner for ESSAuthModal, unrelated to current EPHINTA runtime |
| `eventsss123/eventsss-main/scripts/app-audit.mjs` | `a1ebb7d4e7052b9f2a21eb9f8e9552bb1486dd8d` | Orphaned source-rewriting audit/repair script; only callers were removed launchers |
| `scripts/ephinta-complete-verify.sh` | `d17861fc036628693dc6240b6bac8caab6e76921` | Unreferenced one-off PR merger with stale default PR numbers 124/123 |
| `eventsss123/eventsss-main/setup-local-postgres.sh` | `4b23a5af03e1f1f5ac8182b908307ddc11f6ee51` | Unreferenced local DB setup script with hard-coded development password and source patching |
| `eventsss123/eventsss-main/local-postgres.patch` | `4bafba32972c1defb57ccc391af6fe3be543a62f` | Patch belonged only to removed local DB script and targets a SQL path absent from active tree |

## Verification before final removal

Quarantine-stage verification passed on commit `a0aef084ea04c98939ac9910119752588df8f1a8`:

- API/type/unit and KYC research checks.
- Production API/web builds, database integration and desktop/mobile browser journeys.
- 7,000 isolated portal fixtures (1,000 per active role) and 300 database journeys (100 client, 100 vendor, 100 verifier).
- Responsive/design audit at 390px, 768px and 1440px.
- Windows verification and iOS Simulator build.
- Android Gradle lint, unit tests and debug APK assembly. No physical Android device was connected, so install/launch on a device is not claimed.
- 5,000 mocked payment journeys passed (60,000 assertions, 2% fee policy, zero provider calls and no real-money movement).
- IP/asset rights gate and dependency licence inventory passed.
- Separate 5,000-persona single-node health campaign passed: 5,000/5,000 HTTP 2xx, zero failures, zero 429/5xx/network errors, 3 requests/second and max four concurrent requests. This was one lightweight health probe per synthetic identity, not 5,000 simultaneous authenticated sessions or financial transactions.

The quarantine copies were subsequently removed. Recovery is possible from the original blob SHA, for example:

```bash
git show <original-blob-sha> > <original-repository-path>
```

## Remaining candidates — not yet removed

- Root `concurrently` and `wait-on` dependencies appear unused by current package scripts and repository call-site searches. Remove only in a separate dependency change with lockfile regeneration, clean `npm ci`, full checks and licence/security re-audit.
- Root `react` and `react-dom` declarations duplicate the direct declarations in `apps/web`; remove the redundant root declarations only with the same lockfile regeneration.
- `apps/web` imports `@capacitor/core` without declaring it directly; add it to the web workspace before relying on the hoisted mobile dependency.
- The full development/test dependency tree has nine npm audit advisories (one critical, two high, four moderate, two low). The old Capacitor CLI needs a coordinated major-version migration; do not upgrade it in isolation.

Do not remove legacy payment adapters, KYC/provider integration, Android signing recovery, local database tooling, migrations, or active verification scripts without call-site, data-history and workflow review. In particular, preserve historical payment references until reconciliation and refund obligations are confirmed complete.

## Final disposition

The 12 listed files are absent from the release candidate's active tree. Their original blobs remain in Git history. The application runtime, payment/authentication code, database schema/migrations, dependency manifests/lockfile, secrets and customer data were not altered by this maintenance-script removal.
