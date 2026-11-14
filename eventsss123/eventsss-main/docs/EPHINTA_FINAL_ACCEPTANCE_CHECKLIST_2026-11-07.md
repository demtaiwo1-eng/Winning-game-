# EPHINTA final acceptance checklist — 2026-11-07

This checklist separates work that can be automated in GitHub from work that requires the repository owner, a provider account, a real device, or an isolated database. Do not mark a gate complete without its evidence.

## GitHub / CI

- [ ] Merge the final acceptance PR only after review and all required checks pass.
- [ ] Confirm the current `main` head has successful API, web, PostgreSQL integration, browser, design-system, Android build, and Android emulator jobs.
- [ ] Confirm the iOS Simulator workflow builds and uploads the unsigned `.app` artifact.
- [ ] Confirm branch cleanup deletes only refs with zero commits ahead of `main`; retain unique work and open-PR branches.
- [ ] Inspect the OPay collection branch's unique commits before any deletion or cherry-pick.

## Provider credentials and payment acceptance

Never send provider secrets in chat or commit them. Add credentials only to the appropriate protected Render environment variables after the official provider contract and sandbox access are confirmed.

- [ ] OPay sandbox: create/confirm sandbox credentials, validate collection, signature verification, duplicate webhook rejection, status reconciliation and ledger idempotency.
- [ ] Cleva: obtain current official API docs, account eligibility, sandbox credentials, webhook signing details and settlement/reference model; then implement and test the adapter.
- [ ] Eversend: obtain current official API docs, account eligibility, sandbox credentials, webhook signing details and settlement/reference model; then implement and test the adapter.
- [ ] Keep payouts, refunds and FX disabled until each specific operation is approved and independently tested.
- [ ] Verify demo/test payment endpoints fail closed in production and that paid subscriptions cannot activate without verified server-side payment.

## Android release

- [ ] Configure a repository-owner-controlled upload keystore or Play App Signing.
- [ ] Store signing material and passwords only as protected GitHub Actions secrets; never commit them.
- [ ] Produce a release-signed APK/AAB and verify its certificate, package ID, version code, checksum and archive integrity.
- [ ] Install on a physical Android phone; test fresh install, upgrade, launcher icon, splash screen, login, role journeys, push permission, camera/file access, deep links, Android Back, offline check-in and supported NFC/Bluetooth hardware.

## iOS release

- [ ] Owner confirms Apple Developer account/team and final bundle ID.
- [ ] Configure Apple signing certificate, provisioning profile and protected CI secrets.
- [ ] Build a signed device archive and validate on a physical iPhone.
- [ ] Test login, push permission, deep links, file/camera permissions, offline flows and payment redirects.
- [ ] Complete App Store privacy, screenshots, review and release requirements.

## Database and operations

- [ ] Verify the owner backup filename, size and SHA-256 against the recorded backup evidence.
- [ ] Run `pg_restore --list` against the backup.
- [ ] Provision a newly created disposable PostgreSQL 16-compatible target; verify it is not production and is empty.
- [ ] Restore only into that disposable target and run migration/API integration checks against it.
- [ ] Compare representative table counts; preserve the live database unchanged.
- [ ] Before the reported 2026-11-26 Render Free database expiry, owner approves and verifies a no-cost continuity destination. Do not create paid resources without approval.
- [ ] Verify current Render web/API deployed commit, health/readiness, error logs, rollback instructions and alerting.

## Security, accessibility and user journeys

- [ ] Run current `npm audit --json` and `npm audit --omit=dev --json`; triage exact advisories and dependency paths.
- [ ] Apply compatible, targeted dependency updates. Avoid `npm audit fix --force`; plan a coordinated Capacitor major upgrade if still necessary.
- [ ] Rerun API tests, web tests, browser tests, build, Android build, iOS simulator build and emulator tests after dependency changes.
- [ ] Run authenticated client, planner and vendor journeys with isolated seeded data.
- [ ] Verify wrong-password and invalid-registration handling, ownership/tenant isolation, messaging, notifications, vendor enquiries, event deposits, part-payment requests and planner-to-group messages.
- [ ] Verify webhook signature, replay protection, idempotency, currency isolation and append-only ledger invariants.
- [ ] Check accessibility, keyboard navigation, contrast, responsive layouts and measured performance budgets.
- [ ] Obtain explicit owner production sign-off only after evidence is recorded.

## Current limitations

- Cleva and Eversend are not implemented in the current provider registry.
- Debug APKs and unsigned iOS simulator builds are not production-signed mobile releases.
- A real device, Apple/Android signing credentials, provider sandbox credentials and a disposable database target are owner-controlled prerequisites.
- A passing CI run does not prove physical-device, provider settlement, restore or production-release acceptance.


---

## Consolidated conversation audit — 2026-11-14

This section supersedes any older fee/provider statements elsewhere in this historical checklist. Evidence is tied to the current release-candidate work; a code test is not live-provider, legal, or physical-device acceptance.

### Verified in code or CI

