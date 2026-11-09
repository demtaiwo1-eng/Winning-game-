# Ephinta completion tracker

Updated: 2026-10-31 UTC
Target: main | Hosting: Render Free only
Live web: https://ephinta-web.onrender.com
Live API: https://ephinta-wss.onrender.com

This ledger tracks the phased delivery programme. A phase is not complete merely because code or documentation exists; acceptance tests and required staging/device/provider evidence must pass.

## Guardrails
- Preserve the current PostgreSQL database and migration history. No resets or destructive production operations.
- Keep Render on Free. Current Free DB has a reported expiry of 2026-11-26; verify a no-cost continuity path before then.
- Keep secrets in GitHub/Render secret stores. Never commit or print secret values.
- Do not activate real payments, payouts, paid placements, or AdMob without verified providers, signatures, idempotency, consent, audit trails, and tests.
- Do not claim browser, physical-device, NFC/Bluetooth, restore, or live-payment tests passed unless performed.

## Phase status
| Phase | Scope | Status | Remaining acceptance evidence |
|---|---|---|---|
| 0 | Baseline, backup, restore, DB continuity, health/security | PARTIAL | Owner backup `ephinta_db_20261030.dump` is 103,970 bytes with SHA-256 recorded in `PHASE_0_RESTORE_REHEARSAL.md`; only its `PGDMP` header has been checked, not `pg_restore --list` or a restore. Live PostgreSQL 16.15 has 38 public tables, 16 finished migrations, and existing rows (User 1, Event 1, Wallet 1, Cart 2, EventTask 22, RefreshToken 1). Preserve all records; their test-vs-real status remains unconfirmed. A second Render Free DB was blocked by the one-active-Free-DB limit; no paid resource created. Free DB expiry 2026-11-26 and broad external allowlist remain open risks. |
| 1 | Production blockers, API URL, CORS, landing page, Android build | CODE PATCH CI-PASS; LIVE UX OPEN | Render Free API and web services are live. GitHub Actions online-readiness check against the configured API returned 200 for `/health` and `/ready`. PR #24/#25/#26 CI runs passed web/API checks and Android debug APK builds. Browser auth/planner journeys and physical Android tap-through remain unverified. |
| 2 | Vendor promotions and monetization integrity | PARTIAL | Promotion creation remains DRAFT-only; wallet campaign payments and activation are disabled until readiness sign-off. Paid subscriptions now fail closed until verified checkout; zero-cost plans remain available with account-role matching. End-to-end promotion payment, approval, expiry/refund and provider sandbox evidence remain open. |
| 3 | Payments, wallet, escrow, booking reliability | IMPLEMENTATION EXISTS; SIGN-OFF OPEN | Verify provider adapters, raw-body signatures, replay/idempotency, ledger invariants, refund/release/dispute permissions, sandbox journeys. No live money. |
| 4 | Event planner completeness | IMPLEMENTED + MERGED + DEPLOYED; E2E SIGN-OFF OPEN | PR #15 and PR #16 are merged. Final-head CI run #88 passed API/web checks, disposable PostgreSQL migration/integration tests, web build and Android debug APK build. Render web and API deployments for 90a2f939 are live; production migration 20261030190000_event_guest_checkin_history applied successfully and /health plus /ready returned 200. Still required: isolated browser E2E for create/edit/resume, guests/RSVP, task reminders, budgets, booking linkage, exports and cross-user ownership. Background push/email reminder delivery and pre-migration check-in audit reconstruction remain explicitly unclaimed. |
| 5 | Vendor marketplace and portal | IMPLEMENTED + MERGED + DEPLOYED; SIGN-OFF OPEN | Phase 5 vendor availability/enquiry implementation is on main and its Render deployment is live. Production migrations `20261031140000_vendor_listing_availability` and `20261031153000_vendor_enquiries` finished. Still verify vendor isolation, storefront/listings, availability, enquiries/replies, booking capacity, review eligibility, and source-backed metrics through authenticated E2E journeys; live VendorEnquiry row count is currently 0, so real vendor activity is not yet evidenced. |
| 6 | Messaging, notifications and trust | IMPLEMENTED + MERGED + DEPLOYED; E2E SIGN-OFF OPEN | PR #45 merged as `4d33b0e2281195505f1ea2e82391e4d31a83c7f6`. GitHub Actions run `41196297612` passed API/web checks, disposable PostgreSQL migration/integration tests, web build, and Android debug APK build/artifact upload. Render web/API deployments are live; production migration `20261031170000_phase6_notifications_trust` finished successfully and `PushDevice`, `PushPreference`, and notification delivery columns exist. Live `/ready` returned HTTP 200. Still required: authenticated E2E message/notification journeys, user isolation against live/staging data, push provider delivery, browser Web Push, physical-device permissions/delivery, and booking/payment timeline acceptance. |
| 7 | Android/iOS, PWA, offline check-in and advertising | IMPLEMENTATION EXISTS; DEVICE SIGN-OFF OPEN | Capacitor Android shell uses app ID `com.ephinta.app`, EPHINTA branding and HashRouter; browser PWA/service worker and IndexedDB outbox are implemented. Guest check-in includes owner-scoped idempotent API, manual/NFC/Web Bluetooth adapters and visible offline-pending state; migrations `20261009010000_phase7_guest_checkin` and `20261030190000_event_guest_checkin_history` are applied. CI debug APK build passed in run `41196297612`. Still required: physical Android install/tap-through, compatible NFC tag test, ESS GATT BLE scanner test, offline guest check-in replay on device, Android Back/deep-link/camera/file-upload permissions review, iOS build/device check. AdMob remains disabled until owner-supplied app/ad-unit IDs and consent/privacy configuration; signed release waits for owner-controlled keystore/Play signing. Production Guest row count is currently 0, so no live guest check-in journey is evidenced. |
| 8 | Deployment, database and operations | QUALITY GATE PASS ON MAIN; PHASE 9 SIGN-OFF OPEN | Phase 8 release-gate script/workflow and Phase 9 smoke-test/runbook are present. Latest Render API/web deploys for `8477ac4` are live. Read-only PostgreSQL 16.15 check: 44 public tables, 22 finished migrations, 0 unfinished migrations; User/Event/Wallet each 1 row. Public smoke, restore rehearsal, staging, monitoring/rollback and DB continuity remain. |
| 9 | Security, accessibility and performance | SIGN-OFF OPEN | PR #25 hardened event-readiness data access, verifier assignment targets, zone changes and review eligibility; PR #24/#26 hardened subscription entitlement gating and organization role matching. CI policy tests pass. Dependency audit workflow currently passes, but prior npm audit output reported 13 findings (2 low, 8 moderate, 2 high, 1 critical); triage/remediation, headers/rate limits/upload checks, accessibility/mobile checks and measured performance budgets remain open. |
| 10 | Repository hygiene and release readiness | GATE DOCUMENTED; SIGN-OFF OPEN | Run clean install, API/web tests/build, DB integration, service-worker checks, browser E2E, Android build; review unused-file inventory without unsafe bulk deletion. |
| 11 | PostgreSQL integration CI gate | PR CI-PASS; VERIFY ON MAIN | PR #24/#25/#26 workflow runs passed migrations and API database integration tests against isolated PostgreSQL 16. Confirm the post-merge main workflow remains green; do not treat CI as a production backup restore. |
| 12 | Browser end-to-end testing | PARTIAL | Existing Playwright scope covers public UI and selected validation/error paths. Expand authenticated event, vendor, cart/checkout and role journeys. |
| 13 | Security and financial integrity | TEST GATE EXISTS; COVERAGE OPEN | Readiness access-control regression and subscription payment gating are merged. Remaining evidence: negative authorization across all roles, signed webhook replay rejection, idempotent ledger effects, currency validation, demo-payment rejection in production, and provider sandbox settlement. |
| 14 | Mobile/PWA/offline workflows | PARTIAL | Verify service-worker/outbox behavior and physical device capabilities; never queue/replay financial mutations. |
| 15 | Staging and production release | NOT SIGNED OFF | Verify staging, smoke tests, provider sandbox, backup restore, monitoring, rollback, and explicit release approval. |

