# EPHINTA release verification tracker — 2026-11-02

## Scope and baseline

- Repository: `demtaiwo1-eng/Winning-game-`
- Default branch: `main`
- Verified source revision: `20a79c6e6fa63ace9393bd66c06c5dabfc13b376`
- Application workspace: `eventsss123/eventsss-main`
- This is a point-in-time CI and artifact record. It is not a claim of physical-device certification.

## Latest main-branch checks

All listed workflows completed successfully for revision `20a79c6e6fa63ace9393bd66c06c5dabfc13b376`:

| Check | Run | Result |
|---|---:|---|
| EPHINTA Phase 8 full safe release gate (disposable PostgreSQL) | 41394801469 | Passed |
| Browser journeys, API DB integration, web regression/build | 41394801433 | Passed |
| Dependency advisory report generation | 41394801435 | Completed; findings remain (see below) |
| Web checks and Android APK build | 41394801475 | Passed |
| Verified APK release publication | 41395115459 | Passed |

The web/API checks included dependency installation, Prisma validation/generation, migrations against disposable CI PostgreSQL, API/database integration tests, browser journeys, web regression tests, and production web build.

## Android APK build 228

- Release: https://github.com/demtaiwo1-eng/Winning-game-/releases/tag/ephinta-apk-41394801475
- Direct APK: https://github.com/demtaiwo1-eng/Winning-game-/releases/download/ephinta-apk-41394801475/ephinta-228.apk
- Package: `com.ephinta.app`
- Version: `1.0` (`versionCode=2`)
- Minimum SDK: `23`
- Target SDK: `34`
- Compile SDK: `35`
- APK size: `57,928,358` bytes
- APK signature: Android APK Signature Scheme v2 verified by `apksigner`
- APK archive integrity: `unzip -t` passed
- SHA-256: `1414a36a522f03179066c3593485d63edd45e0b01f06b26372c767f75d5f3b88`

This is a debug/testing APK. CI build and package verification are successful; neither is a substitute for installing on the user's physical Android device.

## Android emulator compatibility — unresolved

Workflow run 41394551555 was still running at the time of this record and tested earlier revision `672301e807b015e02397329ad272761493e7b577`, not the latest main revision.

- API 23: passed.
- API 30: failed after the emulator reported `adb: device offline`; package installation and package-path checks had already succeeded, and the device disconnected during the launch stage. This points to emulator/ADB instability, not a confirmed APK package incompatibility.
- API 35: still in progress at the time of this record.

Do not describe the complete Android matrix as passed. Repeat the matrix on the current main revision and obtain a physical-device install/launch result before claiming broad device compatibility.

## Dependency security findings

The latest dependency audit reports:

- All dependencies: 13 advisories — 1 critical, 2 high, 8 moderate, 2 low.
- Production dependencies: 0 advisories.
- The direct development dependency `@capacitor/cli` is on the Capacitor 6 line; npm reports a fix path via `@capacitor/cli@7.6.10`, which is a major-version migration.

Do not apply `npm audit fix --force` blindly. Plan and test a coordinated Capacitor major-version migration with compatible Android, iOS, plugin and updater packages, then rerun the full gate.

## Branch inventory and cleanup safety

The remote branch inventory currently contains `main` plus four non-main branches:

- `fix/android-install-smoke-test` — PR #49 was merged; remaining branch-only workflow edits are superseded by the newer main workflow.
- `fix/android-smoke-apk-path` — PR #50 was closed without merge; main has a newer smoke workflow with explicit APK path, package readiness checks, retries, APK signature and ZIP-integrity checks.
- `fix/opay-sandbox-mode-label` — PR #51 was merged; branch is stale.
- `ephinta/opay-sandbox-collection` — PR #7 was closed without merge and is 12 commits ahead / 93 behind main. Do not delete or merge wholesale without reviewing its unique payment changes; later OPay work was delivered separately in PR #47 and PR #51.

Keep `main`. Delete only branches confirmed fully superseded after final comparison. Branch deletion is a separate GitHub ref-delete operation; it is not performed by this read/build workflow.

## Remaining release actions

1. Rerun Android API 23/30/35 install-and-launch against the current main revision; distinguish emulator disconnects from APK installation failures.
2. Perform a physical-device install and launch test.
3. Coordinate and validate the Capacitor 7 toolchain migration to remove development dependency advisories.
4. Review the old OPay collection branch before any deletion.
5. Delete only the confirmed stale non-main branches once the repository owner has reviewed the inventory.


## Verification update — 2026-11-02, 06:16 UTC

Latest source revision: `e44d923e576a2f7b653d85fe6e183f9d91bb4279`.

| Check | Run | Result |
|---|---:|---|
| Web checks and Android APK build | [41398155223](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41398155223) | Passed |
| Browser E2E and regression | [41398155229](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41398155229) | Passed |
| Dependency advisory report | [41398155192](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41398155192) | Completed; findings remain |
| Android API 23/30/35 install and launch matrix | [41398155180](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41398155180) | In progress at 06:16 UTC; API 23 running, API 30 and 35 queued |

### Android APK build 229

- Release: https://github.com/demtaiwo1-eng/Winning-game-/releases/tag/ephinta-apk-41398155223
- Direct APK: https://github.com/demtaiwo1-eng/Winning-game-/releases/download/ephinta-apk-41398155223/ephinta-229.apk
- Package: `com.ephinta.app`
- APK size: 57,928,365 bytes
- SHA-256: `d2bd81d591198e153db5377276ca2da546ef995b3a2b23185598a0052b92baa6`
- Build workflow: passed web checks, APK build, signature verification, manifest inspection and ZIP integrity checks.
- This is an unsigned debug/testing APK. It is not evidence of physical-device installation or complete emulator-matrix compatibility.

The earlier sections above are historical snapshots for their stated revisions. Do not treat them as the latest CI state.
