# EPHINTA unused files and provenance audit

Updated: 2026-11-13

This file records cleanup decisions and items that still need a deliberate owner review. It is not a licence grant or a plagiarism certificate.

## Removed from the current release branch

- 284 unused Remotion agent-skill, documentation, and example files that were unrelated to the EPHINTA runtime.
- 2,431 tracked files from a stale parent-level `eventsss123/node_modules` installation, plus the obsolete parent-level package.json and package-lock.json. The maintained application has its own lockfile under `eventsss123/eventsss-main`.
- The old repository-root Vite 5 dependency manifest/lockfile and stale helper scripts (`finish-opay.sh`, empty `install-postgres16.sh`) were removed. The root package.json is now a dependency-free command wrapper.
- An unused Veriff session-start adapter was removed because no API route called it and it had no verified decision-webhook workflow. Provider research references remain documentation-only.
- Six Wale Waves-labelled MP3 recordings in two tracked locations (12 copies total). No commercial distribution permission was evidenced, so the recordings are no longer bundled.
- Unused Wale Waves YouTube playlist OAuth/sync scripts, setup documentation, and scheduled workflow.
- The unused `contracts/EventEscrowVault.sol` prototype, which had an MIT SPDX identifier and was not referenced by the active app.

The audio player is now disabled when no explicit rights-cleared source is configured. Do not restore removed media or integrations without recording provenance and permission in `docs/assets/asset-rights.json`.

## Keep under review

- EPHINTA logo variants, favicons, launcher/splash images, and three avatar SVGs: confirm they were created for EPHINTA or licensed for commercial use.
- Legacy Paystack/Flutterwave/Stripe adapters and webhooks: preserve historical settlement compatibility until pending intents are reconciled; only use providers for new traffic where the platform owner has valid merchant terms and explicitly enabled that market.
- Bytid, OPay, Capgo, SMTP transport, and object storage integrations: keep provider contracts, API terms, privacy/DPA records, and account permissions in the private legal/operations register.
- Contributor work by `deytaiwo2`: obtain written IP assignment or a sufficient commercial licence before claiming exclusive ownership of all contributions.

## Generated files

- `apps/api/dist/` and `node_modules/` are generated/install outputs and should not be treated as authored source.
- Build artifacts should be excluded from source control unless a specific release workflow requires them.

## Dependency hygiene

The repository-wide `.gitignore` now excludes `node_modules`, build outputs, and environment files at every directory level. The IP release gate fails if a dependency installation directory is committed again.

## Release rule

Do not delete migration, payment, or deployment code solely because it appears old. First establish whether it supports historical records, rollback, reconciliation, or a live service. Record the decision and test the affected workflow.


## Additional staged maintenance-script cleanup (2026-11-14)

Eight old maintenance scripts were copied byte-for-byte into `maintenance/quarantine/2026-11-14/original/` and then removed from the active application workspace. They are being tested in the quarantined state before their copies are removed. Their original blob SHAs, paths, reasons and rollback procedure are recorded in [the staged cleanup manifest](../../docs/maintenance/REMOVED_FILES_MANIFEST.md).

The quarantined files are legacy Codespaces/Codex completion flows, stale generic build/deploy helpers, a one-time source-rewriting patch, an outdated development launcher, two installers that delete the lockfile/dependency directory and reinstall non-reproducibly, and an ESSAuthModal-only cleanup scanner. Code search found no active package-script or workflow invocation for these names. Current application source, dependency manifests/lockfile, database schema, payments, authentication, web/mobile runtime and deployment configuration were not edited by this quarantine.

The complete direct dependency and service classification is maintained in [SOFTWARE_AND_SERVICE_INVENTORY.md](./docs/SOFTWARE_AND_SERVICE_INVENTORY.md). The authoritative lockfile remains unchanged; regenerate the full transitive package/licence inventory from that lockfile on every release.

Do not remove legacy payment-provider adapters, KYC/provider integration packages, Android signing recovery, local database setup, or active verification scripts without a separate call-site, data-history and workflow audit.