## Known CI evidence
- Feature branch: ephinta/full-phased-improvement-patch
- PR #1: https://github.com/demtaiwo1-eng/Winning-game-/pull/1
- Feature head at tracker creation: c101aadb7a9319ceacf121dbc9de3e7843b97b85
- GitHub Actions run #25: https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41088469325 — overall success; API/web checks, disposable PostgreSQL migrations/integration tests, web build, Android debug APK build and artifact upload completed.
- CI success does not certify live browser flows, online readiness, physical-device operation, real payments, database restore, or production release. Follow-up main commit 9f1a2210196d7257c5966ed6c62c93e6ae86e406 adds a safe public API URL fallback to all four workflow references; GitHub Actions run #27 is pending.
- PR #1 was squash-merged to main as 5807b7da69f2ce19bfe01c0db3f89e26d1b0c003. Phase 1 frontend deployment completed live; API deployment for the merged commit is still being processed. CI fallback commit 9f1a2210196d7257c5966ed6c62c93e6ae86e406 is in progress.

## Work log
| Date UTC | Change | Evidence |
|---|---|---|
| 2026-10-30 | Created Render Free static site; configured Vite API base and SPA rewrite. | https://ephinta-web.onrender.com |
| 2026-10-30 | Added frontend origin to API CORS allowlist; API redeploy completed live. | Render service ephinta_wss |
| 2026-10-30 | Verified PR #1 CI run #25 passed, including isolated DB tests and Android debug APK build. | https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41088469325 |
| 2026-10-30 | Added phase statuses and evidence gaps in this tracker on main. | Commit 7082c26b045ba290cfa01c0db3f89e26d1b7f2c4 |
| 2026-10-30 | Squash-merged the CI-passing Phase 1 patch to main after owner authorization. Frontend deployment completed live; API deployment is still processing. | Commit 5807b7da69f2ce19bfe01c0db3f89e26d1b0c003; PR #1 |
| 2026-10-30 | Added a default public API URL to GitHub Actions so online readiness is checked even if the repository variable is unset. | Commit 9f1a2210196d7257c5966ed6c62c93e6ae86e406; run #27 pending |

