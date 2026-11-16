# EPHINTA branch consolidation and final-test gate

**Applies to:** `demtaiwo1-eng/winning-game-`  
**Protected integration target:** `main`  
**Rule status:** Mandatory for release preparation  
**Last inventory reviewed:** 2026-11-16

## Non-negotiable order

1. Inventory every remote branch and every open pull request against the current `main` SHA.
2. Review the unique commits and changed files on **every** non-main branch. Do not infer that a branch is disposable because it is old, diverged, or has no open PR.
3. Give every branch exactly one recorded disposition:
   - **MERGE** — merge its PR or integrate its unique commits into `main`.
   - **EXTRACT** — cherry-pick/re-implement the required changes onto a fresh branch based on current `main`, then merge that PR.
   - **SUPERSEDED** — prove every useful change is already present on `main` or in another merged branch; record the replacement commit/PR.
   - **EXCLUDE** — owner-approved explicit exclusion, with reason and confirmation that no required work is lost.
4. Resolve conflicts on branches based on the latest `main`; do not merge a stale integration branch wholesale just to make the branch count reach zero.
5. Preserve all required GitHub Actions workflows and release scripts. Workflow deletion or disabling requires a separate evidence-backed decision.
6. Merge all required work into `main`. Only after verifying that each non-main branch has a completed disposition may redundant branches be deleted. Never delete `main`, a branch with unmerged unique work, or a branch needed by an open PR.
7. **Do not start a new final acceptance/test run until steps 1–6 are complete.** After consolidation, run the final test matrix once against the consolidated `main` SHA. If code changes after that run, the final gate is invalid and must be rerun.
8. A green CI run is not permission to skip branch review. Conversely, a branch being merged is not proof that its code works; the post-consolidation final matrix must pass.

## Merge safety requirements

- Merge only a reviewed PR with the expected head SHA, no unresolved review threads, and a clean mergeable state.
- Prefer small feature PRs based on current `main`. For highly diverged branches, compare commit/file history and extract only required changes; do not use blind merge or force-push.
- Before integrating payment changes, inspect provider selection, fees, payout/refund paths, idempotency, webhook verification, and ledger effects. Keep the currently working OPay behavior unchanged unless the owner explicitly approves a change.
- Do not put API keys, signing keys, passwords, tokens, or production data in commits, test fixtures, logs, or this ledger.
- Never merge a test-only change that mocks settlement as evidence of real payment settlement.
- Do not delete or rewrite migration history. Do not run destructive database operations as part of branch cleanup.
- Keep branch cleanup separate from application behavior changes. Delete only after the integration/supersession evidence is recorded.

## Final-test gate checklist

The release owner must be able to answer **yes** to all items before triggering the final run:

- [ ] Remote branch inventory has been paginated to completion.
- [ ] Every branch except `main` has a written disposition and reviewer evidence.
- [ ] Every required unique change is present on `main`; no unreviewed branch-only commits remain.
- [ ] Every open PR is merged, closed as superseded/excluded with a reason, or explicitly held outside the release scope.
- [ ] No unresolved review threads or unresolved merge conflicts remain for in-scope work.
- [ ] Required workflows are present and enabled; no required workflow was removed to obtain a green result.
- [ ] OPay behavior is unchanged unless separately authorized.
- [ ] Branch cleanup is complete for branches proven redundant; branches with unresolved disposition remain and block final testing.
- [ ] The exact consolidated `main` SHA is recorded.
- [ ] Only now may the final test matrix run against that SHA.

## Required final test matrix (after consolidation only)

Run the repository's applicable checks on the exact consolidated `main` SHA: clean dependency install; API typecheck/unit tests; disposable PostgreSQL migrations and integration tests; web unit/build; responsive and accessibility/design checks; browser journeys on desktop and mobile; payment/notification persona coverage; Android lint/unit/build and APK artifact verification; iOS build where supported; dependency/security audit; and the bounded load/scale suite. Record run URLs, job conclusions, artifact links, and any device-only checks that cannot be performed in CI. Do not describe a build artifact as a physical-device installation test.

## Initial audit snapshot — 2026-11-16

The remote branch inventory returned **38 branches including `main` (37 non-main branches)**. All 37 were compared with `main`. The comparison showed that the inventory is not a simple fast-forward cleanup: many branches are diverged, several contain large integration histories, and some are likely overlapping or superseded. Therefore no blanket merge or bulk deletion is safe.

### Branches requiring individual disposition

```text
audit/ephinta-ip-paid-access-readme-20261114
codespace-fantastic-memory-xrx467jxj56r2j4r
feat/planner-operations-finance-kyc-20261109
feature/ephinta-bytid-kyc-20261108
feature/ephinta-device-security-20261108
feature/experience-modes-gamified-demo-20261116
feature/global-theme-contrast-20261116
feature/isolated-demo-marketplace-catalogue-20261116
fix/customer-journey-landing-location-20261114
fix/ephinta-869-compatible-release
fix/ephinta-marketplace-carousel-portal-ui-20261109
fix/ephinta-registration-planner-and-youtube-oauth
fix/opay-provider-display-20261113
integration/ephinta-planner-music-rebased-20261108
integration/ephinta-release-android-verified-20261114
integration/ephinta-release-candidate-final-20261114
integration/ephinta-unified-20261114
integration/ephinta-unified-final-20261114
integration/recover-verified-feature-fixes-20261108
maintenance/final-cleanup-20261114
maintenance/licensed-audio-e2e-fix-20261114
maintenance/verification-matrix-20261114
qa/payment-notification-100-personas-20261113
qa/payment-notifications-main-20261115
qa/payment-notifications-main-20261116
qa/payment-personas-current-main-20261116
recovery/ephinta-planner-budget-format-20261108
recovery/ephinta-responsive-music-player-20261108
recovery/ephinta-theme-text-contrast-20261108
release/android-production-ota-main-20261108
release/android-production-signing-main-20261108
release/android-signed-ci-20261108
release/android-signing-helper-20261108
release/android-signing-helper-current-20261108
release/ios-signed-ci-20261108
release/paid-access-readme-payment-audit-20261113
verify/ephinta-main-acceptance-20261107
```

