<div align="center">

# ✨ EPHINTA

### Plan beautifully. Book confidently. Celebrate together.

**One workspace for event organisers, clients, vendors and verifiers.**

[![Release candidate](https://img.shields.io/badge/release-candidate-7c3aed?style=for-the-badge)](https://github.com/demtaiwo1-eng/Winning-game-/pull/187)
[![Rights review](https://img.shields.io/badge/IP-review-in%20progress-f59e0b?style=for-the-badge)](./eventsss123/eventsss-main/docs/EPHINTA_SOURCE_SIMILARITY_AUDIT.md)
[![Licence inventory](https://img.shields.io/badge/dependencies-licence%20inventoried-16a34a?style=for-the-badge)](./eventsss123/eventsss-main/docs/THIRD_PARTY_AUDIT.md)

[🌐 Open EPHINTA](https://ephinta-web.onrender.com/) · [🛠 API status](https://ephinta-wss.onrender.com/health) · [📦 Source repository](https://github.com/demtaiwo1-eng/Winning-game-)

</div>

---

## 🎉 What EPHINTA does

EPHINTA brings event planning and service coordination into one place. It is designed to connect the people organising an occasion with the businesses delivering it and the people checking that agreed services are completed.

| Workspace | What it is for |
|---|---|
| 🎯 **Client / organiser** | Plan events, manage budgets and tasks, coordinate guests and communicate with service providers |
| 🏪 **Vendor** | Create a business profile, manage services/listings, respond to enquiries and coordinate bookings |
| 🛡️ **Verifier** | Review assigned service checks and record completion evidence |
| 🧭 **Operations / admin** | Oversee platform operations, account roles, trust workflows and reporting |

### Core capabilities

- 🗓️ Event planning, guest/RSVP coordination, budgets, tasks and event timelines
- 🛍️ Vendor discovery, listings, enquiries and booking workflows
- 💬 Event conversations and notifications
- 💳 Wallet, payment-intent, deposit, payout and ledger workflows
- ✅ KYC, verifier assignment, service checks and event-readiness workflows
- 📱 Responsive web experience and Android application shell

Feature availability depends on account role, provider configuration, deployment status and release sign-off. A feature shown in the interface is not proof that a live payment provider or external delivery service is enabled.

## 🚀 Open the application

- **Web:** https://ephinta-web.onrender.com/
- **API health:** https://ephinta-wss.onrender.com/health
- **API readiness:** https://ephinta-wss.onrender.com/ready

The health endpoint confirms that the API process responds. The readiness endpoint checks database connectivity. Neither endpoint alone proves that every customer journey, payment, notification or payout works end to end.

## 📲 Install and run the project

### Requirements

- Node.js 20 or later (Node.js 22 is used in CI)
- npm
- PostgreSQL for API-backed local development
- Android Studio / Android SDK and a supported JDK for local Android builds

### Start the maintained application workspace

```bash
cd eventsss123/eventsss-main
npm ci
cp .env.example .env
```

Set the required local database URL and a strong development-only JWT secret in `.env`. Never commit `.env`, provider credentials, signing keys or customer data.

```bash
npm run dev
```

### Useful checks

Run these from `eventsss123/eventsss-main`:

```bash
npm run check
npm run build
npm run build:web
npm run mobile:verify
npm run ip:verify
npm run licence:inventory
```

The repository root also provides wrapper commands for the maintained workspace.

### Android package

CI currently produces a **debug/test APK** for installation testing. A debug APK is not a production-signed Play Store release. Production distribution requires the owner's Android signing key to be configured securely in GitHub Actions or the release environment; do not paste signing passwords or keystore files into chat or source control.

## 💳 Payments, fees and provider status

- The application code defines a **2% incoming transaction fee** and a **2% outgoing transaction fee**.
- NGN payment routing is intended to use OPay.
- Automated payment tests use mocked provider responses. They do not move money and do not prove a real OPay deposit, bank payout, refund or settlement.
- Cleva and Eversend require their own merchant onboarding, credentials, sandbox verification and webhook acceptance before they can be represented as live.
- Never send real money through a test workflow.

## 🔐 Paid access and account protection

EPHINTA's intended commercial model is paid access. However, the current release candidate does **not** yet demonstrate a complete, production-ready purchase-to-entitlement journey. In the inspected API, paid subscription creation fails closed with `PAID_SUBSCRIPTIONS_UNAVAILABLE` until verified payment processing is enabled. Do not advertise the whole application as purchase-locked or take payment for access until checkout, verified webhook/ledger recording, subscription activation/expiry, cancellation/refund handling, and server-side feature enforcement have all passed tests.

See the [paid-access release gap and acceptance checklist](./eventsss123/eventsss-main/docs/PAID_ACCESS_RELEASE_GAP.md).

## 🧾 Ownership, plagiarism review and third-party notices

The project is not certified plagiarism-free. The current technical review records the checks performed, exact-match searches, removed unverified assets and outstanding evidence. It is not a comparison against every public or proprietary source-code database and is not a legal opinion.

- [Source-similarity investigation report](./eventsss123/eventsss-main/docs/EPHINTA_SOURCE_SIMILARITY_AUDIT.md)
- [Third-party source and licence audit](./eventsss123/eventsss-main/docs/THIRD_PARTY_AUDIT.md)
- [Asset rights register](./eventsss123/eventsss-main/docs/ASSET_RIGHTS_REGISTER.md)
- [Contributor IP register](./eventsss123/eventsss-main/docs/CONTRIBUTOR_IP_REGISTER.md)
- [Third-party notices](./eventsss123/eventsss-main/THIRD_PARTY_NOTICES.md)
- [Project licence owner approval](./eventsss123/eventsss-main/docs/PROJECT_LICENSE_PENDING_OWNER_APPROVAL.md)

The dependency inventory recorded 750 third-party package entries across 12 licence expressions, with zero unknown metadata entries and zero missing licence texts in that CI snapshot. Some packages use official SPDX text fallback; package-specific copyright and NOTICE details still require review where noted.

**Ownership is not yet fully evidenced:** the legal rights holder is not named in the repository, and a known collaborator's contributions require a signed IP assignment or a sufficiently broad commercial licence. EPHINTA logos and avatar illustrations also need creator/licence evidence. Do not claim exclusive ownership until those records exist.

## ⚖️ Commercial and legal position

- No project-wide proprietary licence is issued until the legal rights holder and contributor chain of title are confirmed.
- Third-party libraries and services remain under their own licences and provider terms.
- The repository is currently public. A proprietary notice does not make public source code confidential. Review repository visibility and legal terms before commercial distribution.
- Obtain qualified legal advice for ownership, consumer terms, privacy, payments, refunds, taxes and jurisdiction-specific compliance.

## 🧪 Release verification

The release candidate has CI coverage for API/database checks, web builds, responsive UX, browser journeys, Android build/install smoke tests, mocked payment journeys, dependency licences and asset-rights checks. Read the workflow results and release report before relying on a specific result. Emulator tests are not physical-device certification; mocked payment tests are not real settlement evidence.

## 🤝 Contribution and change control

1. Work on a feature branch.
2. Add or update tests for the behaviour changed.
3. Preserve third-party licence and attribution notices.
4. Do not commit secrets, private agreements, customer records or signing material.
5. Open a pull request and wait for the required checks before merging.

---

<div align="center">

**EPHINTA — make every occasion easier to bring together.** ✨

</div>