## Latest work log (2026-10-31)
| Date UTC | Change | Evidence |
|---|---|---|
| 2026-10-31 | Merged subscription payment gate: only matching zero-cost plans activate; paid plans remain disabled until verified checkout. | PR #24; commit 0f1764b28db325653bd762431442df91e963e504; CI run #116 success; Render API/web deployments live. |
| 2026-10-31 | Merged readiness authorization hardening: event-owner/assigned-verifier access, controlled zone edits, verifier assignment validation, and completed-event review eligibility. | PR #25; commit 847ffbceea02882a8a7a3aff7395503c6029cb4c; CI run #118 success; Render API/web deployments live. |
| 2026-10-31 | Merged organization-mode subscription eligibility using the shared role policy; paid-plan gating unchanged. | PR #26; commit 04c4b9b99ced9ee82cc1fdad3e094bcfbd26b38a; CI run #120 success. |
| 2026-10-31 | Recorded live PostgreSQL preservation baseline and backup checksum; restore rehearsal remains blocked by Free-tier database quota and must not target production. | `PHASE_0_RESTORE_REHEARSAL.md`; no production rows modified. |

## Follow-up risk observed during deployment
- Phase 6 Render installs reported 13 npm audit findings (2 low, 8 moderate, 2 high, 1 critical). No force-upgrade was run; dependency-level triage and compatible remediation remain open under Phase 9.

## Definition of done
A phase is complete only when code review, CI, relevant environment tests, and security/data invariants pass. External dependencies must be recorded as verified or blocked. Overall completion requires evidence for all required phases and owner acceptance of the release checklist.
| 2026-10-31 | Merged PR #16 after final-head CI run #88 passed; Render web and API deployments for commit 90a2f939 are live. Additive guest check-in history migration applied; /health and /ready returned 200. | PR #16; commit 90a2f93900073d74d69f8aa09371392a18ca94c0; Render deploys dep-dbij1tbm8hqs73etkmj0 and dep-dbij1tbm8hqs73etkmdg |

## Phase 4 operations delivery (2026-10-31)

The separate Phase 4 operations plan in `PHASE_4_OPERATIONS_FOUNDATION.md` has now had its implementation sequence delivered and merged:

| Workstream | Merged PR | Main commit | CI evidence |
|---|---:|---|---|
| Finance CSV numeric integrity | #31 | `e96da05893d1ff8d3f86125036fbe689d431a541` | Run [41188847594](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41188847594) passed |
| Maker-checker approval records | #32 | `477da113bb2df03ee24cab2bfcca7ae17a8e9773` | Run [41189056341](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41189056341) passed |
| Prevent offline replay of privileged admin mutations | #33 | `3664219cbfb2de727e76cd043eeabb2590d0b7b6` | Run [41189114897](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41189114897) passed |
| Durable payment reconciliation and dead-letter replay | #34 | `6908e49370b883c395181a8bed060edc18b4a10f` | Run [41189609281](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41189609281) passed |
| Currency-aware wallet idempotency | #35 | `2a0aac9df99a0307be5775896ed22c4f4caf1da1` | Run [41190026407](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41190026407) passed |
| Admin approval/reconciliation console | #36 | `2e9036e03904a468cb07758ade6d917f6f284dce` | Run [41191143640](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41191143640) passed |
| Admin authorization regression tests and Phase 4.5 runbook | #37 | `9dba60df064592ff24c5ccc9cbe4a5ab5a6025af` | Run [41191519256](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41191519256) passed |

These are implementation/CI completion claims, not production activation claims. Still open before a production release: staging sign-off, authenticated browser journeys, physical Android accessibility/viewport review, provider sandbox evidence, backup restore rehearsal, Render database continuity, and dependency/security remediation. Live payouts, refunds, FX, and campaign billing remain disabled/deferred.

