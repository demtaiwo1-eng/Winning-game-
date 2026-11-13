# EPHINTA software, dependency, and service inventory

**Reviewed:** 2026-11-14  
**Application workspace:** `eventsss123/eventsss-main`  
**Purpose:** distinguish EPHINTA-owned code from required third-party software, optional providers, build tools, and legacy integrations. This is an operational inventory, not a legal opinion or proof of code originality.

## 1. First-party EPHINTA components

These are application features and code maintained in this repository, not standalone third-party products:

- Event planning, event budgets, guest/task coordination, service discovery, booking, vendor workspaces, verifier workflows, messaging, notifications, dashboards, wallet/ledger, payment intents, escrow orchestration, reconciliation, admin controls, role-based access, and audit records.
- EPHINTA web UI, API routes/business rules, Prisma schema/migrations, application-specific payment/KYC adapters, tests, scripts, and product documentation.
- EPHINTA branding and app artwork are first-party only if the owner can document creation/commissioning or commercial rights; see the asset-rights register.

## 2. Required runtime and development software

| Software | Role | Classification |
| --- | --- | --- |
| Node.js (>=20) | JavaScript/TypeScript runtime for API, web tooling and scripts | Required |
| npm | Dependency installation and workspace scripts | Required |
| PostgreSQL | Persistent relational database | Required for API-backed use |
| Prisma ORM and Prisma Client | Database schema, migrations, queries and generated client | Required |
| TypeScript | Static type checking and production compilation | Build/development requirement |
| React / React DOM | Web user interface | Required |
| React Router | Client-side navigation | Required |
| Express | HTTP API server | Required |
| Vite | Web development server and bundler | Required |
| Capacitor core, Android and iOS packages | Native application bridge and mobile packaging | Required for mobile builds; web-only deployment does not require native builds |
| Android Gradle Plugin / Gradle Wrapper / JDK 21 / Android SDK | Android build, lint and unit-test toolchain | Required only to build/verify Android |
| Git / GitHub | Source control, pull requests and CI | Required for repository collaboration and release |
| GitHub Actions | Automated CI, QA and release workflows | Required for current repository automation |

## 3. Direct npm dependencies

The authoritative manifests are the workspace manifests and lockfile under `eventsss123/eventsss-main`. The repository-root package file is a command wrapper, not a second application dependency tree.

### API direct runtime dependencies
- `@prisma/client` — generated database client.
- `bcryptjs` — password hashing.
- `cors` — cross-origin policy middleware.
- `dotenv` — local environment loading.
- `express` — HTTP API framework.
- `express-rate-limit` — request rate limiting.
- `helmet` — HTTP security headers.
- `jsonwebtoken` — signed session/access tokens.
- `nodemailer` — SMTP email transport.
- `pino` and `pino-http` — structured application/request logging.
- `zod` — runtime input/schema validation.

### API development/test dependencies
- `prisma`, `typescript`, `tsx`, `vitest`, `supertest`, and the relevant `@types/*` packages.

### Web direct runtime dependencies
- `react`, `react-dom`, `react-router-dom` — UI and navigation.
- `lucide-react` — icon set.
- `idb` — IndexedDB helper.
- `@capacitor/app` — native app lifecycle integration used by the web/mobile client.
- `@capgo/capacitor-updater` — optional over-the-air mobile update integration; requires an owner-managed Capgo account and policy review.
- `@aparajita/capacitor-biometric-auth` — optional native biometric authentication integration.

### Web build/test dependencies
- `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `vite-plugin-pwa`, `vitest`, and `@playwright/test`.

### Mobile direct dependencies
- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/push-notifications`, and `@capgo/capacitor-updater`.

### Workspace tooling
- `concurrently` and `wait-on` — local multi-process development orchestration.

The exact resolved versions, transitive packages, licence expressions, and notice texts are determined by `package-lock.json` and the generated CI dependency-licence artifact. Do not replace the lockfile with guessed versions or claim this direct-dependency summary lists all transitive packages.

## 4. External providers and hosted services

