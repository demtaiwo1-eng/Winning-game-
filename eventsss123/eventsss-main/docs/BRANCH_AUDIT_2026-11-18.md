# EPHINTA branch audit — 18 November 2026

## Scope and method

Compared the current `main` head with every branch returned by GitHub's repository branch listing. This is a metadata and changed-file inventory, not a substitute for compiling, testing, or reviewing every patch. No branch was merged, force-pushed, or deleted during this audit.

- Audited base: `main` at `bbb16ed59c09d8174fa6cac0397819115493c70d`.
- GitHub reported no open pull requests.
- The current main commit returned no status-check entries and no associated workflow runs through the queried commit endpoints. This does **not** mean CI passed.
- The repository contains 39 non-main branches in the listing (40 branches total including main).

## Branch decisions

### Keep out of main pending selective review

- `qa/payment-notification-100-personas-20261113`
- `qa/payment-notifications-main-20261115`
- `qa/payment-notifications-main-20261116`
- `qa/payment-personas-wallet-selector-fix-20261117`
- `integration/selected-payment-persona-navigation-fix-20261117`

These branches change or add `payment-notification-personas.spec.ts`; the 100-persona branch also adds worldwide persona test data and a persona runner. They are deliberately excluded in accordance with the product decision to remove the 100 vendor payment-persona journeys/workflow. Do not reintroduce them through a broader integration branch.

### Do not merge wholesale — large destructive or unrelated diffs

- `maintenance/final-cleanup-20261114`
- `maintenance/licensed-audio-e2e-fix-20261114`
- `maintenance/verification-matrix-20261114`
- `release/paid-access-readme-payment-audit-20261113`
- `audit/ephinta-ip-paid-access-readme-20261114`

The compared diffs report roughly 300 changed paths, including around 287 removals of bundled Remotion skill/reference assets. Those removals are not approved as a side effect of EPHINTA integration. Recover only individually reviewed documentation/workflow changes if still needed.

- `integration/ephinta-release-android-verified-20261114` also contains extensive bundled Remotion asset removals alongside release workflows and docs. Do not merge it wholesale.
- `integration/ephinta-release-candidate-final-20261114` and `integration/ephinta-unified-final-20261114` are historical integration candidates with large, diverged histories; inspect file-by-file before recovery.

### Potentially valuable feature/recovery branches — selective recovery only

- `feat/planner-operations-finance-kyc-20261109` — planner messaging, notifications, KYC and portal changes; 78 commits ahead / 234 behind in the comparison.
- `feature/ephinta-bytid-kyc-20261108` — BytID KYC adapter, KYC routes/UI and tests; 20 ahead / 311 behind.
- `feature/ephinta-device-security-20261108` — device security gate, Android/iOS manifest settings and smoke workflow; 14 ahead / 311 behind.
- `feature/experience-modes-gamified-demo-20261116` — experience-mode component and global CSS; 5 ahead / 96 behind.
- `feature/global-theme-contrast-20261116` — theme contrast and marketplace/E2E adjustments; 7 ahead / 93 behind. The theme contract file is already present on main; avoid duplicating it.
- `feature/isolated-demo-marketplace-catalogue-20261116` — demo catalogue variant; 3 ahead / 93 behind. Main already contains a 2,000-record clearly labelled local demo catalogue; the branch variant inspected contained 1,200 records, so do not replace main with it.
- `fix/customer-journey-landing-location-20261114` — landing page, public journeys, responsive UX and audio changes; 35 ahead / 108 behind.
- `fix/ephinta-869-compatible-release` — production APK workflow and completion script; 6 ahead / 233 behind.
- `fix/ephinta-marketplace-carousel-portal-ui-20261109` — marketplace, audio, remote update and release changes; 69 ahead / 235 behind.
- `fix/ephinta-registration-planner-and-youtube-oauth` — registration/planner journeys, audio/theme styles and YouTube playlist sync; 79 ahead / 319 behind. Review OAuth scopes and secrets handling before recovery.
- `fix/opay-provider-display-20261113` — fee policy, payout and provider display changes; 15 ahead / 115 behind. The inspected wallet UI was identical to main and fee-policy behavior is already substantially represented on main; no wholesale merge is justified.
- `integration/ephinta-planner-music-rebased-20261108` — planner journeys, audio and playlist sync; 24 ahead / 307 behind.
- `integration/ephinta-unified-20261114` — unified integration candidate; inspect each changed path before recovery.
- `integration/recover-verified-feature-fixes-20261108` — six frontend/E2E paths; 7 ahead / 312 behind.
- `recovery/ephinta-planner-budget-format-20261108` — planner budget formatting and related E2E changes; 3 ahead / 319 behind.
- `recovery/ephinta-responsive-music-player-20261108` — audio player and responsive styling; 20 ahead / 319 behind.
- `recovery/ephinta-theme-text-contrast-20261108` — theme CSS, main entrypoint and workflow; 11 ahead / 319 behind.
- `verify/ephinta-main-acceptance-20261107` — responsive UX, design quality gate and completion tracker; 10 ahead / 326 behind.

### Android/iOS release and signing candidates

- `release/android-production-ota-main-20261108`
- `release/android-production-signing-main-20261108`
- `release/android-signed-ci-20261108`
- `release/android-signing-helper-20261108`
- `release/android-signing-helper-current-20261108`
- `release/ios-signed-ci-20261108`
- `codespace-fantastic-memory-xrx467jxj56r2j4r`

These contain release workflows, signing scripts and release documentation. Recover only after verifying that the workflow secrets are referenced safely, the workflow permissions are least-privilege, and no signing key or generated artifact is committed. Signing secrets must be configured in GitHub/Render settings, never pasted into chat or committed.

### Automation branch

- `automation/integrate-all-branches-one-go-20261117` — adds `scripts/integrate-all-branches-one-go.sh`. The script requires a local clone, GitHub CLI authentication and local package installation/build commands. It is not runnable by this user without a Codespace/local environment and is not a GitHub-hosted one-click workflow. It creates PRs for every branch and only merges after checks, but its broad PR creation is not a substitute for the file-level exclusions above. Do not run it unchanged.