| 2026-10-31 | Added shared database-backed per-provider reconciliation throttling (250 ms minimum spacing, 15-second bounded slot wait) to close the remaining Phase 4.3 acceptance gap. | PR #39; commit `a305ee54c95188892b20a5c448040bb76e3f3c0c`; CI run #41192052203 success. |
| 2026-10-31 | Completed Phase 4.5 admin approval/reconciliation UI and authorization regression coverage. | PR #36 commit `2e9036e03904a468cb07758ade6d917f6f284dce`; PR #37 commit `9dba60df064592ff24c5ccc9cbe4a5ab5a6025af`; CI runs #41191143640 and #41191519256 success. |
| 2026-10-31 | Updated the operations completion tracker with PR/CI evidence and explicit remaining release gates. | PR #38; commit `ddea6435d4227caf6bd90d3629a41778aad61840`; CI run #41191858110 success. |
| 2026-10-31 | Verified automatic Render deployment of Phase 4.3 provider throttle commit. API and static site deploys are live; API runtime returned HTTP 200 for /health and /ready. Production DB migration `20261031123000_provider_reconciliation_rate_limits` is finished with no rollback, and the new `PaymentProviderThrottle` table exists. | Render API deploy `dep-dbis1h3bc2fs73cppurg` and web deploy `dep-dbis1h3bc2fs73cppv10`; PostgreSQL read-only verification. No manual deploy or destructive DB operation was performed. |




## Phase 6 work log (2026-10-31)

| Date UTC | Change | Evidence |
|---|---|---|
| 2026-10-31 | Started Phase 6 messaging/notifications trust increment on `feat/phase6-messaging-notifications-trust`. Added notification delivery metadata, per-user push preferences, hashed device registration, per-account message throttling, message notifications, account security history, and client/vendor notification UI. | Validation pending in GitHub Actions; see `docs/PHASE6_MESSAGING_NOTIFICATIONS_TRUST.md`. Push provider and physical-device delivery remain unconfigured/unverified. |


## Phase 5–6 production verification (2026-10-31)

| Date UTC | Change | Evidence |
|---|---|---|
| 2026-10-31 | Phase 5 vendor marketplace workflow is present on main and deployed. | PR #43 merged at commit `4eb03a8803c201ccd98e248e0c36eec11b7f9d0a`; Render web/API deploys for that commit were live; vendor availability and enquiry migrations finished. |
| 2026-10-31 | Merged Phase 6 messaging, notifications and trust after CI passed. | PR #45; commit `4d33b0e2281195505f1ea2e82391e4d31a83c7f6`; GitHub Actions run `41196297612` passed web/API checks, disposable PostgreSQL migration/integration tests, web build and Android debug APK artifact. |
| 2026-10-31 | Deployed Phase 6 to Render Free web/API services. | Web deploy `dep-dbit0jrbc2fs73cqkglg` live; API deploy `dep-dbit0jrbc2fs73cqkggg` applied production migration `20261031170000_phase6_notifications_trust`, then started API successfully; Render logs recorded `/ready` HTTP 200. Read-only PostgreSQL checks confirmed User 1, Event 1 and Wallet 1 rows remained unchanged; new PushDevice/PushPreference tables currently contain 0 rows. |


## Phase 7 implementation review (2026-10-31)

| Date UTC | Review | Evidence |
|---|---|---|
| 2026-10-31 | Confirmed existing Phase 7 guest check-in implementation is already present on main; no duplicate NFC/Bluetooth feature was added. | `REPORT-PHASE7-BLUETOOTH-NFC-OFFLINE-CHECKIN.md`; `GuestCheckInPanel.tsx`; owner-scoped idempotent `checkInGuest` service; applied migrations `20261009010000_phase7_guest_checkin` and `20261030190000_event_guest_checkin_history`. |
| 2026-10-31 | Confirmed Phase 6 merge's CI run also built the Android debug APK. | GitHub Actions run `41196297612`, Android job succeeded; this is a build result, not a physical-device test. |


## Phase 8–9 operations recheck (2026-10-31)

