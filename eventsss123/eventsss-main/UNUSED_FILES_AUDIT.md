# EPHINTA unused files and provenance audit

Updated: 2026-11-13

This file records cleanup decisions and items that still need a deliberate owner review. It is not a licence grant or a plagiarism certificate.

## Removed from the current release branch

- 284 unused Remotion agent-skill, documentation, and example files that were unrelated to the EPHINTA runtime.
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

## Release rule

Do not delete migration, payment, or deployment code solely because it appears old. First establish whether it supports historical records, rollback, reconciliation, or a live service. Record the decision and test the affected workflow.