## Next safe sequence

1. Review each candidate branch's unique commits and exact patch, not merely its branch name or commit count.
2. Recover small, independently safe files/patches into a dedicated integration branch or PR; preserve current main versions of files that already contain newer fixes.
3. Run GitHub Actions on each PR and require all applicable checks to pass. A missing status/check result is not a pass.
4. Keep payment-persona workflow branches excluded.
5. Keep the 287-file deletion candidates blocked unless each removal is independently approved.
6. Only after all unique work is either integrated or explicitly rejected should non-main branches be considered for deletion.

## Current outcome

This audit did not merge or delete any branch. No local/Codespace execution was performed. Main remains at the audited SHA until a reviewed patch is committed. The database-backed OPay refund reconciliation tests and the rest of the application checks still require execution in CI or an available PostgreSQL-backed runner.


## Follow-up selective recovery findings

### Device security branch — no merge needed

A direct file comparison confirms the device-security implementation is already present on `main`:
- `apps/web/src/components/DeviceSecurityGate.tsx` exists on main with additional hardening over the branch version, including guarded localStorage access, account-change reset, and persisted failed-attempt counters.
- `apps/web/src/App.tsx` already imports and wraps authenticated content with `DeviceSecurityGate`.
- `apps/web/package.json` already includes `@aparajita/capacitor-biometric-auth`.
- The device-security documentation is already on main.

Decision: do not merge `feature/ephinta-device-security-20261108`; its relevant functionality is already integrated, and main's version is more recent.

### Planner operations branch — backend/UI implementation already present

Direct content-hash comparisons show that the branch's message service, message routes, message schemas, message API tests, database tests, notification routes, event messages panel, notifications panel and KYC upload component are byte-for-byte identical to main. Its remaining changed schema and enterprise/E2E files are older than main and would roll back newer main behavior (including the payment-refund lifecycle and device-lock-aware E2E helper).

Decision: no merge needed for `feat/planner-operations-finance-kyc-20261109`; do not merge its older schema, E2E or enterprise files over main. This is a strong candidate for later branch deletion once all other paths and commits are accounted for.

### Registration / planner / YouTube branch — newer main already supersedes most UI

The branch's unified design-system CSS is identical to main. The branch's PublicLanding, AudioExperience, API client and theme-contrast CSS are shorter/older than main; its public journey E2E file predates main's device-security setup helper. The branch also introduces a scheduled YouTube playlist sync workflow and OAuth bootstrap scripts that require owner-provided Google OAuth credentials and an explicit choice to connect the named YouTube account.

Decision: do not merge the branch wholesale. Keep the playlist-sync workflow and OAuth scripts out of main until the account owner explicitly confirms this integration and its account scope. The existing main UI and E2E files should be preserved.


### Device-security native files — main is newer

Additional direct comparisons confirm that main should be retained:
- Android manifest on main includes biometric permission plus the existing camera and location permissions; the branch copy is older and would remove the latter permissions.
- iOS Info.plist on main includes Face ID, camera and location purpose descriptions; the branch copy contains only the Face ID description and would remove current purpose strings.
- The Android install-smoke workflow on main is deliberately scoped to native Android changes; the branch version triggers on all web/mobile changes and would increase expensive emulator runs.
- The main Android emulator smoke script is the current version; the branch copy is older.

### Bytid KYC branch — implementation already on main and hardened further

The Bytid client, KYC route integration and environment configuration are present on main. Main's KYC routes include a more conservative rejection classifier than the branch version. The branch documentation and implementation do not need wholesale recovery. Live KYC remains disabled by default; provider credentials and webhook secrets must be configured in the API hosting dashboard.

Decision: no merge needed for `feature/ephinta-bytid-kyc-20261108`.

### Registration / OAuth branch — do not backport stale app files

The branch versions of PublicLanding, AudioExperience, API client and theme-contrast CSS are smaller/older than main. Its public-journey E2E test predates the main device-security gate helper. The only potentially distinct feature is the scheduled read-only YouTube playlist metadata sync, which requires the owner to connect a specific Google/YouTube account and configure OAuth secrets. It is not needed to make the current app work and is not enabled on main.

Decision: preserve current main files; defer YouTube account sync until the owner explicitly asks to connect that account. No OAuth secret should be shared in chat or committed.


### Customer journey / landing location branch — preserve main

Direct comparison of `fix/customer-journey-landing-location-20261114` shows that MarketplaceBrowse and MarketplaceAdStrip are byte-for-byte identical to main. Its PublicLanding is shorter/older; at the first substantive divergence, the branch still changes music category as a side effect of planning navigation, while main explicitly keeps planning navigation separate from user-controlled music consent. Its responsive E2E file is also older and lacks the current audio-consent interaction checks. Android/iOS manifest copies are older than main and omit existing permission purpose declarations.

Decision: do not merge this branch wholesale or backport its older landing/E2E/native files.


### Experience modes branch — implemented on main

`feature/experience-modes-gamified-demo-20261116` adds `ExperienceModeMenu.tsx`, but that component is byte-for-byte identical to main. Main's EnterpriseApp already imports and renders the mode menu and GlobalPaymentModePanel. The branch EnterpriseApp and global CSS are older than main; the verification script is identical to main.

Decision: no merge needed.

### Global theme / public marketplace branch — implementation already present

`feature/global-theme-contrast-20261116` has PublicMarketplaceCatalogue, public-marketplace CSS and public-journey E2E files byte-for-byte identical to main. Its theme-contract CSS is substantially shorter than main's current contract (6,320 bytes versus 15,464 bytes); preserve main.

Decision: no merge needed.

### Isolated demo marketplace catalogue branch — do not overwrite main

Main already contains the larger 2,000-record clearly labelled demo catalogue. The isolated-catalogue branch's older 1,200-record version is not an improvement and must not replace main.