| Date UTC | Check | Evidence / outcome |
|---|---|---|
| 2026-10-31 | Latest Render API and web deployments for main commit `8477ac4a76c08f6a82c7a8e7665d05a7480f7906` completed successfully and are live. | API deploy `dep-dbit1sril8vc73a0i93g`; web deploy `dep-dbit1suq1p3s73a43t5g`; Render service events show successful builds and deploys. |
| 2026-10-31 | Read-only production database inventory rechecked. | PostgreSQL 16.15; 44 public base tables; 22 finished Prisma migrations; 0 unfinished migrations; User 1, Event 1, Wallet 1. Query ran in a read-only transaction; no production rows were changed. |
| 2026-10-31 | Phase 8 quality-gate workflow and Phase 9 operations/smoke-test assets reviewed. | `ess-phase8-quality-gate.yml`, `scripts/phase8-release-gate.sh`, `ess-phase9-staging-smoke.yml`, `scripts/phase9-production-smoke-test.sh`, and `PHASE9-OPERATIONS-RUNBOOK.md` are the documented gates. A new main commit will re-trigger push-based Phase 8 CI. |
| 2026-10-31 | Restore and external acceptance limits reconfirmed. | Render Free PostgreSQL reports expiry 2026-11-26. A second Free DB could not be provisioned; no paid DB or production restore was attempted. Phase 9 staging workflow requires owner-configured staging URL variables; production URLs must not be mislabelled as staging. Physical NFC/Bluetooth/offline tests still require compatible devices. |


## Phase 8 quality-gate result (2026-10-31)

| Date UTC | Result | Evidence |
|---|---|---|
| 2026-10-31 | Corrected the mobile landing-page E2E test to close the responsive navigation using its supported Escape-key behavior; mobile coverage remains enabled. | Commit `b29f375a3e04b0798bb1e0a5954cedf7e3aaafbc`. |
| 2026-10-31 | Full Phase 8 quality gate passed on main. | [GitHub Actions run 41197878072](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41197878072): disposable PostgreSQL 16 migration, API checks/tests, web tests, database integration tests, Playwright browser journeys (11 passed), web production build and API build. |
| 2026-10-31 | Corrected workflow placement and added the Phase 9 smoke-test entry point. | Canonical workflows are now at repository root `.github/workflows/ephinta-phase8-quality-gate.yml` and `.github/workflows/ephinta-phase9-staging-smoke.yml`; Phase 9 HTTPS smoke script is `scripts/phase9-production-smoke-test.sh`. Staging URL variables and a manual staging run are still required. |
| 2026-10-31 | Confirmed latest API/web Render deployments for the E2E test fix are live. | API deploy `dep-dbit7mbm8hqs73f61qhg`; web deploy `dep-dbit7mbm8hqs73f61r40`. |

## Verification follow-up (2026-11-07)

This section supersedes no historical evidence above. It records the latest checks and keeps unresolved acceptance gates visible.

### Confirmed in this follow-up

- Parent EPHINTA design tokens are now imported by the active web entry point, `apps/web/src/main.tsx`, after the older global stylesheets. Commit: `bfbbc01844cad8a0481f2e85308a74fddda8dc86`.
- The shared design stylesheet now covers the guided event builder, authentication modal classes, and semantic dialogs using `role="dialog"`, `aria-modal="true"`, and native open dialogs. Commit: `56999617148d6bbde7f7a78796ed6dd010104f4c`.
- The frontend design audit now checks that the parent stylesheet is imported last and that required parent tokens and shared dialog selectors exist.
- The canonical root-level desktop/mobile browser E2E workflow is `.github/workflows/ephinta-browser-e2e.yml`. The older workflow copy under the application directory is not a GitHub-discovered workflow path; a redundant root-level duplicate created during this follow-up was removed.
- Render frontend and API deployments for commit `233448e03790b116a68c961b78dcd93408ecdeba` completed successfully. The next commit `56999617148d6bbde7f7a78796ed6dd010104f4c` was deploying at the time of this update; do not mark that deployment complete until Render confirms it.
- Read-only Render API request logs recorded `/health` HTTP 200 and repeated `/ready` HTTP 200 responses. The API startup migration step reported 24 migrations found and no pending migrations.
- Read-only PostgreSQL verification reported 24 migration records, 24 finished migrations, and 0 unfinished migrations. No application rows were modified.

### Remaining acceptance gates — do not mark complete yet

- GitHub Actions results for the current main head must be checked: API/web tests, strict design audit, Playwright journeys, disposable PostgreSQL integration tests, web build, and Android debug APK build.
- Authenticated client/planner/vendor journeys, role-isolation negatives, event creation/resume, vendor enquiries, messaging/notifications, cart/checkout, and payment/ledger settlement still require seeded isolated test fixtures and successful E2E evidence.
- Payment adapter source currently exposes Paystack, Flutterwave, Stripe-ready, OPay, and demo provider names. Cleva and Eversend adapters are not present in the inspected payment provider registry. Do not claim either integration is complete or enable real payment traffic without provider specifications, sandbox credentials, webhook verification, and settlement tests.
- The production database backup has not completed a disposable restore rehearsal. Preserve the production database; no destructive restore or reset is authorized.
- The Render Free PostgreSQL instance is reported to expire on 2026-11-26. Establish an owner-approved no-cost continuity path before that date; do not create a paid resource or move production data without approval.
- Render install logs still report dependency audit findings (13 in the API install and 2 in the web install at the time inspected). Do not run `npm audit fix --force`; triage exact advisories and apply compatible updates with regression tests.
- Android physical-device installation, permissions, offline/NFC/Bluetooth journeys, iOS build/device verification, Firebase push delivery, and production-signed Android release remain open. The signed release workflow requires the owner-controlled keystore secrets and certificate fingerprint; those secret values cannot be read or generated in this chat.
- The Android debug APK workflow produces a device-test artifact only; it is not a production-signed release.
- Live provider settlement, real payouts/refunds, push delivery, restore rehearsal, and physical-device acceptance must be evidenced before production sign-off.


