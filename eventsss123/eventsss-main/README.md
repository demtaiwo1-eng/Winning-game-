# EPHINTA

> Plan events, coordinate trusted service providers, manage event delivery, and track payments in one connected workspace.

<p align="center">
  <strong>One workspace for the people, services, money, and moments behind an event.</strong>
</p>

<p align="center">
  <a href="https://ephinta-web.onrender.com/">Open EPHINTA</a> ·
  <a href="./docs/">Project documentation</a> ·
  <a href="https://github.com/demtaiwo1-eng/Winning-game-/issues">Report an issue</a>
</p>

---

## At a glance

EPHINTA is an event-planning and service marketplace application. It brings event owners and organizers together with vendors and verifiers, with shared workflows for planning, booking, communication, service checks, and payment records.

| Workspace | What it is for |
| --- | --- |
| Clients and organizers | Create and coordinate events, manage plans and budgets, book services, and follow event progress |
| Vendors | Present services, receive booking/payment requests, and manage fulfilment |
| Verifiers | Review assigned event services and record checks and feedback |
| Administrators | Manage platform operations, user access, payment mode, and oversight workflows |

## Product capabilities

- Event planning, guest and task coordination, event budgets, and booking workflows.
- Vendor profiles, service listings, enquiries, bookings, and payment requests.
- Verifier assignment and event-service verification data models.
- Wallets, payment intents, escrow and payout workflows, reconciliation, and audit records.
- Central payment-mode controls for DEMO, TEST, and LIVE environments.
- Responsive web application and an Android client built with Capacitor.
- Role-based API authorization and authenticated account workflows.

> **Payment safety:** Nigerian naira (NGN) is configured to use OPay. The platform fee policy is 2% for incoming wallet deposits and 2% for outgoing OPay bank withdrawals. DEMO transactions are simulations, TEST uses provider sandbox credentials, and LIVE requires production credentials plus the explicit readiness configuration. A successful health check or simulated payment is not proof of a settled bank transaction.

## Quick start

### Requirements

- Node.js 20 or later (the repository currently declares `node >=20`).
- npm with workspace support.
- PostgreSQL for API-backed development.
- Java 21 and the Android SDK only when building/verifying the Android application.

### Install

Run commands from this application directory:

```bash
cd eventsss123/eventsss-main
npm ci
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

Set the required local values in `.env` (at minimum, a PostgreSQL `DATABASE_URL` and a strong private `JWT_SECRET`). Configure the remaining variables using [`.env.example`](./.env.example) and the deployment documentation. Never commit `.env`, API keys, signing keys, database credentials, or provider secrets.

Start the local PostgreSQL service if you use the supplied development compose file:

```bash
docker compose -f compose.dev.yml up -d postgres
```

Generate the Prisma client and start the development environment:

```bash
npm run prisma:generate
npm run dev
```

The development launcher reports the local web/API URLs when ready. The web-only Vite server can also be started with:

```bash
npm run dev:web
```

## How to use EPHINTA

1. Open the web application or install the Android build supplied by the project owner.
2. Register or sign in using the account type that matches your role.
3. Clients and organizers create an event and complete its planning details.
4. Add vendors/services, bookings, tasks, and event participants as needed.
5. Assign verifiers to the event and use the available verification and service-check workflows.
6. Follow payment intents, wallet records, booking/deposit status, and payout status from the relevant workspace.
7. Administrators use the admin workspace to oversee users and platform operations.

Available screens and actions depend on account role, deployment configuration, and enabled feature flags. Do not assume a feature is enabled in production solely because its database model or development screen exists.

## Payment configuration

The application keeps payment provider credentials on the server. Configure them as encrypted environment variables in the hosting provider; do not put them in browser code, mobile assets, screenshots, source control, or support messages.

For NGN:

- Provider: OPay.
- Incoming wallet deposit fee: 2%.
- Outgoing bank withdrawal fee: 2%.
- TEST: use OPay sandbox credentials and the sandbox payment endpoints.
- LIVE: keep disabled until the production merchant credentials, webhook verification, payout permissions, reconciliation, and operational readiness have been independently verified.

Read [Payment provider onboarding](./docs/PAYMENT_PROVIDER_ONBOARDING.md), [Central payment mode](./docs/CENTRAL-PAYMENT-MODE.md), and [Payment test notes](./docs/PAYMENTS-TEST.md).

## Common development commands

Run these from `eventsss123/eventsss-main`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development environment |
| `npm run check` | Run API checks, web tests, and KYC research self-test |
| `npm test` | Run API and web unit tests |
| `npm run build` | Generate Prisma client and build the API |
| `npm run build:web` | Build the web application |
| `npm run mobile:verify` | Run checks, build web assets, sync Capacitor, and verify Android |
| `npm run qa:scale:plan` | Print the existing scale QA plan |
| `npm run qa:scale` | Run the existing scale QA suite |\n| `node scripts/qa/ephinta-license-inventory.mjs` | Generate the npm dependency licence inventory |

The bounded 5,000-identity single-node health campaign and the payment-functional simulation are QA tools. Their reports must clearly distinguish synthetic results from authenticated provider settlement and real customer activity.

## Android build

Android builds require a supported JDK (use Java 21 for the current project toolchain), Android SDK/build tools, and the Android project under `apps/mobile/android`.

```bash
npm run mobile:verify
npm run mobile:build
```

The debug APK is generated under `apps/mobile/android/app/build/outputs/apk/debug/`. Treat debug APKs as test builds, not production-signed releases.

## Deployment and security

- Production web: [ephinta-web.onrender.com](https://ephinta-web.onrender.com/)
- Production API: [ephinta-wss.onrender.com](https://ephinta-wss.onrender.com/)
- Keep API credentials and signing material in the hosting provider's secret store.
- Use HTTPS for public webhooks and API traffic.
- Verify provider callbacks server-to-server; never trust a browser redirect as payment confirmation.
- Keep LIVE mode locked until a documented readiness review is complete.
- Back up the database and test restoration before production schema changes.

## Commercial access

The requested commercial offer is **US$59.99** with access unlocked by a unique redemption code issued after verified purchase. This README records the intended offer; it does not claim that the paid-access gate, checkout, code issuance, or redemption flow is already deployed. Those controls must be implemented server-side, tested against replay/brute-force attempts, and connected to a verified payment method before customers are charged. The licence duration and whether the price is one-time or recurring must be stated in the checkout terms.

## Documentation

- [Payment provider onboarding](./docs/PAYMENT_PROVIDER_ONBOARDING.md)
- [Central payment mode](./docs/CENTRAL-PAYMENT-MODE.md)
- [Payment tests](./docs/PAYMENTS-TEST.md)
- [Implementation report](./EPHINTA_IMPLEMENTATION_REPORT.md)
- [Third-party and source-ownership audit](./docs/THIRD_PARTY_AUDIT.md)

## Third-party software, media, and acknowledgements

EPHINTA uses third-party open-source packages and platform tooling. Each dependency remains governed by its own licence and notices. The repository-level third-party inventory and outstanding ownership checks are tracked in [`docs/THIRD_PARTY_AUDIT.md`](./docs/THIRD_PARTY_AUDIT.md).

Audio and visual assets must only be distributed where EPHINTA has documented ownership, a suitable licence, or written permission. A filename or an attribution label alone is not proof of a distribution licence.

## Licence

No project-level open-source licence is declared by this repository at the time this README was written. Do not assume that the application source, branding, or bundled media may be copied, redistributed, or commercially reused. Third-party dependencies and assets retain their own licence terms. See the audit document and obtain legal review before publishing a definitive proprietary or open-source licence.

---

<p align="center">
  <sub>EPHINTA · Event planning, service coordination, and accountable delivery.</sub>
</p>