### OPay provider-display branch — reject its Render mode script

The branch's payout documentation is already identical to main, and the branch WalletPanel and payout route are older than main (the branch route lacks main's DEMO-mode payout guard). Main's fee policy already enforces the current 2% wallet-top-up and payout fee rules.

A critical conflict was found in the branch-only `scripts/payments/set-render-payment-mode.mjs`: it directly writes Render environment variables and triggers a deploy, sets incoming/outgoing/booking commission variables to 1%, and switches payment mode outside the database-backed ADMIN control. Main intentionally retires this script and directs mode changes through the authenticated ADMIN dashboard.

The branch also carries a 300-persona QA document; do not import it as a replacement for normal focused tests or reintroduce payment-persona journey workflows.

Decision: do not merge `fix/opay-provider-display-20261113`. Preserve main's fee policy and retired-script safeguard.


### Android Build 869 compatibility branch — no wholesale recovery

The branch changes the production APK workflow, but main's current workflow is larger and more advanced. The added `complete-ephinta-869-update.sh` explicitly requires a trusted local GitHub Codespace, GitHub CLI authentication, Java and Android SDK tools, then downloads the baseline APK, checks signing identity and dispatches the workflow. It therefore does not meet the no-Codespace requirement and cannot be run through the connected GitHub file-editing interface.

Decision: keep the current main release workflow; do not add a helper that the owner cannot execute. Android signing still requires the original keystore and secrets configured in GitHub Settings. Never generate a replacement key to overwrite the installed app's signing identity.


### Responsive music-player recovery branch — main is substantially newer

The branch versions of AudioExperience, its stylesheet and the audio E2E suite are all materially shorter than main. The current main implementation contains additional playback/consent lifecycle and platform handling. The branch should not overwrite it.

### Planner-budget-format recovery branch — stale integration snapshot

This branch only changes the Android Gradle wrapper, public-journey E2E test and EnterpriseApp. Its 3 unique commits are based on a much older main; no standalone new planner-budget implementation was identified in its changed-file list. Preserve current main.

### Verified-feature recovery branch — overlaps older audio and journey snapshots

Its audio E2E, public journey E2E, EnterpriseApp, main entrypoint and audio CSS overlap earlier snapshots already superseded by main. Its theme-contrast stylesheet is an older copy of the current main stylesheet. Do not merge wholesale.


## Follow-up review: marketplace, acceptance, and signing branches

Reviewed 2026-11-18 against the current `main` tree:

- `fix/ephinta-marketplace-carousel-portal-ui-20261109`: diverged (69 commits ahead, 244 behind at comparison). It contains candidate remote-update notice and audio-platform verification additions, but also changes core startup/update behavior, AudioExperience, PublicLanding, app entrypoint, splash behavior, and multiple release workflows. The branch's RemoteUpdateNotice uses localStorage and a remote manifest and attempts native bundle installation; this requires focused security/rollback/API-contract testing before adoption. Do not merge wholesale. Current main already has newer release workflows and app architecture.
- `verify/ephinta-main-acceptance-20261107`: diverged (10 ahead, 335 behind). Adds responsive UX audit coverage and completion-tracker notes but removes `.github/workflows/ess-phase12-e2e.yml`. Keep the workflow removal out. Consider selectively porting only test assertions that remain valid against current routes/design tokens; no test execution was available in this review.
- Android signed-release workflow branch `release/android-signed-ci-20261108`: main already contains a more complete signed-release workflow. The current main workflow uses read-only contents permission for the signed artifact build, dispatch-only signing, owner-configured secrets, certificate fingerprint verification, and temporary keystore cleanup. No replacement needed.
- iOS signed-release branch `release/ios-signed-ci-20261108`: main already contains an iOS signed-distribution workflow with explicit secret validation and signing verification. No replacement needed.
- Android signing-helper branch `release/android-signing-helper-20261108`: helper generates a NEW key and uploads GitHub secrets, but explicitly requires a Codespace and refuses to overwrite existing secret names. It is not suitable for this user workflow (no Codespace) and must not be run against an existing production signing identity. Do not merge/run as a completion shortcut.
- Main's production APK workflow requires owner-configured keystore secrets and a certificate fingerprint, checks API health/readiness, requires physical-device test confirmation for manual dispatch, and verifies the known Build 869 signing identity before publishing. This is the safer existing release gate; it cannot produce a production-signed APK until the owner configures the original signing material in GitHub settings.

No branch was merged or deleted in this review. CI remains unverified where no workflow run/status was returned.


## Follow-up review: maintenance and consolidated release branches

Reviewed 2026-11-18:

- `maintenance/final-cleanup-20261114`, `maintenance/licensed-audio-e2e-fix-20261114`, `maintenance/verification-matrix-20261114`, `audit/ephinta-ip-paid-access-readme-20261114`, and `release/paid-access-readme-payment-audit-20261113` share a large cleanup/removal lineage. They remove the six bundled Wale Waves recordings and many Remotion reference assets. Current `main` has an asset-rights register recording the owner's 17 November 2026 declaration that commercial rights are held for all six recordings and that they are retained for in-app streaming/DSP. Therefore, do not merge the branch's audio deletions or no-audio policy: it conflicts with the current owner-confirmed product requirement. The rights register itself is the authoritative current direction; supporting contracts should remain private.
- The maintenance branch's cleanup workflow is not safe to adopt as-is: its YAML contains two top-level `env:` keys in the same job (the second replaces the first in common YAML parsers), potentially dropping test database/JWT settings. Its trigger also watches quarantine/docs but not all files changed by the cleanup itself. The workflow was not run. Do not merge it wholesale.
- The maintenance branches propose licence inventory and IP release workflows. Main already contains `scripts/qa/ephinta-license-inventory.mjs` and `scripts/qa/ephinta-ip-release-gate.mjs`, plus the asset-rights manifest and register. The workflow wrappers are not present on main, but the candidate maintenance cleanup workflow references additional scripts and npm commands that must be checked against current package scripts before selective adoption. No workflow was copied or run.
- The maintenance branch also proposes a 5,000 mocked payment simulation. It is not a substitute for provider sandbox tests or authenticated end-to-end financial settlement. It was not added to main; keep all 100 payment-persona journey suites excluded as explicitly requested.
- `integration/ephinta-unified-20261114`, `integration/ephinta-unified-final-20261114`, `integration/ephinta-release-android-verified-20261114`, and `integration/ephinta-release-candidate-final-20261114` include payment-persona test coverage in their history/diffs, and remove bundled media and/or active scripts. Keep them out of main as wholesale merges. The unified branch's payout route has a distinct implementation, but requires a complete security, idempotency, ledger, and regression comparison before any selective recovery; no copy was made.
- `integration/ephinta-release-candidate-final-20261114` adds a candidate hardcore-acceptance workflow and non-payment verification workflow. These workflows execute scripts not yet verified against current main and are branch-specific in their triggers. They are candidates for later adaptation, not direct merges. No workflow run was verified.
- `integration/ephinta-planner-music-rebased-20261108` adds YouTube playlist-sync automation and OAuth scripts. This requires explicit owner authorization and configured OAuth credentials; do not activate it or merge it by default. It also changes planner/music navigation and older UI/E2E snapshots. Main already contains the current owner-confirmed audio rights declaration; retain current music product behavior.

No branch was merged or deleted. The 100 payment-persona journey suites remain excluded. CI remains unverified for the candidate workflows described above.


## Follow-up review: exact workflow and documentation comparisons

Reviewed 2026-11-18:

- Rechecked the candidate maintenance workflows against current `main` by fetching both refs and comparing blob contents. `.github/workflows/ephinta-5000-payment-functional.yml`, `.github/workflows/ephinta-license-inventory.yml`, and `.github/workflows/ephinta-one-node-load.yml` are already byte-for-byte identical on `main`; no merge is needed.
- `.github/workflows/ephinta-ip-release-gate.yml` also exists on `main`, but the branch copy is older and omits current path triggers for AudioExperience and the licence-inventory script, plus the current dependency-install and timeout setup. Keep the main version.
- `docs/maintenance/VERIFICATION_MATRIX.md` already exists on main and has a more current required-gates list, including the APK, IP, licence and browser E2E workflows. The branch copy does not add a missing matrix capability.
- `docs/maintenance/LICENSED_AUDIO_TEST_POLICY.md` is byte-for-byte identical to main. No merge is needed.
- The candidate `THIRD_PARTY_NOTICES.md` is not present at the same path on main; however, it contains a dated package inventory snapshot and generated-artifact claims that were not independently verified in this review. Main already has the current third-party audit and licence inventory workflow. Do not copy this historical notice as a release certification.
- The branch-only `.github/workflows/ephinta-maintenance-cleanup.yml` is unsafe to adopt without repair: it declares duplicate top-level job `env:` mappings, so the later Android environment mapping can override database/JWT test settings. It is also narrowly branch-triggered and invokes a large cleanup/test sequence that has not been run against main. No copy made.
- The README from the audit branch is not a safe replacement for main: it contains a release-candidate PR link and dated paid-access/payment statements that need revalidation against current code. Preserve the existing main README.
- No new file was copied and no branch was merged or deleted in this pass. The existing payment-persona exclusion remains in force. CI/test execution remains unverified.


## Follow-up review: release-candidate workflow and payout implementation

Reviewed 2026-11-18:

- `integration/ephinta-release-candidate-final-20261114` adds `.github/workflows/ephinta-hardcore-acceptance.yml` and `scripts/release/ephinta-hardcore-acceptance.mjs`. The runner is designed to execute checks and explicitly report release blockers rather than fabricate passes; however, the workflow is absent from main and has not been run against the current main tree. Its package/workspace assumptions, database migration sequence, Android build requirements, and invoked script list require validation before adoption. It also includes broad Android acceptance in a single 60-minute job. No copy or run performed.
- The candidate branch's package manifest contains `qa:worldwide` and `qa:worldwide:headed` scripts. These are not a reason to reintroduce the explicitly excluded payment-persona journey suite; do not import the candidate package manifest wholesale.
- Both `integration/ephinta-unified-20261114` and `integration/ephinta-unified-final-20261114` carry the same older `payouts.routes.ts` blob (SHA `70b68c3cb3f261601aa1ce3dbb340c8c74f555d3`). Main's current payout route is a distinct, newer blob (SHA `70f3ec56316133bffebe74af2c578ec33e3d428e`) and imports the fee-basis-points policy in addition to the fee calculator. Preserve main's version; do not overwrite it with the integration snapshot. The branch route was not merged.
- The Android verified integration branch's production APK workflow is not a replacement for main's current production-signed workflow. Main retains explicit owner-supplied signing secrets, certificate verification and Build 869 identity checks. The branch Android install workflow expands PR triggers to web source/public assets, while main intentionally scopes the expensive emulator run to native Android inputs and manual dispatch. No workflow change is justified without a verified CI-cost and coverage need.
- No branch was merged or deleted in this pass. No workflow execution or passing CI result was observed.


## Follow-up review: signed mobile release branches

Reviewed 2026-11-18:

- Six release branches were compared individually with main. Their differences are limited to Android/iOS signed-release workflows, signing setup helpers, release documentation, completion notes, and one Gradle wrapper property.
- The Android signed-release workflow from `release/android-production-ota-main-20261108` is older than main: it omits main's `VITE_UPDATE_URL` and `VITE_APP_VERSION` environment configuration. Main retains the newer workflow and its owner-controlled keystore/certificate checks.
- The same branch's production APK workflow differs from main and includes a workflow-level `contents: write` permission for publishing release assets. Main's production APK workflow is the current implementation with explicit per-job permissions, health/readiness checks, signing-material validation, and release artifact handling. Do not replace main with the older branch copy or grant broader permissions.
- `release/android-production-signing-main-20261108` repeats older Android production workflow/helper changes; no missing safe functionality was identified.
- `release/android-signed-ci-20261108` adds an alternate Android signed-release workflow and modifies the general verification workflow. Main already has the signed release workflow with the same secret-gated build model and more recent update configuration. No merge needed.
- The Android signing helper branches add scripts and instructions for configuring repository secrets. They do not provide the original keystore or signing identity. Main already has the current signing workflow; helper scripts that require local trusted-machine access do not solve the user's no-Codespace constraint. Do not run scripts that print, upload, or expose secret material, and never ask for keystore/password values in chat.
- `release/ios-signed-ci-20261108` adds an alternate iOS workflow, while its `IOS_SIGNED_RELEASE.md` documentation is byte-for-byte identical to main. Main already contains the owner-controlled macOS signing workflow and certificate/profile validation. No missing safe iOS release capability was identified.
- No branch-only signing assets were found to justify a merge. No signing keys, certificates, or profiles were present in the reviewed files; do not replace the established Android signing identity.
- No branch was merged or deleted in this pass. Signed Android/iOS workflows remain prepared but execution is not confirmed; required owner secrets and platform accounts cannot be inferred from repository files. CI remains unverified.


## Follow-up review: automation, planner music, acceptance, and remote updates

Reviewed 2026-11-18:

- `automation/integrate-all-branches-one-go-20261117` adds only `scripts/integrate-all-branches-one-go.sh`. The script requires a local clone, GitHub CLI authentication, Git, jq, Node/npm, and a working tree; it is not executable through the repository-only workflow available to the owner without Codespaces. More importantly, it enumerates every non-main branch and may create and merge PRs automatically when checks are green. It has no explicit exclusion for the 100 payment-persona branches or other known unsafe branches. Its size/deletion thresholds do not replace semantic review. Do not run or merge this script as-is.
- `integration/ephinta-planner-music-rebased-20261108` contains YouTube OAuth bootstrap and playlist-sync scripts plus a scheduled workflow. The sync is read-only against YouTube Data API, but it requires an owner-authorized Google account and three GitHub secrets; it publishes public/unlisted playlist metadata into the app catalogue. No account authorization or secret configuration was provided for this task. The branch also changes planner/music UI, API, CSS, and E2E snapshots across a 321-commit-behind base. No files copied; keep OAuth automation inactive pending explicit account authorization and a separate review.
- `verify/ephinta-main-acceptance-20261107` adds responsive UX audit assertions and updates a completion tracker, but its diff removes `.github/workflows/ess-phase12-e2e.yml`, which is present on main and runs browser journeys, API database integration tests, web regressions, and production builds. Preserve the main workflow. The branch's responsive audit is an older snapshot of a test already present on main; no selective copy justified.
- `fix/ephinta-marketplace-carousel-portal-ui-20261109` adds a remote-update notice component, responsive styling, E2E coverage, an Android splash drawable, and audio-platform verification. The splash drawable and audio verification script are already byte-for-byte present on main. Main also already has the remote-update component, stylesheet, E2E test, OTA API route, and API tests; its component/test versions include a development-only opt-in guard that the branch versions lack. Main's current OTA API implementation is already present and should not be replaced. No selective copy justified. The branch's main-entry wiring and core app/update changes require separate integration review rather than a wholesale merge.
- None of these four branches was merged or deleted. No CI result or test execution was obtained in this review. The explicit exclusion of all 100 payment-persona journeys remains in force.


## Follow-up review: Codespaces release-helper branch

Reviewed 2026-11-18:

- `codespace-fantastic-memory-xrx467jxj56r2j4r` is 358 commits behind main and adds an older production APK workflow, Android signing documentation/helpers, a PowerShell verification script, and an older public-journey test snapshot.
- Its production APK workflow is shorter and older than main's 16,905-byte workflow. It lacks main's pull-request validation job, physical-device confirmation gate, and current signing/OTA verification safeguards. Preserve main.
- The branch's `scripts/setup-android-signing-github.sh` generates a new release keystore and writes its private signing material into GitHub Actions secrets. Do not run it: replacing or creating a different signing identity can make existing installed Android applications unable to accept future signed updates. Main's release workflow expects the original Build 869 signing identity and validates its certificate fingerprint.
- The branch's `scripts/complete-production-apk.sh` is a local-machine helper and does not solve the no-Codespace constraint. The branch's PowerShell verification script is older than main's version; main adds an explicit `-SkipBrowser` mode and clearer unverified reporting. No helper or workflow copied.
- The Android signing documentation is branch-only and would need review against the current original-keystore requirement before publication; no release instruction was adopted.
- No branch was merged or deleted. The branch inventory currently contains 40 branches (39 non-main), and there are no open pull requests. The latest audit commit has no reported commit statuses and no associated workflow runs; this is not evidence of passing CI.



## Follow-up review: release-candidate acceptance and registration/music branch

Reviewed 2026-11-18:

- A deeper review of `integration/ephinta-release-candidate-final-20261114` confirms that its `apps/web/e2e/payment-notification-personas.spec.ts` defines 100 mocked CLIENT/VENDOR payment-and-notification browser journeys. This directly conflicts with the explicit instruction to remove/exclude all 100 vendor payment-persona journeys. Keep this spec and any workflow/package wiring that executes it out of main.
- The same candidate branch's 5,000-identity deterministic payment simulation is already present on main with the exact same blob SHA (`e1e6291c6ca1230caff9ba83d654fe46028dcd6e`). Its dedicated workflow is also already present on main. This is a mocked simulation, not a provider integration or proof of live settlement; no merge is needed.
- The candidate's `.github/workflows/ephinta-hardcore-acceptance.yml` and `scripts/release/ephinta-hardcore-acceptance.mjs` are not present on main. The runner invokes multiple npm scripts and workspace commands, installs browser dependencies, runs Android sync/build, and emits release blockers. It has not been run against main, and the workflow's workspace/package assumptions and aggregate job behavior remain unvalidated. Do not copy or enable it as a release gate until adapted and run on a dedicated branch/PR.
- The candidate's `.github/workflows/ephinta-nonpayment-release-verification.yml` is hard-wired to push events on `fix/ephinta-nonpayment-release-gates-20261114`, rather than main or pull requests. It invokes a branch-only shell script whose compatibility with main was not established. It is not ready to adopt as-is.
- `fix/ephinta-registration-planner-and-youtube-oauth` remains unsuitable for wholesale integration: it is 335 commits behind main, includes older snapshots of core UI/API/E2E files, and adds YouTube OAuth/scheduled playlist synchronization that requires owner-authorized Google access and secrets. No account authorization was supplied, so leave that automation inactive. No selective file was established as both unique and safe in this pass.
- No changes were copied, no PR was opened, and no branch was merged or deleted in this pass. The payment-persona exclusion remains active. CI and end-to-end execution remain unverified.



## Follow-up review: payment-persona branch family

Reviewed 2026-11-18:

- Compared all five payment-persona/navigation branches directly against main: `integration/selected-payment-persona-navigation-fix-20261117`, `qa/payment-notification-100-personas-20261113`, `qa/payment-notifications-main-20261115`, `qa/payment-notifications-main-20261116`, and `qa/payment-personas-wallet-selector-fix-20261117`.
- The selected-navigation branch modifies only `apps/web/e2e/payment-notification-personas.spec.ts`; the four QA branches add or modify that same excluded spec, and some also change the browser E2E workflow/package scripts or add worldwide persona data and a runner. These are all excluded by the owner's explicit instruction to remove all 100 vendor payment-persona journeys. Do not merge, cherry-pick, or re-enable their workflow/package wiring.
- The payment-persona test changes are not required to preserve the independently existing 5,000-identity mocked payment functional simulation already on main; that simulation is a separate script and workflow.
- No files copied, PR opened, branch merged, or branch deleted. No CI execution was performed.



## Follow-up review: isolated demo marketplace catalogue

Reviewed 2026-11-18:

- Rechecked `feature/isolated-demo-marketplace-catalogue-20261116` against the current main component. Main's `PublicMarketplaceCatalogue.tsx` generates 2,000 explicitly simulated, non-bookable examples and keeps verified-provider browsing separate. The branch contains 1,200 examples and an older component implementation.
- Main's catalogue explicitly labels simulated records and disables enquiries/bookings/reviews/payments in demo mode. The branch's alternative component does not improve on the current main implementation and would reduce the sample count. Preserve main; no cherry-pick.
- The branch changes only the catalogue component and its stylesheet; no other unique capability was identified. No file copied, PR opened, merge or deletion performed. CI remains unverified.



## Follow-up review: OPay provider display and Build 869 helper

Reviewed 2026-11-18:

- `fix/opay-provider-display-20261113` does not contain a new WalletPanel implementation: its WalletPanel is byte-for-byte identical to main. Its EnterpriseApp snapshot is older and omits current payment-mode administration, ExperienceModeMenu, MusicDspAdminPanel, lazy marketplace loading, current dashboard section navigation, and other main integrations. Do not replace it.
- The branch's `feePolicy.ts` and fee tests are similar to main and preserve the fixed 2% incoming/outgoing transaction fee. Main already enforces this policy and has the newer payout route. The branch's payout route is an older snapshot missing main's runtime payment-mode locking and related imports; preserve main.
- The branch-only `scripts/payments/set-render-payment-mode.mjs` is not safe to adopt: it writes Render service environment variables and triggers a deployment, hardcodes service IDs, configures 1% commission values despite the 2% transaction fee policy, and its live-provider allowlist excludes OPay/Cleva/Eversend. No invocation or deployment was performed.
- The branch's environment schema is older and omits current OPay test/live credential readiness fields and transfer URLs present on main. No missing OPay display or provider capability was established. No copy or merge.
- `fix/ephinta-869-compatible-release` adds a Build 869 release helper that requires a local Git checkout, GitHub CLI authentication, repository write/Actions access, Java, Android SDK tools, and the original Build 869 signing certificate. It explicitly refuses to proceed on a non-main working branch and cannot be executed through a repository-only workflow without a local environment. It also expects an owner-configured certificate fingerprint and signing secrets. Do not run or adopt this helper as a workaround for the no-Codespace constraint; preserve main's current production APK workflow and signing safeguards.
- No files copied, PR opened, branch merged, or branch deleted. CI remains unverified.


## Planner operations branch follow-up (2026-11-18)

- Rechecked `feat/planner-operations-finance-kyc-20261109`: the message archive migration, message service/routes, message DB tests, EventMessagesPanel, and KycUpload are byte-for-byte identical to main. No copy is needed for these features.
- Its EnterpriseApp and related planner/guest-check-in/notification/verifier snapshots are older than main. The branch version omits current main integrations for device security, payment-mode administration, experience modes, music administration, marketplace advertising, and current auth/navigation. Preserve main and do not wholesale merge.
- Branch-only CSS is coupled to the older EnterpriseApp markup and stylesheet import order. Do not add it without a separate compatibility review.
- No files copied, PR opened, merge or deletion performed. CI remains unverified.


## Follow-up review: KYC, device security, theme, experience and marketplace branches (2026-11-18)