## Final acceptance update — 2026-11-07

This section supersedes older point-in-time workflow and deployment statements above where revisions differ. It records the current repository inspection; it does not convert external/owner-dependent checks into completed work.

### Source and deployment snapshot

- Repository: `demtaiwo1-eng/Winning-game-`; target branch: `main`.
- Main revision inspected: `742739733399729409c6fa877e395a2fb143f94a`.
- PR #68 (parent design system, responsive questionnaire/audio-consent correction and acceptance audit) is merged.
- Render web and API services were previously observed live, and the API readiness endpoint returned HTTP 200. Reconfirm both services against the post-merge main revision after the new acceptance PR is merged; a successful prior deploy is not proof that a later commit has deployed.
- Android debug APK build job in workflow run `42420006588` completed successfully. At the last inspection, Android API 35 emulator install/launch was still in progress and API 36 was queued. Do not mark the matrix complete until both jobs finish successfully; a CI APK build is not a physical-device test.
- Open PR #65 (`integration/ephinta-design-system-main`) is not mergeable at this inspection. It contains a broad 27-file change set; do not merge it wholesale. Review individual changes against current main before reusing any.
- The repository currently has multiple non-main branches. Preserve branches with unique commits or open PRs. A proposed cleanup workflow is added separately and is intentionally restricted to branches with zero commits ahead of main, excluding protected branches and branches referenced by open PRs.

### New CI safeguards proposed on `ops/ephinta-final-acceptance-20261107`

- Add an unsigned iOS Simulator build workflow using macOS/Xcode, Capacitor iOS sync, and an uploaded simulator artifact. This verifies simulator compilation only; it does not create a signed iPhone install or App Store release.
- Add conservative branch cleanup automation. It deletes only branches whose GitHub comparison reports zero commits ahead of main; it skips protected branches, branches with open PRs, and branches whose comparison cannot be verified. The branch containing unique OPay work must remain preserved until separately reviewed.
- These safeguards are proposed changes until their pull request is reviewed, merged, and their own CI runs pass.

### Remaining release gates — not safely automatable without owner/provider evidence

1. **Cleva and Eversend:** neither adapter exists in the inspected provider registry. Implementation requires the current official API contracts, account eligibility, sandbox credentials in Render's secret store, webhook signing rules, settlement/reconciliation references, and provider approval. Do not invent endpoints or enable real-money traffic.
2. **OPay:** existing sandbox collection code is present, but provider-side sandbox collection, webhook signature/replay handling, settlement reconciliation, refund/payout and FX capabilities must each be tested against actual sandbox credentials before claiming acceptance.
3. **Production Android:** debug APK is not a production release. Owner must configure an Android upload/release keystore or Play App Signing and protected GitHub Actions secrets. Never commit a keystore or disclose passwords. Then build, verify signature, install and test on a physical device.
4. **iOS distribution:** unsigned simulator build is not a physical-device/App Store build. Owner must supply Apple Developer team access, bundle identifier approval, signing certificate, provisioning profile, and protected CI credentials. No Apple credentials are available in the repository.
5. **Physical device acceptance:** owner must install the APK on a real Android phone and test registration/sign-in (including wrong password), client/planner/vendor journeys, messaging, permissions, offline check-in, push notifications, and payment sandbox. Emulator tests cannot prove hardware NFC/Bluetooth/camera behavior.
6. **Database restore and continuity:** the existing backup has only had its archive header inspected according to the restore runbook. Complete `pg_restore --list` and a full restore to a newly created disposable PostgreSQL target; never restore over production. The Render Free database has a reported expiry of 2026-11-26; owner must approve a no-cost continuity destination and preserve a verified backup before that date. No paid resource or destructive database operation is authorized.
7. **Dependency security:** the repository has a reporting-only npm audit workflow. Historical reports recorded 13 total advisories (1 critical, 2 high, 8 moderate, 2 low) in one full dependency context; production-only audit previously reported zero. Re-run the audit on the current lockfile, identify exact vulnerable dependency paths, apply compatible targeted updates (including a planned Capacitor major-version migration if still required), and rerun all API/web/mobile checks. Do not use `npm audit fix --force`.
8. **Authenticated end-to-end journeys and financial integrity:** complete seeded isolated client/planner/vendor browser journeys, role/tenant negative tests, payment webhook signature/replay tests, idempotent ledger settlement/refund tests, currency isolation, and provider sandbox settlement. Existing unit/API tests and public browser checks are not substitutes for these acceptance journeys.
9. **Operational sign-off:** verify current Render deployment commit, public smoke tests, logs/alerts, rollback procedure, database backup and restore evidence, privacy/consent and accessibility/performance checks, then obtain explicit owner production approval.