### Known pull-request decisions to preserve during the audit

- **PR #210** — payment/notification browser personas. Small, focused change set (3 files); candidate for integration after its branch is reviewed and the existing in-flight checks finish. Its test mocks are not proof of real provider settlement.
- **PR #187** — large, diverged release-candidate integration (91 commits ahead / 21 behind at the time checked; comparison exceeded the 300-file display limit). Extract required changes individually; no blind merge.
- **PR #178** — large, diverged documentation/payment-audit integration (144 ahead / 25 behind; comparison exceeded the 300-file display limit). Extract required changes individually; no blind merge.
- **PR #170** — OPay provider labels/fee behavior. Hold out of integration because the owner instructed that the currently working OPay implementation must remain unchanged.
- Other open PRs/branches must be discovered again at execution time; this snapshot is not a substitute for a fresh inventory.

### Current gate decision

**FINAL TEST RUN: BLOCKED pending complete branch dispositions and integration.**

Some CI jobs were already in progress when this policy was requested. Do not treat those pre-existing runs as the post-consolidation final test run, and do not start another final matrix until the checklist above is complete. Record their results separately.

## Audit log

| Date UTC | Action | Result |
|---|---|---|
| 2026-11-16 | Compared 37 non-main remote branches with `main`; identified 38 total branches including `main`. | Diverged histories and overlapping changes confirmed; blanket merge/deletion prohibited. |
| 2026-11-16 | Reviewed open PRs #210, #187, #178, and #170. | #210 candidate after checks; #187/#178 require extraction review; #170 held to preserve OPay. |


## Additional automation audit — 2026-11-16

A pre-existing consolidation workflow and script were found on `integration/ephinta-release-candidate-final-20261114`:

- `.github/workflows/ephinta-branch-consolidation.yml`
- `eventsss123/eventsss-main/scripts/release/consolidate-all-branches-safely.sh`

**Do not dispatch this existing workflow as-is.** Its script merges every fetched remote branch into the release-candidate branch in alphabetical order, including `fix/opay-provider-display-20261113`, which conflicts with the owner's explicit instruction to preserve current OPay behavior. It also runs the full release-check suite after each successful branch merge, before all branches have been processed. This violates the requested sequencing of consolidating all branches first and running the final acceptance matrix only once afterward. It skips conflicts and does not delete branches, but its current behavior is not an approved all-branches execution plan.

Before using automation, rewrite and review that script so it:
1. Uses a reviewed branch manifest with explicit per-branch disposition, never an unfiltered `git for-each-ref` over all remote refs.
2. Excludes the protected OPay change unless the owner later authorizes it.
3. Integrates only changes reviewed for inclusion; conflict branches remain unresolved and block completion rather than being silently ignored.
4. Performs no full acceptance run between merges.
5. Runs the final acceptance matrix exactly once, after all in-scope changes are consolidated, and pushes no candidate if any in-scope branch remains unresolved or the final matrix fails.
6. Never deletes source branches; cleanup is a separate post-merge action after proof of supersession.

This automation audit is an additional blocker, not a completed consolidation.


## Branch dispositions completed by content comparison — 2026-11-16

The following two feature branches were compared at file level with the current `main` content:

| Branch | Disposition | Evidence |
|---|---|---|
| `feature/experience-modes-gamified-demo-20261116` | **SUPERSEDED — pending ledger finalization** | `ExperienceModeMenu.tsx` and `verify-landing-marketplace-global-css.sh` are byte-identical to `main`. The branch's `ephinta-global.css` is an older, shorter stylesheet than main and must not replace it. The branch's remaining `EnterpriseApp.tsx` is older (branch file 177,443 chars vs main 179,452 chars) and must not overwrite current main. |
| `feature/isolated-demo-marketplace-catalogue-20261116` | **SUPERSEDED — pending ledger finalization** | The feature is already present in main's `PublicMarketplaceCatalogue.tsx`; main has a more complete 2,000-sample implementation, while the branch has 1,200 samples and older markup. Main's marketplace stylesheet also contains additional rules. Replacing main with this branch would be a regression. |

These are content-level supersession findings; they do not authorize branch deletion until the full inventory and open-PR cross-reference is complete.


| Branch | Disposition | Evidence |
|---|---|---|
| `feature/global-theme-contrast-20261116` | **SUPERSEDED — pending ledger finalization** | Its public-marketplace component and stylesheet are identical to `main`. Its global theme contract (6,320 chars) and global stylesheet (8,859 chars) are older/smaller than main (15,464 and 18,709 chars respectively). Main already contains the later global palette/contrast work; do not overwrite it with this branch. |

