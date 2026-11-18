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