### Safety decision

Do not label EPHINTA production-ready until all owner/provider/device/database gates above have evidence. Keep payment collection in sandbox/test mode, paid entitlements fail-closed, and advertising disabled until their required approvals and configuration exist.

## Release-readiness follow-up — 2026-11-08

This section records the work completed after the 2026-11-07 acceptance snapshot. It does not waive owner/provider/device gates.

### Merged to main

- PR #75 merged as `181525b463a0eda7ab5bb584490c5f96b084a907`. Its final PR head passed the parent-theme, responsive UX, API/database, browser journey, Android compatibility, iOS Simulator and application verification workflows.
- PR #76 merged as `d31670c54779a7cb30f8ca839618c1095c624f32`. It adds a manual owner-controlled Android signed APK/AAB workflow and gives the full-stack verification job a disposable PostgreSQL 16 service. All five PR verification workflows passed, including the full-stack startup smoke, web/Android build and unsigned iOS Simulator build.
- Render API service `ephinta_wss` and static site `ephinta-web` have live deployments for main commit `cf3fd323e6356c963103f4bcf9a401437a89598c` (verified 2026-11-08). The API reports `/health` and `/ready` HTTP 200; 24 migrations are applied and baseline categories/plans initialize. This is deployment evidence, not a physical-device or live-payment sign-off.

### Prepared and under review

- PR #83 merged as `cf3fd323e6356c963103f4bcf9a401437a89598c`. All six verification workflows passed, including a dedicated PostgreSQL 16 custom-format dump/restore into an empty disposable DB and refusal of a non-empty target. This validates the restore script against a synthetic fixture, not the owner's actual archive.
- PR #80 merged as `7c7df407e752e42da230a4033e4d466af2b53643`; it documents OPay and Eversend merchant onboarding and the Cleva product/API documentation gap.
- PR #81 merged as `926b05d2ff3df4c76172b0e69e056efda3b0883d`; it prepares an owner-controlled App Store Connect signed IPA workflow for bundle ID `com.eventselfsolutions.app`. The pull-request YAML validation and all five application verification workflows passed; actual signing still requires Apple owner secrets.
- PR #82 prepares a Codespaces helper that creates an Android upload key in the owner's home directory and writes its four values directly to protected GitHub Actions secrets through GitHub CLI stdin. It refuses to overwrite existing keys/secrets.
- The Android signed-release workflow is merged, but no production-signed APK/AAB exists until the owner runs the Codespaces helper (or configures the four secrets manually) and dispatches the workflow.

### Still open — actual evidence required

1. **Android signing:** generate and securely back up the owner upload keystore, configure the four repository secrets, run the signed release workflow, verify the certificate fingerprint, and install the resulting signed APK on a physical device.
2. **Database backup:** the historical owner archive `ephinta_db_20261030.dump` was reported as uploaded to the owner's Google Drive, but its exact bytes and full checksum are not available in this workspace. The backup register workbook still has blank filename/size/checksum/verification fields. The archive itself is not available in this repository or current ChatGPT file library; its exact bytes must be supplied from the owner's secure Google Drive copy before a full restore rehearsal can be performed. Synthetic CI fixtures do not validate the owner archive.
3. **Cleva:** confirm whether the intended product is Cleva Global merchant payments or the separate GetCleva wallet product. Cleva Global's public integration page currently marks API documentation as coming soon. Obtain the account-specific official API contract and sandbox access before coding an adapter.
4. **Eversend:** complete business verification, request Merchant API access, obtain credentials and whitelist the required outbound IP. Then implement and test only the approved endpoints.
5. **OPay:** existing Nigeria cashier integration remains sandbox. Obtain live merchant approval and complete OPay joint testing, webhook verification, reconciliation and separately approved refund/payout/FX tests before live mode.
6. **iOS:** configure Apple Distribution P12, App Store provisioning profile and Team ID secrets; run the signed IPA workflow, submit to TestFlight, and test on a physical iPhone.
7. **Physical-device acceptance:** complete the real-device checklist for install, registration/sign-in, navigation, permissions, offline, NFC/Bluetooth where supported, notifications and sandbox payments.
8. **Database continuity:** the Render Free database's previously reported expiry of 2026-11-26 remains a time-sensitive continuity risk. No paid resource or production database change has been made.