The device-security branch `feature/ephinta-device-security-20261108` remains **REVIEW REQUIRED**: its security gate component differs from main and needs semantic review before any extraction. The branch's Android manifest and iOS Info.plist are older/smaller than main, so those files must not replace the current main versions. The unique security behavior must be assessed separately; no branch-wide merge is approved.


### Payment-persona branch family

- `qa/payment-personas-current-main-20261116` is the current PR #210 candidate. Its test file is the most recent of the compared persona branches (9,148 characters) and includes the latest client selector correction to use the actual planner dashboard section select. It remains **MERGE CANDIDATE — CI pending**.
- `qa/payment-notifications-main-20261115` and `qa/payment-notifications-main-20261116` contain older versions of the same three-file payment-persona change (9,095 and 9,167 character test files respectively). They are **SUPERSEDED BY PR #210 for the overlapping three-file scope**, subject to checking for any branch-only commits outside that scope before closure/deletion.
- `qa/payment-notification-100-personas-20261113` contains the shared persona test plus additional worldwide-persona files/scripts (six changed files in the main comparison). The payment-persona portion is superseded by PR #210, but the additional worldwide-persona work remains **EXTRACT/REVIEW REQUIRED**; do not delete this branch until those additional files are accounted for.

PR #210's test diff was reviewed: it adds mocked API journeys and does not execute real payment settlement. Its workflow is still in progress for browser, app verification, and scale QA. No merge has been performed while those required checks remain in progress.


## Follow-up audit — Android signing and refreshed inventory — 2026-11-16

The refreshed remote inventory now returns **39 branches including `main` (38 non-main)**. The added `maintenance/branch-consolidation-rules-20261116` branch is the audit-documentation branch containing this ledger; it is not application code and remains open pending the final disposition process.

### Android release branch family — do not merge wholesale

The following branches overlap heavily:
- `release/android-production-signing-main-20261108` — 5 commits ahead / 227 behind; 5 changed files.
- `release/android-signed-ci-20261108` — 3 ahead / 236 behind; 3 changed files.
- `release/android-production-ota-main-20261108` — 8 ahead / 230 behind; 6 changed files.
- `release/android-signing-helper-20261108` and `release/android-signing-helper-current-20261108` still require comparison against each other and current main.

The OTA branch's versions of `scripts/setup-android-signing-github.sh` and `scripts/complete-production-apk.sh` are older than current `main`. In particular, the branch setup script can generate a new signing identity, whereas current main's setup helper is designed to import the original Build 869 signing identity and verify it against the published baseline APK. The branch handoff script also uses a differently cased repository name and does not contain the current main workflow's physical-device confirmation gate and minimum version-code input. **Disposition: SUPERSEDED for these overlapping files; do not copy the branch versions over main.** The remaining release-workflow differences still require a line-by-line review before a final branch disposition. No signing secrets or keys were accessed.

### Focused feature branches still requiring review

| Branch | Current comparison to main | Required next action |
|---|---:|---|
| `fix/ephinta-registration-planner-and-youtube-oauth` | 79 ahead / 231 behind; 27 files | Review auth, registration, planner, YouTube OAuth, and workflow deltas individually; no branch-wide merge. |
| `fix/customer-journey-landing-location-20261114` | 35 ahead / 20 behind; 12 files | Review public journey and landing changes against current main; do not overwrite newer app shell or mobile manifests. |
| `feat/planner-operations-finance-kyc-20261109` | 78 ahead / 146 behind; 23 files | Review Prisma migration/schema and messaging/notification API changes as a unit; validate migration compatibility before extraction. |
| `feature/ephinta-bytid-kyc-20261108` | 20 ahead / 223 behind; 9 files | Review BYTID provider contract, KYC route changes, env schema, and tests; no merge until API/security review. |
| `fix/ephinta-marketplace-carousel-portal-ui-20261109` | 69 ahead / 147 behind; 36 files | Extract only still-needed marketplace/update changes after comparing against current main; review app-update API and live-update code carefully. |
| `integration/recover-verified-feature-fixes-20261108` | 7 ahead / 224 behind; 6 files | Compare audio and contrast changes against current main; do not restore old theme files without evidence. |
| `recovery/ephinta-responsive-music-player-20261108` | 20 ahead / 231 behind; 4 files | Compare player implementation and CSS with current main; extract only demonstrably missing behavior. |
| `recovery/ephinta-planner-budget-format-20261108` | 3 ahead / 231 behind; 3 files | Review the narrow planner formatting delta; do not replace current Gradle wrapper. |

### Pre-existing CI observations (not final acceptance)

- Run `43875404810`: web/API production build passed; API database integration passed; desktop/mobile browser journeys remained in progress at the last poll, with worldwide and payment persona stages pending.
- Runs `43875405160`, `43875404785`, and `43875405001`: their jobs concluded **cancelled**, not passed.
- These results are recorded as pre-existing CI only and do not satisfy the post-consolidation final-test gate.


### Remaining Android helper, worldwide QA, and release-candidate branch families

