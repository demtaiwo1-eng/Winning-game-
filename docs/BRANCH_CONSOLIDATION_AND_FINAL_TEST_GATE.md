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
