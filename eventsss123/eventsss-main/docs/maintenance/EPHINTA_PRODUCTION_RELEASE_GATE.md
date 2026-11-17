# EPHINTA production release gate

Last reviewed: 2026-11-17

## Current deployed baseline

- Render web service: `ephinta-web`, linked to `main`, auto-deploy enabled.
- Render API service: `ephinta_wss`, linked to `main`, auto-deploy enabled, readiness path `/ready`.
- Both services reported their latest deployment as live on commit `087e4d7d0396f90a7417f06c970d1ba3c43e730b`.
- The API readiness endpoint returned HTTP 200 in Render runtime logs, and no error/fatal API log entries were present in the reviewed window.
- The current production database is Render Postgres `ephinta_db`, Free plan, status available. Render reports its expiry as **2026-11-26**. This is a time-limited database, not a durable production data-retention arrangement.

## Required before commercial production

- [ ] Back up the current production database and verify that the backup can be restored.
- [ ] Move production data to a durable database plan/provider before the current Free database expiry. Do not delete or replace the current database until a restore has been tested.
- [ ] After merging the Music DSP migration, verify that `20261117130000_music_dsp_royalties` is applied to the production database.
- [ ] Configure and verify production payment-provider credentials in Render's secret environment settings. Sandbox success is not live-money settlement proof.
- [ ] Connect a real advertising revenue source and a sponsor-revenue reconciliation process. The current DSP admin portal records verified net revenue entries manually; it does not fetch ad-network earnings automatically.
- [ ] Complete rights-owner identity, tax and payout onboarding before paying royalties. The current portal generates pending statements only; it does not transfer funds or mark statements paid.
- [ ] Validate listening-time fraud controls and reconcile provider/ad reports before treating client-reported play sessions as billable impressions.

## Music DSP commercial rule

- Rights owners receive **30% of eligible net music-channel revenue** from advertising, sponsorship and other approved sources.
- The remaining 70% is retained by EPHINTA.
- The 30% pool is allocated by eligible listening seconds to rights-owned tracks within each statement period and currency.
- Net revenue must be recorded after taxes, refunds and agreed third-party deductions. No automatic FX conversion is performed.
- Statements remain pending until a verified payout process is connected.

## Release discipline

- Merge only after the PR's required API, database, web, Android, browser, scale and release-rights checks pass.
- Let Render auto-deploy the merged `main` commit; do not deploy a feature branch directly to production.
- Wait for the API and web deploys to reach Render's `live` state.
- Verify `/ready`, production migration status, authentication, key customer journeys and error logs after deployment.
- Keep the prior working deployment available until post-deploy verification is complete.