- `release/android-signing-helper-20261108` (13 ahead / 234 behind) and `release/android-signing-helper-current-20261108` (17 ahead / 231 behind) overlap with the Android release family. Their helper/workflow changes are not approved for wholesale merge. Current main's protected Build 869 signing workflow remains the canonical implementation. Review only any unique release validation that is still absent from main.
- `fix/ephinta-869-compatible-release` (6 ahead / 145 behind; 2 files) contains a production workflow delta and a 119-line Build 869 update helper. **EXTRACT/REVIEW REQUIRED**: inspect the helper for certificate continuity, version-code behavior, release artifact verification, and OTA compatibility before deciding whether any unique logic is needed.
- `qa/payment-notification-100-personas-20261113` (12 ahead / 25 behind; 6 files) contains the shared payment-persona spec plus a separate 603-line worldwide-persona spec and runner. The payment spec is superseded by PR #210; the worldwide persona suite is **EXTRACT/REVIEW REQUIRED**. Do not discard the branch until its package scripts and workflow wiring are reconciled with current main.
- `integration/ephinta-planner-music-rebased-20261108` (24 ahead / 219 behind; 24 files) and `fix/ephinta-registration-planner-and-youtube-oauth` overlap substantially in planner/music/registration work. The former adds a large design system and playlist synchronization integration; review against current main and the current registration branch before extracting any unique feature. Do not merge the full branch.
- `maintenance/final-cleanup-20261114` (143 ahead / 25 behind), `maintenance/verification-matrix-20261114` (111 ahead / 25 behind), `audit/ephinta-ip-paid-access-readme-20261114` (58 ahead / 21 behind), `integration/ephinta-release-android-verified-20261114` (41 ahead / 21 behind), and `integration/ephinta-unified-20261114` / `integration/ephinta-unified-final-20261114` (38–39 ahead / 21 behind) share a large integration history. Their compare responses are capped at 300 files and include broad removals of Remotion best-practices content, multiple workflow additions, and playlist workflow deletion. **No branch-wide merge is approved**; compare output is truncated and requires commit-level/file-level audit before any required material can be extracted.
- `verify/ephinta-main-acceptance-20261107` (10 ahead / 238 behind; 5 files) includes removal of an older workflow and older design-system/test deltas. Review its responsive UX tests only if they contain assertions absent from current main; do not restore its workflow deletion without explicit evidence.

No branch from this family has been deleted or force-updated. These are review dispositions only, not merged outcomes.


### Payment-persona browser failure follow-up (2026-11-16)

- PR #210 browser run `43875404810` passed web/API production builds and API database integration, but its browser journey job failed because vendor personas waited for a button named `Open Wallet & escrow` that is not present under that accessible name in the current vendor dashboard.
- Current main exposes the accessible `Vendor dashboard section` selector with a `wallet` option. The vendor payment-persona test has been corrected to select that option instead of clicking the mismatched button.
- Correction committed to `qa/payment-personas-current-main-20261116`: `5484350fd861952f7afa89c3574f3d8f37794af1`.
- The fix is not yet verified by a completed green browser run. PR #210 remains unmerged pending fresh required checks.


### Focused branch-content verification (2026-11-16)

- `feature/ephinta-bytid-kyc-20261108`: `apps/api/src/lib/bytid.ts` is byte-identical to main. Its KYC route and upload component are shorter than main, so the branch is not a safe source for replacing current KYC implementation. No BYTID credential or provider change is needed for the current OPay-only production scope.
- `feat/planner-operations-finance-kyc-20261109`: the reviewed event-message service and web messaging panel are byte-identical to main. Its remaining differences include schema/migration, notifications, and planner UI; these still require migration and authorization review before selective extraction.
- `feature/ephinta-device-security-20261108`: the DeviceSecurityGate differs slightly from main and remains a focused security review item. Do not replace current Android/iOS manifests or package configuration wholesale.
- `fix/ephinta-registration-planner-and-youtube-oauth`: its older stylesheet stack imports many separate theme files, while main uses the single `ephinta-global.css` entry point. Its theme contrast stylesheet is smaller than the existing main stylesheet. Do not restore this branch's stylesheet stack over current global theming.


### Additional recovery, release, and cleanup branch inventory (2026-11-16)

- `recovery/ephinta-planner-budget-format-20261108`: only three changed files (Android Gradle wrapper, planner journey test, EnterpriseApp); needs focused diff review, not branch-wide merge.
- `recovery/ephinta-responsive-music-player-20261108`: four changed files (wrapper, audio E2E, AudioExperience, audio CSS); review against current main before any extraction.
- `recovery/ephinta-theme-text-contrast-20261108`: theme CSS and main entry point differ, but main has the current consolidated global CSS; do not replace main entry point or theme stack from this branch.
- `fix/ephinta-marketplace-carousel-portal-ui-20261109`: broad 69-commit/147-behind divergence with marketplace, remote update, audio, device security, and release workflows; requires path-by-path review. Do not merge wholesale.
- `integration/ephinta-planner-music-rebased-20261108`: 24 commits ahead/219 behind with overlapping registration, audio, marketplace and CSS; current main already has the global stylesheet consolidation. No branch-wide merge.
- `maintenance/licensed-audio-e2e-fix-20261114`: 126 commits ahead/25 behind and very broad third-party skill/audio/docs inventory; needs separate rights and scope audit. Do not merge wholesale.
- Android release branches (`release/android-production-ota-main-20261108`, `release/android-production-signing-main-20261108`, `release/android-signed-ci-20261108`, `release/android-signing-helper-current-20261108`) contain overlapping signing workflows and helper scripts. Treat as one release family and compare the signing secret handling and workflow permissions before selecting a single canonical implementation.
- `release/ios-signed-ci-20261108` adds iOS release workflow/docs; review signing and certificate handling separately.
- `verify/ephinta-main-acceptance-20261107` adds acceptance workflow, responsive audit and design quality gate; compare those scripts with current main before extraction.
- `fix/ephinta-869-compatible-release` and `fix/opay-provider-display-20261113` remain distinct; the latter is explicitly excluded to preserve the currently working OPay behavior.

