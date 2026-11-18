# EPHINTA

EPHINTA is a multi-role event-planning and entertainment-services platform. It brings event owners, organizations, service providers, vendors, guests, readiness verifiers and platform operators into one workflow for planning events, discovering services, coordinating delivery and tracking payments.

> **Project status:** Active development. This repository contains web, API and Capacitor mobile applications plus automated verification workflows. A successful build or mocked test does not by itself prove production payment settlement, email/push delivery, KYC approval, production database health, or successful installation on every physical device. See [the product requirements and release acceptance document](docs/PRODUCT_REQUIREMENTS_AND_ACCEPTANCE.md).

## Product areas

- **Accounts and access:** registration, sign-in, password recovery, session handling, role-aware workspaces and device-security checks.
- **Event planning:** create events, manage budgets, tasks, guests and RSVPs, track readiness, coordinate teams and communicate with individuals or groups.
- **Marketplace:** discover venues, goods and services; manage vendor profiles, listings, enquiries, bookings, promotions and reviews.
- **Vendor operations:** storefront management, KYC submission, booking/payment requests and fulfilment tracking.
- **Wallet and payments:** currency-aware wallet/ledger, collection, payout, refunds, escrow-related booking flows, payment reconciliation and provider integrations. Provider capabilities depend on configured credentials and account approval; test in sandbox first.
- **Notifications and messaging:** in-app notifications, event conversations and optional native push registration where configured.
- **Music and rights administration:** music experience, rights-owner records and DSP administration surfaces. Rights attribution and royalty settlement require verified repertoire, contracts, usage accounting and finance/legal sign-off.
- **Global catalogue and experience modes:** localized/currency-aware workflows, marketplace discovery and role-based experience modes.
- **Mobile:** Capacitor Android and iOS shells around the web application, with native app lifecycle, update and device capabilities where enabled.

See the [full role, workflow and acceptance matrix](docs/PRODUCT_REQUIREMENTS_AND_ACCEPTANCE.md) for intended behaviour and completion criteria.

## Repository layout

The project is an npm workspaces monorepo. The application workspace lives under `eventsss123/eventsss-main`.

| Path | Purpose |
| --- | --- |
| `eventsss123/eventsss-main/apps/api` | Express + TypeScript API, Prisma schema and PostgreSQL integration |
| `eventsss123/eventsss-main/apps/web` | React + TypeScript + Vite web/PWA frontend and Playwright journeys |
| `eventsss123/eventsss-main/apps/mobile` | Capacitor Android/iOS wrappers and native projects |
| `eventsss123/eventsss-main/scripts` | Development, database, QA, security, payment-mode and operational scripts |
| `.github/workflows` | CI, browser tests, Android builds, release and maintenance workflows |
| `docs` | Operational and product documentation |

## Requirements

- Node.js 20 or newer.
- npm (use the committed root `package-lock.json`).
- PostgreSQL for API/database-backed development.
- Java 17 or 21 for Android Gradle builds (use the version required by the current Android Gradle configuration).
- Android SDK for local Android builds; Xcode/macOS for local iOS builds.

## Quick start

From the repository root:

```bash
npm ci
```

Configure the API and web environment using the committed example files and the configuration schema in `apps/api/src/config`. At minimum, local API execution requires a valid PostgreSQL `DATABASE_URL` and the required authentication secrets. Never commit production secrets or paste provider credentials into issues or chat.

Start the development environment using the repository helper:

```bash
npm run dev
```

Useful alternatives:

```bash
npm run dev:api
npm run dev:web
npm run web:preview
```

The root workspace is nested one directory below the repository root. If running workspace-specific commands manually, change into `eventsss123/eventsss-main` first, or use the root scripts shown below.

## Verification commands

Run the checks relevant to the code you changed:

```bash
# API schema validation, Prisma generation, TypeScript and API tests;
# then web unit tests and the KYC research self-test
npm run check

# API production build
npm run build

# Web TypeScript and production bundle
npm run build:web

# Web tests and production build
npm run web:check

# Database migrations and integration tests (requires configured PostgreSQL)
npm run db:deploy
npm run test:db

# Device security and responsive/design checks
npm run device-security:verify
npm run ux:audit

# Android sync, lint, unit tests and debug APK
npm run mobile:verify

# Browser journeys (from apps/web workspace)
npm run test:e2e -w apps/web
```

Some workflows use additional environment secrets, disposable databases, provider sandboxes, Android signing material or hosted services. A skipped, cancelled, setup-failed or mocked job must not be reported as a production pass. Read [the verification matrix](docs/maintenance/VERIFICATION_MATRIX.md).

## Payments and financial safety

- Keep development and CI in **sandbox/test mode**.
- OPay is the first provider integration to validate end-to-end. Eversend and Cleva must remain explicitly marked unavailable/not configured until their accounts, API contracts, credentials and tests are verified.
- Do not enable live collection, payout or refunds without provider approval, secure secret configuration, webhook signature validation, idempotency, reconciliation and an authorised staging sign-off.
- Store credentials in the deployment platform's secret/environment-variable manager, never in source control.
- Amounts are represented in integer minor units with an ISO currency code; do not use floating-point arithmetic for money.
- A green mocked E2E test is not evidence of real settlement.

## Deployment

The repository includes Render deployment manifests. Review `render.yaml` and `render.ephinta-web.yaml` before applying changes. Preserve the project's Render Free operating constraint unless the owner explicitly changes it. Confirm the selected service type, build/start commands, health checks, database availability and environment variables in the Render dashboard. Never assume a deploy succeeded solely because a manifest exists.

## Android and iOS

- Android verification: `npm run mobile:verify`.
- Debug APK: `npm run mobile:build` (requires Java and Android SDK).
- Signed release workflows require the documented signing secrets; see [Android GitHub signing](docs/ANDROID-GITHUB-SIGNING.md).
- iOS builds/signing require macOS/Xcode and the relevant Apple signing configuration.
- Test the produced APK on a physical Android device, including install, cold start, login, navigation, offline/reconnect and update behaviour. A CI build alone does not prove device compatibility.

## Security, privacy and operations

- Use least-privilege roles and enforce authorization in the API, not only in the UI.
- Protect passwords with the configured password hashing; use short-lived access tokens and revocable refresh tokens.
- Validate uploads, limit request rates, avoid logging credentials/tokens/payment data and keep audit trails for sensitive operations.
- Treat KYC documents and personal data as sensitive; use restricted storage and retention controls.
- Use synthetic test personas only for test environments. Never present synthetic businesses, addresses, images, reviews or phone numbers as real listings.
- Back up production data and rehearse restoration before high-risk migrations.

## Contributing and change control

1. Work from an up-to-date branch based on `main`.
2. Keep changes focused; do not merge large divergent branches wholesale.
3. Review file-level diffs, generated files, migrations, assets and deletions before integration.
4. Add or update unit, API, browser and mobile tests for changed behaviour.
5. Run all required CI gates and resolve failures; do not bypass required checks.
6. Merge only after review and passing checks. Delete a branch only after verifying its unique commits and files are integrated or intentionally archived.

## Product scope and release criteria

The authoritative working scope, personas, end-to-end journeys, external dependencies and acceptance gates are maintained in [docs/PRODUCT_REQUIREMENTS_AND_ACCEPTANCE.md](docs/PRODUCT_REQUIREMENTS_AND_ACCEPTANCE.md). Production readiness requires passing automated checks **and** separate verification of hosted services, provider credentials, webhooks, real devices, operational recovery and legal/commercial rights.
