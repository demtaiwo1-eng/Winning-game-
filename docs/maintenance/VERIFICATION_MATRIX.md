# EPHINTA maintenance verification matrix

This matrix records the checks required before a staged file cleanup is finalized. The dedicated workflow is `.github/workflows/ephinta-maintenance-cleanup.yml`.

| Layer | Automated verification | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| Dependencies | `npm ci` | The committed lockfile can be installed reproducibly | Licence rights or provider account validity |
| API and types | `npm run check` | API schema/type/unit checks, web unit tests and KYC research self-test | Live KYC or payment provider decisions |
| Database | Disposable PostgreSQL migrations and `npm run test:db -w apps/api` | Schema migration and database integration behavior in CI | Production database contents or live data migration |
| Production builds | `npm run build`, `npm run build:web` | API and web production compilation | Production hosting health |
| Device security | `npm run device-security:verify` | Static/runtime device security checks configured by the app | Physical-device penetration test |
| Rights gate | `npm run ip:verify` | Asset manifest, bundled media, tracked dependencies and retired material rules | Full public/proprietary source-code similarity scan |
| Design quality | `npm run design:audit:strict -w apps/web` | Automated responsive/design heuristics | Human usability or accessibility sign-off |
| Browser | Playwright desktop/mobile journeys | Tested browser flows against disposable CI database | Real users, production email or real-money transactions |
| Dependencies and notices | `ephinta-license-inventory.mjs` | Package/version and available licence/NOTICE evidence | Legal opinion or package-specific legal clearance |
| Android | `npm run mobile:verify` | Capacitor sync, Gradle lint, Android unit tests and debug APK build | Release signing, Play Store approval or physical-device installation |

## Cleanup acceptance rule

- Quarantined files must be absent from active application paths and retained byte-for-byte in the dated quarantine directory during the first test run.
- All required verification jobs must pass before quarantine copies are removed.
- After copies are removed, rerun the same required jobs against the final tree.
- Any failing check caused by the cleanup requires restoring the exact original file from its recorded Git blob SHA and repeating verification.
- A failed setup action is not an application pass. Fix the CI setup and rerun the affected job.
- Keep this matrix, the software inventory and the removed-files manifest with the maintenance change.

Live OPay collection/payout, SMTP delivery, KYC decisions, production hosting and production database behavior require separate authorized staging/provider checks. Never use synthetic tests to claim real settlement.