### CI status after payment-persona selector correction

- New PR #210 run `43885179876`: web/API production build passed; API database integration passed; desktop/mobile browser portal journeys remained in progress at last poll.
- Run `43885179752`: responsive web test/build and Android APK jobs passed.
- Run `43885179826`: Windows API/web/browser/design verification passed.
- Run `43885179370`: responsive audit passed.
- Run `43885179398`: validation passed.
- Run `43885179580` (7,000 fixtures/300-user gates) and `43885180157` (verification) remained in progress; iOS simulator run `43885179971` was queued.
- These checks are useful branch-level evidence, not the final post-consolidation acceptance suite. PR #210 is still unmerged pending all required checks.


### iOS and Android signed-release workflow review — 2026-11-16

- `release/ios-signed-ci-20261108` is 6 commits ahead / 234 behind and adds a 211-line manual-dispatch iOS distribution workflow plus signing documentation. The workflow uses read-only repository permissions, requires owner-provided certificate/profile/team secrets, verifies certificate SHA-256, provisioning-profile expiry, Team ID, bundle ID, distribution entitlement, and codesign output, and uploads a signed IPA artifact. No signing secrets were read. **EXTRACT/REVIEW REQUIRED**: before adopting, fix the cleanup step so it removes only the profile file created by this job rather than recursively deleting the entire runner user's provisioning-profiles directory; also review action pinning and ensure the workflow's app bundle identifier matches the current iOS project. Do not merge the branch wholesale.
- `release/android-signed-ci-20261108` is 3 commits ahead / 236 behind. Its signed workflow uses protected GitHub secrets, a temporary keystore with mode 600, APK/AAB signature verification, and cleanup. It pins Java 17, while the newer production signing workflow reviewed on `release/android-production-signing-main-20261108` uses Java 21 and performs stronger certificate fingerprint and API readiness checks. Treat the older signed-CI workflow as superseded unless a unique requirement is found; do not replace the current Java 21 production release path.
- `release/android-production-signing-main-20261108` contains a broader Java 21 release workflow with keystore/certificate validation, health/readiness probes, APK/AAB signing checks, and OTA bundle publishing. Its `contents: write` permission is scoped to the release job and should remain confined to tag-triggered publishing. The workflow requires owner-configured secrets and was not executed because credentials must not be invented or requested in chat. Continue reviewing its helper scripts and current-main equivalent before selecting the canonical workflow.
- These findings do not authorize a merge. No signing branch was merged or deleted.

### Fresh CI poll — 2026-11-16

- Run `43885179876`: API database integration and web/API production build completed successfully; browser portal journeys were still running at the poll.
- Run `43885179580`: 7,000-fixture / 300-user scale and browser/design gate still running.
- Run `43885180157`: full verification still running.
- Run `43885179971`: iOS Simulator build remained queued.
- These are in-flight branch checks only, not the post-consolidation final acceptance run.


### Customer landing, audio recovery, acceptance workflow, and Build 869 helper review — 2026-11-16

- `fix/customer-journey-landing-location-20261114` remains **EXTRACT/REVIEW REQUIRED**. It changes the public landing page, marketplace browsing, public journey tests, responsive audit, audio experience, and mobile manifest/plist. The branch's landing component is shorter than current main (66,259 vs 69,582 characters); its marketplace component is byte-identical to main, so that file is already superseded. The public landing and journey-test deltas are not safe to copy wholesale without reviewing current auth/role and location-permission behavior. Its Android/iOS manifest deltas must not overwrite newer main manifests.
- `recovery/ephinta-responsive-music-player-20261108` remains **EXTRACT/REVIEW REQUIRED**. Its audio component, audio stylesheet and audio E2E test are all different from main and also differ from the customer-landing branch versions. The branch's Gradle wrapper change is not approved. Compare the actual behavior and rights-cleared track configuration before extracting any audio improvements; do not restore the older stylesheet wholesale.
- `verify/ephinta-main-acceptance-20261107` is **EXCLUDE for its workflow deletion**: its diff removes `.github/workflows/ess-phase12-e2e.yml`, which must not be accepted as a shortcut to green CI. Its responsive test/design-system deltas remain reviewable individually; no wholesale merge.
- `fix/ephinta-869-compatible-release` adds a 119-line Build 869 update helper. The helper is byte-identical to the current main helper `eventsss123/eventsss-main/scripts/complete-ephinta-869-update.sh` (7,408 characters); that useful behavior is already present in main. Its workflow delta still requires separate comparison. **SUPERSEDED for the helper script**; do not replace it.

### PR #210 latest status — 2026-11-16

