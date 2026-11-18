# EPHINTA branch audit — 18 November 2026

## Scope and method

Compared the current `main` head with every branch returned by GitHub's repository branch listing. This is a metadata and changed-file inventory, not a substitute for compiling, testing, or reviewing every patch. No branch was merged, force-pushed, or deleted during this audit.

- Audited base: `main` at `bbb16ed59c09d8174fa6cac0397819115493c70d`.
- GitHub reported no open pull requests.
- The current main commit returned no status-check entries and no associated workflow runs through the queried commit endpoints. This does **not** mean CI passed.
- The repository contains 38 non-main branches in the listing.

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
