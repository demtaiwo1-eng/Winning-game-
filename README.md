<div align="center">

# ✨ EPHINTA

### Plan beautifully. Book confidently. Bring every occasion together.

**An event-planning, services marketplace and event-delivery workspace — connecting organisers, vendors, guests, verifiers and platform operators.**

[![Repository](https://img.shields.io/badge/GitHub-EPHINTA-181717?style=for-the-badge&logo=github)](https://github.com/demtaiwo1-eng/Winning-game-)
[![Web app](https://img.shields.io/badge/Live-Web%20App-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](https://ephinta-web.onrender.com/)
[![API health](https://img.shields.io/badge/API-health-16a34a?style=for-the-badge)](https://ephinta-wss.onrender.com/health)
[![API readiness](https://img.shields.io/badge/API-ready-16a34a?style=for-the-badge)](https://ephinta-wss.onrender.com/ready)

[🌐 Open the app](https://ephinta-web.onrender.com/) · [📡 API health](https://ephinta-wss.onrender.com/health) · [🧭 Product acceptance guide](docs/PRODUCT_REQUIREMENTS_AND_ACCEPTANCE.md) · [🛠️ CI workflows](.github/workflows) · [💵 US$60 source-access plan](docs/COMMERCIAL_SOURCE_ACCESS_PLAN.md) · [📋 IP clearance register](docs/CONTRIBUTOR_AND_IP_CLEARANCE_REGISTER.md)

</div>

---

## 🌟 The product

EPHINTA is being built as one connected workspace for planning an event and coordinating the people and services that make it happen. Instead of spreading event briefs, vendor conversations, budgets, bookings, deposits and service checks across disconnected tools, EPHINTA brings those workflows into a shared experience.

**The product promise:** plan the occasion, discover the right services, coordinate delivery, track agreed payments and see what still needs attention.

## 🎯 Who EPHINTA serves

| Workspace | What the user can do |
|---|---|
| 🎉 **Client / event planner** | Create events, set budgets and timelines, manage guests and RSVPs, discover providers, request bookings, track deposits and communicate with participants. |
| 🏢 **Organisation / organiser** | Coordinate teams and organisation events with role-appropriate workspace access. |
| 🛍️ **Vendor / service provider** | Manage a business profile and services, receive enquiries and bookings, submit KYC information, request eligible part-payments and follow fulfilment. |
| 👥 **Guest / invitee** | Receive event information, respond to invitations and use permitted event-specific features. |
| 🛡️ **Verifier** | Review assigned service-readiness checks, record evidence and timestamps, and report completion status. |
| 🤝 **Consultant** | Work on assigned event operations, track progress and communicate within the permitted scope. |
| ⚙️ **Administrator / operations** | Oversee users, roles, marketplace operations, verification, payments oversight and platform reporting. |
| 📣 **Affiliate / growth partner** | Support approved referral programmes and view eligible referral records and statements. |

> **Permission principle:** protected actions must be authorised by the API. Hiding a control in the interface is not a security boundary.

## 🧩 What the application contains

<details open>
<summary><strong>🗓️ Event planning and delivery</strong></summary>

- Event briefs, event types, dates, locations, guest ranges, budgets and currencies.
- Planning tasks, timelines, guest lists, invitations and RSVP workflows.
- Service discovery and booking coordination.
- Event readiness, outstanding items and service verification.
- Direct and group conversations connected to an event.
- Deposit and payment-milestone visibility in the event and account workflow.

</details>

<details>
<summary><strong>🛒 Marketplace and vendor operations</strong></summary>

- Venue, goods and service discovery.
- Vendor profiles, storefronts, listings, pricing and availability.
- Enquiries, booking requests, vendor responses and fulfilment tracking.
- KYC submission and review-status workflows.
- Eligible deposit and part-payment request workflows.
- Reviews, promotions and marketplace discovery surfaces.

</details>

<details>
<summary><strong>💳 Wallet, billing and payment infrastructure</strong></summary>

- Currency-aware wallet and ledger data model.
- Payment intents, booking deposits, payout and refund workflows.
- Provider adapter structure and payment-mode controls.
- Reconciliation, idempotency and webhook-safety requirements.
- OPay is the first provider intended for sandbox validation; Eversend and Cleva remain subject to account access, credentials, API validation and sandbox evidence.

**Important:** payment screens, provider adapters and mocked tests do not prove that real money has moved. Do not enable live payments until provider-backed collection, payout, refund, webhook and reconciliation tests have been signed off.

</details>

<details>
<summary><strong>🔐 Identity, account security and notifications</strong></summary>

- Role-aware registration, sign-in and session workflows.
- Password recovery and account-security controls.
- Email verification with hashed, expiring, single-use tokens, verification/resend endpoints and session-security checks is merged into `main`.
- Device PIN / security gate and optional native biometric capability where supported.
- In-app notifications and event-scoped messaging.
- Brevo transactional email support is implemented; real delivery still requires `BREVO_API_KEY`, a verified sender and a successful inbox test in Render.

</details>

<details>
<summary><strong>🎵 Music and rights administration</strong></summary>

- Music playback and audio experience surfaces.
- Music / DSP administration and rights-owner data structures.
- Rights and usage reporting concepts.

Track-level ownership, performer/publisher permissions, territory and term, revenue allocation and royalty settlement require documented rights and finance/legal approval. A player or rights-owner record alone does not establish a cleared catalogue or payable royalties.

</details>

<details>
<summary><strong>📱 Web, PWA and mobile</strong></summary>

- React web application and responsive layouts.
- Capacitor Android and iOS application shells.
- Android debug/test APK generation in CI.
- Native capabilities and update paths where configured.

A successful Android build is not proof of installation on every phone. A web deployment does not automatically update every installed native app. Production Android distribution needs the correct persistent signing key; iOS distribution needs Apple signing and provisioning.

</details>

## 🟢 Live service check

The deployed endpoints were checked on **19 November 2026**:

| Check | Observed result | What it means |
|---|---|---|
| [Public web app](https://ephinta-web.onrender.com/) | Responded with the EPHINTA landing page | The public web surface is reachable. |
| [API health](https://ephinta-wss.onrender.com/health) | `{"status":"ok"}` | The API process responded to its health endpoint. |
| [API readiness](https://ephinta-wss.onrender.com/ready) | `{"status":"ready"}` | The API readiness endpoint reported ready. |

These checks do **not** prove that a user can complete every registration, booking, payment, email, KYC or mobile-install journey. The deployed landing page describes event planning and provider discovery; authenticated workflows require separate end-to-end testing.

## 📊 Engineering and release status

**Audited checkpoint: 19 November 2026**

| Area | Evidence available | Status / limitation |
|---|---|---|
| Web and API | Live web page; API health and readiness responded | <span style="color:#16a34a"><strong>Reachable</strong></span>; full customer journey not proven by health checks |
| API, web and database test gates | Merged application-completion CI (PR #249) | <strong>Passed in that CI run</strong> |
| Browser regression and responsive audit | Merged PR #249 workflow results | <strong>Passed in that CI run</strong> |
| Scale QA and security audit | PR #249 workflow results | <strong>Passed in that CI run</strong> |
| Android | CI web checks and Android APK workflow | <strong>Build passed</strong>; physical-device installation still needs confirmation |
| iOS simulator | PR #249 workflow | <strong>Not verified</strong>; simulator job was cancelled |
| Email delivery | Brevo integration code is merged in PR #249 | Requires Brevo API key, verified sender and real delivery test |
| Live payments | Provider integration and sandbox prerequisites documented | Requires provider credentials and real sandbox transaction evidence |
| Production mobile release | Android signing and Apple signing prerequisites documented | Not a signed production release |

The one-go application-completion and authentication work is merged into `main` through [PR #249](https://github.com/demtaiwo1-eng/Winning-game-/pull/249); it includes the authentication work previously developed in PR #248. The automated CI completion job passed, while the iOS simulator job was cancelled and physical-device, live email, provider sandbox and production-signing checks remain separate acceptance gates.

For the detailed requirement-by-requirement baseline and acceptance journeys, read [Product Requirements & Acceptance](docs/PRODUCT_REQUIREMENTS_AND_ACCEPTANCE.md) and [Verification Matrix](docs/maintenance/VERIFICATION_MATRIX.md).

## 🏗️ Technology and repository map

| Layer | Technology / location |
|---|---|
| Web frontend | React 18, TypeScript, Vite, React Router and PWA tooling |
| API | Express, TypeScript and modular REST API |
| Database | PostgreSQL with Prisma ORM |
| Mobile | Capacitor 6, Android and iOS native projects |
| Browser testing | Playwright |
| Automation | GitHub Actions workflows |
| Hosting configuration | Render manifests |
| Main application workspace | `eventsss123/eventsss-main` |

**Repository structure**

```text
.
├── .github/workflows/             # CI, quality gates and build automation
├── docs/                           # Product, release and operations guidance
├── eventsss123/eventsss-main/
│   ├── apps/api/                   # Express API, Prisma schema and migrations
│   ├── apps/web/                   # React web application
│   ├── apps/mobile/                # Capacitor Android and iOS projects
│   ├── scripts/                    # QA, build and operational scripts
│   └── package.json                # Main npm workspace manifest
├── scripts/                        # Repository-level helper scripts
├── render.yaml                     # Render service configuration
└── README.md
```

The API is organised into modules including authentication, admin, billing, checkout, events, KYC, marketplace, music/DSP, notifications, payments, readiness, RSVP and wallet.

## 🚀 Run the project

### Requirements

- Node.js 20 or newer.
- npm.
- PostgreSQL for API-backed development.
- Java 17 or 21 and Android SDK for Android builds.
- macOS with Xcode for local iOS builds.

### Install and start

From the repository root:

```bash
cd eventsss123/eventsss-main
npm ci
cp .env.example .env
```

Configure the required local environment values, including a development PostgreSQL `DATABASE_URL` and strong development-only authentication secrets. Then run:

```bash
npm run dev
```

Never commit `.env`, API keys, payment credentials, database dumps, customer records, signing keys or private certificates.

### Useful verification commands

Run these from `eventsss123/eventsss-main`:

```bash
# API schema, TypeScript and API tests; web tests and KYC research self-test
npm run check

# API production build
npm run build

# Web production build
npm run build:web

# Database migrations and integration tests (configured PostgreSQL required)
npm run db:deploy
npm run test:db

# Device security and responsive UX audit
npm run device-security:verify
npm run ux:audit

# Android sync, lint, unit tests and debug APK
npm run mobile:verify
```

Some tests require a disposable database, browser dependencies, Java/Android SDK or provider sandbox configuration. A skipped, cancelled or mocked test must be reported as such, not as a pass.

## 💰 Commercial source package — US$60

<div align="center">

### Planned one-time source-access price

# **US$60**

**A proposed one-time price for an authorised EPHINTA source-code package.**

</div>

The commercial offer is **not yet open for checkout**. This GitHub repository is currently public, so visitors can view and download the source without paying. No payment link or automatic paid-access delivery is active in this repository today.

Before accepting the US$60 payment, the owner must:

1. Confirm the legal rights holder and obtain written contributor assignments or licences for all contributed code and assets.
2. Complete third-party dependency, music, image, font and other asset licence reviews.
3. Approve the commercial licence terms, permitted use, support scope, refund policy and update entitlement.
4. Move the sale copy to a private repository or controlled delivery package; a public GitHub repository cannot enforce a paywall.
5. Connect a real checkout provider and implement verified payment confirmation before granting repository/package access.
6. Test the complete purchase → verified payment → access delivery → revocation/refund process.

**Do not send payment for source access until an official checkout and delivery process is published.** A README price is a product offer description, not a payment processor or access-control system.

## 🔒 Security, payments and deployment safeguards

- Keep all provider integrations in sandbox/test mode until formally approved.
- Store Brevo, OPay, Cleva, Eversend and other secrets in Render or GitHub's secure secret stores.
- Validate payment webhook signatures, enforce idempotency and reconcile provider records against the ledger.
- Use least-privilege roles and enforce permissions in API handlers.
- Protect KYC documents and personal data with access and retention controls.
- Keep money in integer minor units with an ISO currency code.
- Back up production data and rehearse restoration before risky migrations.
- Preserve the Render Free deployment constraint unless the owner approves a change.
- Never use synthetic test businesses, reviews, identities or transactions as proof of real-world activity.

## 🧭 Release checklist

- [ ] Merge the reviewed application-completion and authentication work only after resolving overlapping PRs and passing required checks.
- [ ] Verify registration, wrong-password handling, password reset and email verification with real controlled test accounts.
- [ ] Verify planner → booking → sandbox deposit → ledger/dashboard journey.
- [ ] Verify vendor → KYC → part-payment request → fulfilment journey.
- [ ] Verify direct and group event messaging permissions.
- [ ] Complete OPay sandbox collection, payout, refund and webhook reconciliation.
- [ ] Configure and test Brevo sender authentication and real delivery.
- [ ] Install and exercise the APK on a physical Android phone.
- [ ] Complete Android signing and iOS signing before public store distribution.
- [ ] Complete legal ownership, third-party rights and paid-access checkout controls before commercial sale.

## 🤝 Contributing and change control

1. Branch from the latest `main`.
2. Keep changes focused and review the complete diff.
3. Add regression tests for changed behaviour.
4. Run relevant checks and resolve failures.
5. Open a pull request and wait for required checks.
6. Merge only after review and verification; delete branches only after confirming their unique work is integrated or intentionally archived.

---

<div align="center">

**EPHINTA — one place to plan, connect, coordinate and deliver.** ✨

<sub>Product and engineering status is evidence-based and may change as open pull requests are merged and external services are configured.</sub>

</div>