- Fresh workflow-run lookup for head `5484350fd861952f7afa89c3574f3d8f37794af1`: dependency security audit, Windows verification, Web Checks + Android APK, Phase 8 quality gate, and responsive UX audit completed successfully.
- Browser E2E, 7,000-fixture/300-user scale QA, and full app verification remained in progress at the poll. The iOS Simulator workflow completed as **cancelled** (not passed).
- PR #210 remains open and unmerged, with no unresolved review threads. Do not merge until all required checks conclude successfully and the exact current head is revalidated. Its payment personas use mocked provider responses and are not evidence of real OPay settlement.
- Remote branch inventory was refreshed: 39 branches total including `main` (38 non-main). No branch was deleted.


### Focused follow-up: Build 869 and planner-budget recovery branches — 2026-11-16

- `fix/ephinta-869-compatible-release` compares as 6 commits ahead / 145 behind with two changed paths. Its `eventsss123/eventsss-main/scripts/complete-ephinta-869-update.sh` is byte-identical to current main (7,408 characters), so no helper extraction is needed. Its `.github/workflows/ephinta-production-apk.yml` is older than current main and lacks the current workflow's required physical-device confirmation input, protected Build 869 signing checks, and additional workflow validation. **SUPERSEDED for the reviewed helper and workflow; do not replace main.**
- `recovery/ephinta-planner-budget-format-20261108` compares as 3 commits ahead / 231 behind with three changed paths. Its planner journey test is an older, substantially shorter file (33,557 vs 55,895 characters) and lacks current main's device-security unlock helper; its `EnterpriseApp.tsx` is also older (158,073 vs 179,452 characters) and must not overwrite main. **SUPERSEDED for these two reviewed files.** Its one-line Gradle wrapper delta still needs an exact compatibility check before final branch disposition; no wholesale merge.
- PR #210 head remains `5484350fd861952f7afa89c3574f3d8f37794af1`. The latest poll still showed browser portal journeys, 7,000-fixture/300-user QA, and full verification in progress. The iOS Simulator job is cancelled. No merge is authorized while required checks remain incomplete.
- Latest inventory remains 39 branches including main (38 non-main); no branches deleted. Final post-consolidation acceptance remains blocked.


### Worldwide persona QA extraction review — 2026-11-16

- `recovery/ephinta-planner-budget-format-20261108` Gradle wrapper comparison is now complete: its `gradle-wrapper.properties` is byte-identical to current main (same blob SHA `0c5b28b2006d80f8b0585d688efcfbd4a2eab3ce`). Together with the older EnterpriseApp and planner journey test, all three changed paths reviewed on that branch are already present or superseded by main. **SUPERSEDED**; no extraction required.
- `qa/payment-notification-100-personas-20261113` has 12 commits ahead / 25 behind and six changed files. The overlapping payment persona spec is superseded by PR #210, but its unique `worldwide-personas.spec.ts` (100 country/city planning personas) and `run-worldwide-personas.mjs` runner are not in current main. The suite drives the public `/plan` questionnaire and checks generated local event briefs; it explicitly stops before account creation, vendor booking, notifications, or payment. Its workflow addition runs worldwide personas sequentially in the disposable browser-test database. **EXTRACT/REVIEW REQUIRED** for this isolated QA capability; retain the test-only scope and review selector reliability, data cleanup, package script wiring, and workflow runtime before merge. Do not merge the full branch or its overlapping payment test.
- The worldwide persona branch's workflow uses GitHub Actions `contents: read` and test-only local database/JWT values; no live payment credentials or production data are used in the reviewed files. This is a static source review only; the worldwide suite has not yet completed in the current PR run.
- PR #210 remains at head `5484350fd861952f7afa89c3574f3d8f37794af1`; browser portal journeys, 7,000-fixture/300-user QA, and full verification are still running. API integration and production build remain successful. No merge or branch deletion.


### Device-security branch semantic review — 2026-11-16

- `feature/ephinta-device-security-20261108` compares as 14 commits ahead / 223 behind with 9 changed paths. Its `DeviceSecurityGate.tsx` is already implemented on current main, and main contains the stronger version: per-user failed-attempt persistence, safe localStorage access/fallback, reset of lock/PIN state when the authenticated user changes, and removal of persisted attempt state on successful biometric/PIN unlock. The branch version keeps failed attempts only in a component ref (resettable on reload), does not re-read state when the account changes, and directly accesses localStorage in the state initializer. **SUPERSEDED for the device-gate component; do not replace main.**
- The branch's `apps/web/src/App.tsx` is not approved for replacement; its visible app-shell content is already aligned with main, and main is the authoritative newer integration base. Its `apps/web/package.json` is older: it lacks current main's SPA 404 build step, worldwide test script, and audio verification script. Do not overwrite it.
- The unique security rollout document is useful as a requirements reference, not proof that every control is implemented. It explicitly identifies server-managed device sessions, secure native token storage, server-side step-up authentication, and physical-device biometric acceptance as remaining work. It must not be read as evidence that selfie/video KYC or biometric identity verification is live.
- The branch's Android install-smoke workflow builds one debug APK, verifies its signature/archive, then installs and launches it on Android API 35 and 36 emulators. This is a useful candidate capability, but its workflow and emulator script still require a separate comparison against current main and current workflow conventions before extraction. No physical-device test is implied.
- No changes from this branch have been merged or extracted. Keep its final disposition open until the unique workflow/script and remaining documentation paths are reviewed.