- `feature/ephinta-bytid-kyc-20261108`: the Bytid client is byte-for-byte identical to main. Main's KYC routes and payment-provider implementation are newer, larger snapshots; preserve main's conservative provider/KYC handling. No branch-only implementation needs copying based on this comparison.
- `feature/ephinta-device-security-20261108`: main already has the DeviceSecurityGate and App integration. The branch gate is a different older snapshot; main retains current session/account reset and guarded-storage protections. Its Android/iOS permission metadata and install-smoke workflow are older than main. Preserve main.
- `feature/global-theme-contrast-20261116`: the marketplace catalogue component is identical to main. The branch's theme-contract stylesheet is only about 6.3 KB compared with main's 15.5 KB current implementation. Main's public journey E2E and global theme styling are already the preferred versions. No merge.
- `feature/experience-modes-gamified-demo-20261116`: ExperienceModeMenu is byte-for-byte identical to main; main already integrates it in EnterpriseApp and has newer global styling. No merge.
- `fix/customer-journey-landing-location-20261114`: earlier comparisons found MarketplaceBrowse and MarketplaceAdStrip identical to main; its PublicLanding, audio and responsive journey tests are older snapshots. Its Android/iOS manifests also predate main's permission-purpose descriptions. No safe missing change identified.
- `fix/ephinta-marketplace-carousel-portal-ui-20261109`: main already has the remote-update notice, but the branch versions of RemoteUpdateNotice and its E2E spec differ and are shorter; main's versions include additional safeguards. The audio-platform verification script is byte-for-byte identical. Branch workflow, splash, audio, live-update and landing changes are older or already represented more safely on main. Preserve main.
- These branches were not merged or deleted. No files copied and no PR opened. CI remains unverified.


## Follow-up review: staged cleanup and maintenance branch (2026-11-18)

- `maintenance/final-cleanup-20261114` compares as 143 commits ahead and 135 behind main. Its broad diff removes many bundled Remotion skill/reference assets and licensed audio files; do not merge the branch wholesale.
- The 5,000-user bounded load-test script and workflow are byte-for-byte identical to main. This campaign is explicitly synthetic and does not exercise provider checkout, webhooks, payouts or live-money settlement; it is not proof of production capacity or payment correctness.
- The dependency licence inventory workflow and licensed-audio browser-test policy are byte-for-byte identical to main. The branch's licence-inventory script differs from main, so retain the main version rather than importing the older branch snapshot.
- The branch's IP release-gate workflow and script differ from main. Main already contains both, with different current content; no evidence justifies replacing the main versions with the branch snapshots.
- The branch-only staged-cleanup workflow is not suitable to enable as-is: its job declares duplicate top-level `env` keys, so one mapping would override the other in YAML parsers, and its paths/targets include a historical release branch. It is not present on main and was not copied.
- The branch's third-party-notices file cites a historical package inventory and generated artifact counts; these are not independently verified against the current main lockfile and should not be treated as current release certification.
- No merge, PR, file copy or branch deletion was performed. CI remains unverified.


## Follow-up review: licensed-audio and verification-matrix maintenance branches (2026-11-18)

- `maintenance/licensed-audio-e2e-fix-20261114` compares 126 commits ahead and 136 behind main. Its licensed-audio test policy is already present byte-for-byte on main; no policy copy is needed.
- `maintenance/verification-matrix-20261114` compares 111 commits ahead and 136 behind main. It adds a useful-looking verification matrix, but the document explicitly depends on the branch-only staged-cleanup workflow. That workflow has duplicate top-level job `env` keys and was not validated against current main; the matrix's command names and acceptance rules were not independently run. Do not copy it as a certified verification checklist.
- Both branches carry broad removals of bundled Remotion skill/reference assets and historical cleanup manifests. The manifests make claims about quarantined scripts and preserved blob SHAs, but the branch snapshots are not a safe reason to import the accompanying cleanup history or delete files from main.
- The 5,000-user and one-node test assets are already on main; they are synthetic/non-payment tests, not proof of live provider transactions or production capacity.
- No branch was merged, no file was copied, and no branch was deleted. CI remains unverified.


## Follow-up review: Android-verified integration branch (2026-11-18)

- `integration/ephinta-release-android-verified-20261114` compares 41 commits ahead and 133 behind main. It is heavily diverged and also removes a large set of bundled Remotion skill/reference assets; do not merge it wholesale.
- Its Android install-smoke workflow is an older/alternate trigger configuration. Main retains a narrower native-input/manual-dispatch trigger, while the branch adds broader pull-request paths including web assets and the APK workflow. No reason was found to replace the main workflow.
- The branch's IP-release workflow is older than the workflow already on main: main includes pinned SPDX licence-text retrieval and dependency-inventory generation before the asset-rights gate. Do not replace it with the branch snapshot.
- The dependency licence-inventory workflow is byte-identical on main and the branch; no copy is required.
- The branch's 5,000-payment simulation workflow is not evidence of live OPay/Cleva settlement and does not justify importing the rest of the branch. The corresponding deterministic simulation asset is already on main.
- No merge, PR, file copy or branch deletion was performed. CI remains unverified.


## Follow-up review: unified and release-candidate integration branches (2026-11-18)

- `integration/ephinta-unified-20261114` (38 ahead/134 behind) and `integration/ephinta-unified-final-20261114` (39 ahead/134 behind) are heavily diverged and carry broad historical Remotion skill/reference removals. Their workflow additions are not a safe wholesale merge; the payment simulation and licence inventory are already on main, and main's IP release gate is more complete.
- `integration/ephinta-release-candidate-final-20261114` is 91 ahead/134 behind and has the same broad removals. It adds a branch-only hardcore-acceptance workflow and runner; neither has been executed against current main, and the runner must be reviewed and validated before adoption. Do not treat its existence as a passed release gate.
- The candidate's non-payment release-verification workflow is configured to push on a different branch name (`fix/ephinta-nonpayment-release-gates-20261114`), not the candidate branch itself. It is not a reliable automatic gate for this branch and is not present on main.
- The candidate's branch-consolidation workflow grants `contents: write`, checks out the integration branch with persistent credentials, and invokes an all-branch consolidation script. This conflicts with the required branch-by-branch semantic review and must not be enabled or run as-is.
- The candidate's dependency-security workflow changes triggers and report behavior relative to main; no evidence from a completed run supports replacing the main workflow.
- No merge, PR, file copy or branch deletion was performed. CI remains unverified.