### Safety status

- No production database reset, restore, destructive migration, or credential rotation was performed.
- No signing key, Apple certificate, provisioning profile, merchant secret or live payment credential was generated or committed.
- Payment traffic remains sandbox/test and live provider operations remain blocked pending explicit provider and owner acceptance.


## Final acceptance snapshot — 2026-11-09

This snapshot records the current main commit and distinguishes automated CI/deployment evidence from owner-controlled release gates.

### Current main and automated evidence

- Canonical main commit: `ea8244f42add91a08b24a62a652b1fe021544605` (PR #137).
- On that commit, GitHub Actions runs completed successfully for web checks + Android debug APK build (run `42547397876`), browser E2E and API database integration (run `42547397988`), dependency security audit (run `42547397882`), GitHub Pages build/deployment (run `42547397889`), and verified APK publication (run `42547670253`).
- The APK publication job downloaded the successful debug APK artifact, verified its artifact ZIP digest, and published the installable **unsigned debug/test APK** as release `ephinta-apk-42547397876`, asset `ephinta-869.apk`. This is not a production-signed APK.
- Render static site `ephinta-web` and API `ephinta_wss` both built and deployed commit `ea8244f42add91a08b24a62a652b1fe021544605` successfully on 2026-11-09. The API deployment completed successfully; the static site build output reports the PWA service worker and 86 precache entries.
- Android compatibility matrix run `42545346593` was on the prior commit `ac4eb659e461086c9a3dd29e9f19338e8e14921e`: API 35 install/launch failed amid ADB/emulator system-service instability, while API 36 was still in progress at last inspection. Do not count that matrix as a pass or as proof of an EPHINTA app crash.
- The branch-cleanup workflow completed successfully, but deliberately retained branches with unique commits and the open Bytid PR. It did not merge or delete those branches.

### Repository consolidation

- Branches whose contents were verified identical to main were aligned to the current main commit during the consolidation pass.
- Remaining divergent branches contain unique file differences and are not safe to merge wholesale. In particular, retain the Bytid KYC draft for review, preserve current Android signing scripts/workflows over older variants, and do not port the device-security branch's camera permission removals.
- PR #129 (`feature/ephinta-bytid-kyc-20261108`) remains draft and non-mergeable against its stale base. The current main KYC route includes stricter outcome handling than the older branch version. Review and selectively port only improvements that pass API/web/database checks.
- Do not delete branches with unique commits until every useful change is either merged or explicitly rejected after review.

### Remaining owner/provider acceptance gates

1. **Android release signing:** configure the owner-controlled keystore and protected GitHub Actions secrets/variable described in `ANDROID_SIGNED_RELEASE.md`; verify the encrypted backup; run the production signed workflow; independently verify its certificate; install the signed build on a physical Android device.
2. **Physical-device acceptance:** test registration and wrong-password handling, customer/planner/vendor journeys, messaging, navigation/back behavior, camera/file permissions, offline check-in, and sandbox payments on a real supported phone. CI/emulator evidence is not a substitute.
3. **Payments:** OPay remains sandbox until merchant-side joint testing, signed webhook/replay checks, settlement/reconciliation, and separately approved refund/payout/FX checks pass. Cleva and Eversend must not be implemented against guessed API contracts; obtain account-specific official documentation, sandbox access, credentials and webhook rules first.
4. **Bytid KYC:** configure the sandbox API key and webhook secret in the Render API service, register the webhook, and complete provider deterministic sandbox journeys. Keep live KYC disabled until pricing, consent, privacy and owner approval are complete.
5. **Database continuity:** complete a full restore of the owner's actual backup to a disposable PostgreSQL target, never production. Reconfirm the Render Free database continuity plan before its previously reported 2026-11-26 expiry.
6. **Production operations:** complete authenticated role-isolation and financial-ledger E2E coverage, provider sandbox settlement evidence, dependency advisory remediation, measured accessibility/performance review, monitoring/rollback rehearsal and explicit owner release approval.
7. **Public URL acceptance:** Render deployment events confirm successful deployments to `https://ephinta-web.onrender.com` and `https://ephinta-wss.onrender.com`. The separate `https://ephinta.github.io` URL was not independently verified in this pass; do not treat it as the confirmed production URL.

### Release decision

**Status: CI green and Render deployments successful; production release NOT SIGNED OFF.** Keep live payment operations, paid entitlements, live KYC and public store distribution disabled until their corresponding owner/provider/device evidence exists. No production database reset, restore, secret rotation, paid Render upgrade or live-payment activation was performed in this consolidation pass.