- [x] Wrong-password and unknown-email login return the same safe `401 INVALID_CREDENTIALS` response; the real database regression test is enabled by `RUN_DB_TESTS=1` in the browser workflow's PostgreSQL integration job.
- [x] Registration tests cover duplicate-email rejection, password hashing, and safe response fields; password-schema tests cover the minimum length/special-character rule.
- [x] NGN wallet top-up fee is fixed at 2% (200 bps) in `feePolicy.ts`.
- [x] Outgoing OPay bank-withdrawal fee is fixed at 2% (200 bps); payout failure/reversal handling and idempotent ledger entries are implemented in the API.
- [x] OPay bank-transfer adapter tests cover bank listing, account-name resolution, HMAC-SHA512 request signing, transfer status, disabled transfers, invalid hosts, and duplicate references. These are mocked tests, not live OPay settlement.
- [x] NGN payment selection is OPay-only and rejects unsupported currency/provider fallback; shared DEMO/TEST/LIVE payment mode is stored centrally and checked by the API.
- [x] Root README is colourful and links to the product, API, release, and legal documentation.
- [x] Automated source/asset rights gate passed on release-candidate CI; dependency inventory passed (750 package entries / 12 licence expressions in the recorded snapshot).
- [x] Web/API production build and API PostgreSQL integration passed on the candidate test cycle.
- [x] Responsive web build/audit, security audit, Phase 8 gate, Windows verification, iOS Simulator build, and 5,000 mocked payment journeys passed in the recorded candidate cycle.
- [x] A debug/test APK was built and uploaded as artifact `ephinta-android-debug-apk` from workflow run [43580236911](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/43580236911). SHA-256 of the extracted APK: `43368bb14fbd6505a259a9396c13ba85021a992251a2e1c0bdaa5bbfda387084`. This is not a production-signed release.

### Corrected, awaiting rerun evidence

- [x] Browser payment-persona test selector was corrected to match the actual client header button accessible name, `Open payments and wallet`, in commit `4f12ae7270b89434a26a8b5f39d4fff382646b0e`.
- [ ] The corrected desktop/mobile browser journey must finish green. The previous run failed because the test used a mismatched accessible name; do not count that run as passed.
- [ ] Current 5,000 synthetic-user load campaign must finish successfully.
- [ ] The 7,000-fixture / 300-user scale campaign must be rerun to a successful conclusion; the recorded attempt was cancelled and is not a pass.
- [ ] Android API 35 and API 36 emulator install **and launch** jobs must both finish successfully. APK compilation alone is not enough.

### Still blocked by owner/provider/device/legal actions

- [ ] **Production Android signing:** no prior production release key exists and the one-time key generation/configuration has not been completed. The debug APK cannot be used as a production update identity. Follow `docs/ANDROID-GITHUB-SIGNING.md`; configure the owner-controlled keystore, passwords and certificate fingerprint only through protected GitHub secrets/variables. Then run the production-signed APK workflow and verify its signature/package/version.
- [ ] **Physical Android acceptance:** install on a real phone and test fresh install, upgrade, launcher/splash, login, roles, Android Back, deep links, push, camera/file permissions, offline check-in and supported NFC/Bluetooth hardware.
- [ ] **iOS release:** simulator build is not a signed iPhone build; Apple account/team, signing, provisioning, device test and App Store acceptance remain open.
- [ ] **Paid-only access:** not implemented end-to-end. Paid subscription creation deliberately returns `PAID_SUBSCRIPTIONS_UNAVAILABLE`; purchase, provider verification, entitlement grant/expiry/refund and server-side paid feature enforcement must be completed before activating a global paywall.
- [ ] **OPay live operation:** merchant entitlement, production credentials, webhook registration, funded settlement balance, joint sandbox acceptance and a provider-approved low-value live reconciliation remain unverified. Do not infer real collection, payout, refund or settlement from mocks.
- [ ] **Cleva and Eversend:** neither adapter is present in the API provider registry. Obtain the exact provider product/API contract, merchant eligibility, sandbox credentials, webhook signatures and settlement rules before implementation. Keep both disabled until individually tested.
- [ ] **KYC / Bytid:** code and setup guide exist, but owner-issued sandbox API key, webhook registration and end-to-end sandbox result are not evidenced. Live KYC requires separate approval, privacy review and consent.
- [ ] **Email/push delivery:** notification UI/API tests do not prove real SMTP, browser push or Firebase delivery. Provider configuration and physical-device permission/delivery evidence remain open.
- [ ] **Planner and vendor journeys:** separately prove event creation/edit/resume, budget/task/guest/RSVP, event deposit reflected in wallet/dashboard, vendor part-payment requests for essentials, service completion verification, and planner messages to individuals and groups using authenticated isolated accounts.
- [ ] **Chatbot and admin-wide updates:** verify the assistant's actual role-aware guidance and minimizable UI, and prove that admin configuration changes propagate safely to web/PWA/installed clients. Server-side payment-mode centralisation exists; it does not mean every setting or native-code change updates every installed app without a release.
- [ ] **Database backup/restore:** verify the recorded owner backup with `pg_restore --list`, restore only into a disposable PostgreSQL target, compare representative table counts, and keep production data untouched. Confirm the Render Free database continuity plan before the recorded 2026-11-26 expiry; do not create paid resources without owner approval.
- [ ] **Plagiarism / IP / licensing:** public GitHub source-similarity investigation is targeted, not exhaustive and not a plagiarism-free certificate. Confirm legal copyright holder, signed collaborator IP assignment/commercial licence, logo/avatar asset provenance, and package-specific notices (including SPDX fallback entries) before exclusive commercial claims.
- [ ] **Commercial/legal controls:** confirm legal terms, privacy, refunds, consumer disclosures, tax/regulatory position and repository visibility. The repository is public in the inspected configuration; a proprietary notice alone does not make it private.
- [ ] **Git integration/cleanup:** PR #187 remains open; do not merge or delete branches while required checks are pending/failed/cancelled or release/legal/provider gates remain open. The inspected repository still has multiple non-main branches. Merge only after the final head is green and the owner has reviewed the release blockers; delete only branches proven fully merged and no longer needed.

### Release decision

**NOT APPROVED for public production launch yet.** The candidate has meaningful green automated checks and a buildable debug APK, but the corrected browser journey, scale campaigns, Android install/launch matrix, production signing, paid-access workflow, provider acceptance, physical-device testing, backup restore and legal chain-of-title are not all proven. Keep real-money movement and the global paid-only gate disabled until their acceptance criteria pass.