## Follow-up review: IP/release documentation, recovery and planner/music branches (2026-11-18)

- `audit/ephinta-ip-paid-access-readme-20261114` compares 58 commits ahead and 135 behind main; `release/paid-access-readme-payment-audit-20261113` compares 144 ahead and 139 behind. Both are heavily diverged with broad historical Remotion asset removals. Their 5,000-payment simulation, licence inventory, and licensed-audio policy assets are already represented on main; the branch IP gate is older than main's pinned SPDX/licence-inventory implementation. Do not merge either branch wholesale.
- `maintenance/final-cleanup-20261114` compares 143 ahead and 139 behind. Its staged-cleanup workflow is branch-only and has duplicate top-level job `env` keys, making its environment configuration unreliable; it also targets a historical release branch. Do not copy or enable it. Its third-party notices and cleanup manifest are historical snapshots, not current release certification.
- `integration/recover-verified-feature-fixes-20261108` compares 7 ahead and 338 behind with six frontend/E2E snapshot changes. These are older snapshots of audio, public journeys, EnterpriseApp and theme styling; preserve main's newer versions.
- `integration/ephinta-planner-music-rebased-20261108` compares 24 ahead and 333 behind. It adds a YouTube playlist-sync workflow and OAuth/scheduled sync implementation that would require explicit owner authorization and Google credentials. Its frontend, API, and E2E changes are older snapshots; do not merge pending authorization and a separate current-main compatibility review.
- No branch was merged, no file copied, and no branch deleted. No completed CI run was verified; CI remains unverified.


## Repository inventory checkpoint (2026-11-18)

- Refreshed the GitHub branch listing after the branch-by-branch reviews: 40 branches remain, including `main` and 39 non-main branches.
- Refreshed open pull requests: zero are currently open. There is therefore no open PR queue to merge or review at this checkpoint.
- The branch listing reports `protected: false` for every listed branch, including `main`. This is a repository governance risk: configure branch protection/rulesets for `main` (required checks, pull-request review, and prevention of force pushes/deletion) before treating it as release-protected.
- This inventory check does not imply that the non-main branch contents have been merged. No branch deletion was performed; the available GitHub actions in this session do not expose a safe branch-delete operation.


## Follow-up review: one-go integration automation branch (2026-11-18)

- `automation/integrate-all-branches-one-go-20261117` compares one commit ahead and 102 behind main and adds only `scripts/integrate-all-branches-one-go.sh`; do not merge or execute it as a consolidation shortcut.
- Although the script checks PR state and CI, it creates PRs for every non-main branch, treats patch-equivalent commits as represented without semantic review, and may merge any clean, green PR under its file/deletion thresholds. It has no explicit denylist for the excluded 100 payment-persona journeys, no policy check for risky provider/credential/cleanup changes, and no independent validation that a green workflow actually covers the changed functionality. A green check is not a substitute for reviewing what a branch changes.
- It requires a local clone, GitHub CLI authentication, git/jq, and local npm verification; it cannot satisfy the user's no-Codespace/no-local-shell constraint. Its final `npm run mobile:verify` also assumes Android SDK/Java tooling not available through this GitHub-only workflow.
- No script was run, no PR was opened, no branch was merged or deleted. Preserve branch-by-branch review and explicit exclusion of all 100 vendor payment-persona journeys.


## Final all-branch deletion-readiness checkpoint (2026-11-18)

### Inventory and comparison

- Refreshed GitHub inventory: 40 branches total (main + 39 non-main); zero open pull requests at the last inventory refresh.
- Compared every one of the 39 non-main branch refs against current `main`. GitHub reports each as diverged. Ahead/behind counts are commit-history comparisons, not proof that every ahead commit represents missing functionality: many branches contain old snapshots or changes already represented in main.
- No blanket merge is safe. The branch set includes broad historical file removals, older snapshots of current app code, unsafe all-branch automation, provider/credential setup requiring owner authorization, and the explicitly excluded 100 payment-persona journey suite.

### Disposition

- **Do not merge wholesale:** the four payment-persona QA branches and `integration/selected-payment-persona-navigation-fix-20261117`; keep all 100 CLIENT/VENDOR payment-persona journeys excluded.
- **Do not merge wholesale:** the unified/release-candidate/Android-verified integration branches and cleanup, maintenance, audit, paid-access branches with approximately 300 changed paths and extensive historical Remotion asset removals. Preserve current main versions of workflows and release controls.
- **Do not run or merge:** `automation/integrate-all-branches-one-go-20261117`; it can open/merge PRs across branches without the required semantic exclusions and depends on a local clone, GitHub CLI, and Android build tooling.
- **Keep current main implementations:** Bytid/KYC, device-security, planner operations, experience modes, global theme, isolated demo catalogue, customer journey, marketplace carousel/remote update, OPay display, responsive music/theme recovery, and acceptance/release branches where the main implementation is newer or already includes the useful change. This is a semantic review conclusion, not a Git ancestry claim.
- **Owner decision required before discarding branch-only assets:** YouTube playlist OAuth/scheduled sync branches require Google account authorization and secrets; signing-helper branches must not create/replace the existing Android keystore; release-candidate branch-only hardcore acceptance workflow/runner and historical third-party-notices manifest have not been validated against current main. These are not approved for blind merge.
- **No branch is certified deletion-ready solely from this comparison.** Branches whose useful work is confirmed present in main may be manually deleted after you review this report; preserve the owner-decision items until explicitly accepted or intentionally abandoned. Do not infer that a diverged branch is merged just because its feature appears in main.

### Verification limits

- No merge was performed during this checkpoint; no branch was deleted. There were zero open PRs at the last inventory refresh.
- Latest audit commits have no associated GitHub status checks or workflow runs. CI, browser E2E, full quality gates, Android signed build/install, and live payment-provider settlement remain unverified by this GitHub-only audit.
- Branch protection was reported disabled for main in the last inventory refresh. Enable appropriate rulesets/required checks before release.