| Provider/software | Current purpose | Required decision/control |
| --- | --- | --- |
| Render | Hosts the web/API services | Required by current deployment; owner controls services, secrets, plan and deploys |
| OPay | NGN payment collection and intended bank payout rail | Keep as preferred NGN provider; payout/live access depends on merchant entitlement, credentials, webhook verification and reconciliation |
| SMTP provider | Sends password-reset email through Nodemailer | Configure a real provider and verify delivery; payment email notifications are not assumed |
| Bytid | Configured KYC provider adapter | Use only with valid contract, consent, data-processing terms and country coverage |
| PostgreSQL host | Hosts production database | Keep database credentials private; backup/restore and migration controls required |
| S3-compatible object storage | Stores uploaded files where configured | Optional deployment service; verify bucket policy, encryption, retention and data-processing terms |
| Capgo | Optional Capacitor OTA updater | Do not treat as mandatory for web operation; verify update signing, release channels, account terms and rollback |
| GitHub Actions | CI/build/test automation | Keep workflows and secrets scoped to least privilege |
| Playwright / Chromium | Browser automation and end-to-end tests | Test-only dependency; not required by production runtime |
| Vitest / Supertest | Unit/API test execution | Test-only dependencies |
| Gradle / Android SDK / JDK | Native Android build toolchain | Build-time only |

## 5. Legacy or optional integrations — do not delete without data review

- Paystack, Flutterwave and Stripe code paths are identified in the existing audit as legacy payment adapters/webhooks. Preserve historical verification/refund/reconciliation capability until pending intents and stored provider references are reconciled and a migration plan is approved. They must not silently become new NGN payment routes when OPay is the selected provider.
- Veriff, Smile ID and Sumsub references are research-only unless a live adapter and contract are independently confirmed. They are not substitutes for the configured Bytid flow.
- Push notifications are not operational merely because Capacitor push packages are installed. Provider credentials, device registration and delivery tests are separate requirements.
- Music/audio playback is intentionally disabled until a rights-cleared HTTPS source and evidence are registered.
- OPay, SMTP, KYC, object storage and OTA update services are external solutions; EPHINTA does not own their infrastructure or grant their licences.

## 6. Not necessary in the production runtime

The following are build/test/maintenance-only and should not be shipped as production server dependencies unless a specific deployment need is documented:

- Playwright, Chromium, Vitest, Supertest, TypeScript compiler, Prisma CLI, TSX, Vite, Tailwind build plugins, and Gradle/Android SDK.
- Local PostgreSQL Docker Compose configuration and local test fixtures.
- QA persona generators, load-test drivers, design audits, licence scanners and release scripts.

Do not remove these from the repository merely because they are not runtime dependencies: they protect quality, reproducibility, release safety and legal compliance.

## 7. Licence and provenance requirements

- Generate the full package/version licence and NOTICE inventory from the committed lockfile and installed packages for every release.
- Preserve all upstream copyright and licence notices. EPHINTA's proprietary terms cannot override dependency licences.
- Review all SPDX fallback entries for package-specific copyright/NOTICE obligations.
- Record the origin and commercial rights for every logo, icon, illustration, font, audio, video and other bundled asset.
- Obtain signed contributor IP assignments or sufficient commercial licences before asserting exclusive ownership of all repository contributions.
- A proprietary notice does not make a public GitHub repository private.

## 8. Authoritative verification commands

From `eventsss123/eventsss-main`:

```bash
npm ci
npm run check
npm run build
npm run build:web
npm run ip:verify
node scripts/qa/ephinta-license-inventory.mjs
npm run mobile:verify
```

The mobile command requires JDK 21 and an installed Android SDK. Database integration, browser E2E, real provider settlement, email delivery, KYC provider decisions, production credentials and physical-device installation need their own configured test environments. A mocked test is not a real provider settlement.

## 9. Maintenance policy

Before removing any file: identify its callers, imports, workflow references, package scripts, runtime route, migration/data dependencies and rollback path. Move candidates to a dated quarantine location, run relevant checks, then delete only after the quarantine build and the final deletion build both pass. Keep a path/SHA recovery manifest in the same pull request.
