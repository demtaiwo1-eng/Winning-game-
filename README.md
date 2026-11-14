# EPHINTA

**EPHINTA** is an event-planning and service-coordination platform that connects clients and organisers with vendors and verifiers. It provides event planning, service booking, payment and wallet workflows, verification, and operational dashboards in one workspace.

- **Web app:** https://ephinta-web.onrender.com/
- **API:** https://ephinta-wss.onrender.com/
- **Full product and developer guide:** [eventsss123/eventsss-main/README.md](./eventsss123/eventsss-main/README.md)

## Install and run

Requirements: Node.js 20+ and npm. PostgreSQL is required for API-backed local development.

```bash
cd eventsss123/eventsss-main
npm ci
cp .env.example .env
# Set DATABASE_URL and a strong JWT_SECRET in .env.
npm run dev
```

The full guide explains environment setup, roles, payments, Android builds, tests, and deployment:
[Read the complete EPHINTA README](./eventsss123/eventsss-main/README.md).

## Development from repository root

After installing dependencies in `eventsss123/eventsss-main`, the root scripts delegate to that maintained workspace:

```bash
npm run dev
npm run build
npm run check
npm run mobile:verify
npm run ip:verify
```

The root package file is a command wrapper and intentionally has no separate dependency tree or lockfile. The authoritative dependency manifest and lockfile live in `eventsss123/eventsss-main`.

## Legal and third-party notices

The project-wide proprietary licence is **pending confirmation of the legal copyright holder and contributor rights**. Do not treat this repository as an open-source licence grant.

- [Third-party audit](./eventsss123/eventsss-main/docs/THIRD_PARTY_AUDIT.md)
- [Third-party notices index](./eventsss123/eventsss-main/THIRD_PARTY_NOTICES.md)
- [Asset rights register](./eventsss123/eventsss-main/docs/ASSET_RIGHTS_REGISTER.md)
- [Contributor IP register](./eventsss123/eventsss-main/docs/CONTRIBUTOR_IP_REGISTER.md)
- [Project licence owner approval](./eventsss123/eventsss-main/docs/PROJECT_LICENSE_PENDING_OWNER_APPROVAL.md)

The repository is currently public. Make it private before relying on source confidentiality or selling access to source code. See GitHub's [repository licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

## Payments and audio rights

Incoming wallet funding and outgoing bank-withdrawal fee calculations are fixed at 2% in the application. Automated payment simulations use mocked provider responses; they do not move money or certify live OPay settlement. OPay live transfers remain disabled until merchant transfer entitlement, credentials, webhook verification and sandbox bank-transfer acceptance are confirmed.

No unverified third-party recordings are bundled or selected by default. The optional music player appears only when the owner configures `VITE_EPHINTA_LICENSED_AUDIO_URL` with an HTTPS source cleared for commercial use. User consent is still required before playback.