### PR #210 and CI refresh — 2026-11-16

- PR #210 remains open, mergeable, and at head `5484350fd861952f7afa89c3574f3d8f37794af1`; review-thread lookup returned no unresolved threads.
- Run `43885179876`: API database integration and web/API production build passed; desktop/mobile browser journeys remain in progress, with worldwide and payment persona stages pending.
- Run `43885179580`: 7,000-fixture / 300-user scale, design and browser QA remains in progress.
- Run `43885180157`: full verification remains in progress.
- These are still pre-consolidation checks. Do not merge PR #210 or trigger final acceptance until all required checks complete successfully and the branch audit/integration gate is satisfied.


### Worldwide persona and Android install-smoke reconciliation — 2026-11-16

- The unique worldwide planner suite from `qa/payment-notification-100-personas-20261113` is already present on current `main` byte-for-byte: `worldwide-personas.spec.ts` blob `22d9d3187540535a13ac5dad4c9c197178cf30b2`; `run-worldwide-personas.mjs` blob `ae643afdf137653151979c43dfd17381c67d51c1`. Current main also already wires the 100-persona test into `.github/workflows/ephinta-browser-e2e.yml`, includes the web/root npm scripts, and uses a 60-minute browser job. The branch's workflow is an older variant (20-minute timeout). **The worldwide QA capability is SUPERSEDED by main; no extraction is needed.** The overlapping payment-persona spec remains dependent on PR #210 and is not independently approved for merge.
- The device-security branch's Android install-smoke script and workflow are older than current main. Current main's smoke script discovers the launcher activity instead of assuming `MainActivity`, and the workflow is scoped to native Android build inputs rather than every web-app change. Do not copy the branch versions over main.
- The device-security branch's `package-lock.json` is byte-identical to main (blob `0b461ba80fd5966826786a9ed54c11dbd74d1d28`). Its Android manifest and iOS Info.plist are older than main; the current main files are larger and must be retained. The App.tsx delta is a small older app-shell variant and must not overwrite main. The PIN gate component is superseded by main's stronger implementation, as recorded above.
- The branch adds a unique security/device-access requirements document. It is documentation, not implementation evidence: it explicitly lists secure native token storage, server-managed device sessions, server-side step-up authentication, and physical-device biometric testing as remaining requirements. Retain the document as an audit reference for now; do not claim those future controls are implemented. No production security behavior is changed by this review.
- PR #210 still has API integration and production build passing; browser portal journeys, worldwide/payment persona stages, 7,000-fixture/300-user QA and full verification remain in progress at the latest poll. PR head remains `5484350fd861952f7afa89c3574f3d8f37794af1`; no merge.

### PR #210 selector diagnosis and correction — 2026-11-16

- The previous failure report was more specific than an absent dashboard: PR #210's own EnterpriseApp.tsx snapshot contains dashboard navigation **buttons**, not the `<select>` controls that were added later on `main`. The test incorrectly queried `Planner dashboard section` and `Vendor dashboard section`, so all 100 personas timed out before reaching the payment form.
- Verified against the PR head source: planner navigation exposes the button with accessible name `Open Payments & finances`; vendor navigation exposes `Open Wallet & escrow`. The selector failure was therefore a test-to-branch UI mismatch, not evidence that OPay or the payment panels were broken.
- Updated `payment-notification-personas.spec.ts` to click those existing accessible navigation buttons. Fix commit: `6fe0d5030bd909e6a4358c88c65b9f7a11363522`.
- This supersedes the earlier ledger note that said the PR test should use the dashboard section `<select>`. The PR's source branch does not have that select. The correction must still pass a fresh browser run; no test success is claimed yet.
- Run `43885179876` ultimately completed with browser portal journeys **failed** (100 vendor/client persona failures from the selector mismatch); API database integration and production build passed. Runs `43885179580` and `43885180157` concluded **cancelled**, not passed. iOS simulator run `43885179971` was cancelled. These are pre-consolidation checks.
- PR #210 now points to head `6fe0d5030bd909e6a4358c88c65b9f7a11363522`. It remains open and unmerged. Fresh CI for this exact head has not yet been returned by the commit-run lookup; verify its new required checks before any merge decision.

### Responsive music-player recovery branch review — 2026-11-16

- `recovery/ephinta-responsive-music-player-20261108` compares as 20 commits ahead / 231 behind with four changed paths.
- `AudioExperience.tsx` on current main is substantially newer (10,970 characters vs 5,474) and includes the more complete category-aware player/consent flow. The branch's shorter component is not a safe replacement.
- `ephinta-audio.css` on main is larger (9,774 vs 5,890) and includes the current player styling and responsive behavior; the branch adds only a narrow prompt-width/flex-wrap safeguard already covered by the current main responsive rules. Do not replace the stylesheet wholesale.
- `audio-experience.spec.ts` on main is longer (7,112 vs 4,369) and includes the additional minimize/restore, consent, responsive and planner-interaction coverage. The branch test is an older subset; no missing unique test behavior was established.
- The Gradle wrapper file content is byte-identical despite compare metadata showing a one-line change (both resolve to Gradle 8.11.1 with the same timeout and validation settings).
- **Disposition: SUPERSEDED for all four reviewed paths**; no extraction required. This is a path-level content review, not branch deletion authorization until remaining commits and open-PR cross-reference are finalized.

### PR #210 CI state after selector correction — 2026-11-16

- New fix commit: `6fe0d5030bd909e6a4358c88c65b9f7a11363522`. It changes only the persona test navigation calls: planner uses `Open Payments & finances`; vendor uses `Open Wallet & escrow`.
- The commit-run lookup has not yet returned a new workflow run or status check for this exact head. PR #210 remains open/unmerged; do not merge or call the persona suite green until a fresh browser run and all required checks pass.
- Current branch inventory remains 39 branches including `main`; no branch has been deleted. Final acceptance remains blocked pending full dispositions, integration and separate cleanup.
### Customer landing and location branch content review — 2026-11-16

- `fix/customer-journey-landing-location-20261114` compares as 35 commits ahead / 20 behind with 12 changed paths. Its Android manifest and iOS Info.plist location-permission descriptions are byte-identical in content to current main; the branch does not provide a missing native location-permission implementation.
- `MarketplaceBrowse.tsx` and `index.css` are byte-identical to main. `MarketplaceAdStrip.tsx` is also content-equivalent for the reviewed location/marketplace behavior.
- `PublicLanding.tsx` is older/shorter (66,259 vs 69,582 characters). Its event-type-to-music-category behavior is already implemented on main with a more robust case-insensitive mapping and explicit separation of music consent from planning navigation. Main retains the saved event draft and category event dispatch.
- The branch's public-journey suite is older/shorter (54,575 vs 55,895 characters). Main includes stronger signed-out public marketplace browsing, role-specific registration and wrong-password checks, mobile registration reachability, audio-consent non-blocking behavior, and the same burial/naming soundtrack journeys. The branch's older signed-out marketplace redirect and full-screen blurred consent expectations must not replace the current public-browse and non-blocking behavior.
- The branch's responsive audit expects a full-screen blur, while current main explicitly verifies that the audio backdrop does not intercept app interactions. Keep the current main behavior and tests; do not reintroduce the blocking overlay expectation.
- `EnterpriseApp.tsx`, `AudioExperience.tsx`, and audio CSS differences are small older variants; current main already contains the newer implementations. The branch's public landing buttons use older wording and should not overwrite current main's current labels.
- **Disposition: SUPERSEDED for all 12 reviewed paths**; no required unique location, landing, marketplace, audio, or journey behavior was found. No extraction is needed. Branch deletion still waits for full open-PR and commit disposition review.
### Theme-text-contrast recovery branch review — 2026-11-16

- `recovery/ephinta-theme-text-contrast-20261108` compares as 11 commits ahead / 231 behind with five changed paths. Its Gradle wrapper is byte-identical to main.
- The branch's `main.tsx` reintroduces a fragmented legacy CSS import stack (`ephinta-accessible-contrast.css`, `ess-bright-orange-theme.css`, multiple design/repair stylesheets, and other legacy files). Current main uses the consolidated theme entry point and the global theme contract; do not restore the branch import stack.
- The branch's 217-line `ephinta-theme-text-contrast.css` is an older subset of the current main file (8,414 vs 10,932 characters). Main includes additional current theme tokens and focus/autofill contrast behavior.
- The branch adds a forced white gradient/ink override for the audio consent dialog at the end of `ephinta-parent-design-system.css`. That hard-coded light surface would override theme-dependent styling in dark mode and is not accepted as a global fix. Current main's parent stylesheet is otherwise the newer implementation.
- Its verification workflow is older: branch push trigger is scoped only to `chore/android-launch-readiness` and omits current main's `push` trigger for `main` plus the current `pull-requests: read` permission. Retain main's workflow.
- **Disposition: SUPERSEDED for all five reviewed paths**; no extraction required. No branch deletion until the full inventory and open-PR cross-reference are complete.
### Planner operations, messaging, notifications and KYC branch review — 2026-11-16

- `feat/planner-operations-finance-kyc-20261109` compares as 78 commits ahead / 146 behind with 23 changed paths.
- Key API paths are byte-identical to current main: the message-controls/notification-archive Prisma migration (blob `70f820c7c9412a46caa5d10634cbc60d014015c6`), `messages.routes.ts` (`eac7b26c21464d3df1c371387ab6af023a6f3767`), `messages.schemas.ts` (`809f607aa3cb5edd283124ebe532103006fee6de`), and `notifications.routes.ts` (`3f845aa3cc2ff66a8c5fc67916f6ca716b3bd2f1`).
- `NotificationsPanel.tsx` and `EventMessagesPanel.tsx` are also byte-identical to main (`904b8c1e6a02956deff3840398235308f5fb077c` and `665a6cc76b6dc6fdf675d7d3e8184021de8e5842`). `KycUpload.tsx` is byte-identical (`17a3263c7b078ef9cae42afb1d14e2dda864c53e`). The branch's Prisma schema is an older subset (30,402 vs 32,753 characters); main contains all reviewed branch lines plus later schema additions.
- Remaining EnterpriseApp, planner, feedback, guest-check-in, verifier, main-entry and CSS changes are older variants relative to current main. The added navigation/operations CSS files are not needed to restore functionality already present in the consolidated main stylesheet and current dashboard.
- **Disposition: SUPERSEDED for all 23 reviewed paths**; no migration, API, notification, messaging or KYC extraction is required. Do not merge the stale schema or dashboard wholesale.