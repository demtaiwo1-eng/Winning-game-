# EPHINTA — Event Planning & Service Marketplace

> **Repository:** https://github.com/demtaiwo1-eng/Winning-game-  
> **Application workspace:** eventsss123/eventsss-main/  
> **Reviewed revision:** 874b7aa4d63f810f1613e7b4008bd909e5c535b4 on feat/ephinta-unified-front-end-design  
> **Status:** Source-based product and operations guide; not a production certification.

EPHINTA is a responsive event-planning workspace and service marketplace. It brings event briefs, planning tasks, guest management, vendor discovery, enquiries, checkout, wallet/escrow, identity and business verification, pre-event readiness, messages, notifications and platform operations into one application.

This guide describes the current source structure, ten end-to-end user scenarios, expected phone/tablet/desktop presentation, and the approvals, account access and provider setup required before production launch.

---

## 1. Product overview

### User roles

| Role | Purpose | Workspace |
|---|---|---|
| Event Planner (CLIENT) | Create and manage events | Executive Planner |
| Organizer (ORGANIZATION) | Choose event planning or service-provider mode | Planner or Vendor workspace |
| Vendor (VENDOR) | Manage business profile, listings, availability and enquiries | Vendor command centre |
| Growth Partner (AFFILIATE) | Refer customers and vendors | Affiliate workspace |
| Verifier (VERIFIER) | Confirm booked services before event time | Readiness workspace |
| Consultant (CONSULTANT) | Support permitted operations and verification review | Operations workspace |
| Platform Admin (ADMIN) | Moderate listings, finance and approvals | Platform operations |

Public self-registration is intended for Event Planner, Organizer and Vendor. Verifier, Consultant and Admin are privileged operational roles. The owner must authorize and provision these accounts; do not make privileged roles publicly self-assignable. The legacy Rider role is retired.

### Main capabilities found in source

- Public landing page and five-step event brief builder.
- Three-step account registration, sign-in, password reset and role-based routing.
- Organization mode selection: event planning or service provider.
- Event creation, planning answers, task/checklist management and budget items.
- Guest list, public RSVP links and guest check-in.
- Marketplace search, listing details and customer enquiries.
- Cart and checkout sessions, wallet funding, ledger and escrow-related controls.
- Vendor profile, service catalogue, listing edit/delete and availability management.
- Country-specific KYC document catalogues and private document storage integration.
- Verifier assignment, event readiness checks, deadlines and completion controls.
- Event messages, in-app notifications and notification preferences.
- Affiliate referral links and referral-code prefill during signup.
- Plans, subscriptions and promotions.
- Admin listing moderation, finance feeds, reconciliation exceptions and maker/checker approvals.
- Offline draft/eligible edit storage and replay after connectivity returns.
- Android Capacitor shell and a web-layer update mechanism.

Source presence does not mean that every provider is configured or every production workflow is certified.

## 2. The complete customer journey

1. **Discover EPHINTA:** visitor opens the landing page and chooses Start planning, Sign in or a role-specific entry.
2. **Build an event brief:** collect event name/type, objective, location/date, guest count, food direction, budget and atmosphere. Progress is saved locally on the device.
3. **Create an account:** register as Event Planner or Organizer. The saved brief is carried into the account flow and imported into the authenticated workspace.
4. **Plan the event:** review event details, planning answers, checklist, tasks and budget.
5. **Discover services:** search active marketplace listings and send enquiries to vendors.
6. **Prepare checkout:** choose an event and add eligible listings to a cart. The API requires an event owned by the customer, active listings, verified vendors, matching currency and a selected lead verifier.
7. **Pay and track:** checkout sessions currently expose wallet payment. Wallet deposits can use configured payment providers; settlement must be confirmed by server-side provider verification/webhooks, never by trusting a browser return page.
8. **Coordinate:** customer and vendor use permitted messages, notifications and booking information.
9. **Prepare for event day:** event owner selects a lead verifier. Readiness checks are synced from paid bookings. The readiness window opens six hours before event start; all services should be GREEN by two hours before start.
10. **Complete and reconcile:** assigned verifier can finalize an eligible completed event. Escrow remains protected until the permitted release workflow is completed.

### Checkout conditions

- Cart must contain at least one eligible listing.
- Customer must select an event they own.
- Completed/cancelled events cannot be used for new checkout.
- Listings must remain active and vendors must be verified.
- Items in one cart must use the same currency.
- A lead verifier must already be selected.
- Checkout currently advertises wallet as its payment method. External provider wallet funding is a separate payment-intent journey.
- Never promise booking, settlement, withdrawal, refund or escrow release until the server confirms the verified result.

---

## 3. Ten case studies with responsive presentation

These are practical scenarios mapped to the current source. The layouts describe intended responsive behavior; they are not screenshots or proof that every viewport has passed physical-device usability testing.

### Case study 1 — Wedding or milestone event

**Scenario:** A customer visits without an account, creates an event brief, signs up and resumes planning.

**Journey:** Landing page → guided brief → review → signup → import brief → Executive Planner → checklist, budget and event workspace.

| Phone (360–767 px) | Tablet (768–1023 px) | Desktop (1024 px+) |
|---|---|---|
| One-column wizard, large fields, sticky Back/Next, scrollable review | Centered wizard; two-column fields where suitable | Wide planning surface; summary and form can sit side-by-side |

**Success evidence:** Event appears in the signed-in user's event list and is no longer only a local draft.

**Owner approval:** Event data fields, privacy notice, retention period and customer terms.

### Case study 2 — Corporate team creates an organization workspace

**Scenario:** An organization registers and chooses to plan/manage events.

**Journey:** Role chooser → Organizer registration → Plan and manage events → account creation → Executive Planner → create and coordinate company events.

| Phone | Tablet | Desktop |
|---|---|---|
| Single-column role/mode choice and account form | Centered mode card and two-column planner panels | Event overview, budgets and task panels visible together |

**Success evidence:** Account is ORGANIZATION with EVENT_PLANNING mode and opens the planner workspace.

**Owner approval:** Team invitations, company verification, multi-user access and staff permissions before corporate rollout.

### Case study 3 — Service-provider organization joins

**Scenario:** Venue group, caterer or production business registers as a service-provider organization.

**Journey:** Organizer registration → Provide services to event planners → business details → vendor workspace → business KYC → draft listings → admin review/activation.

| Phone | Tablet | Desktop |
|---|---|---|
| Business details stacked; uploads full-width | Two-column business form and listing cards | Business profile beside catalogue grid |

**Success evidence:** Organization receives a vendor profile and vendor-scoped access.

**Owner approval:** KYB evidence list, accepted company documents, beneficial-owner checks and country-specific verification standard.

### Case study 4 — Vendor creates a package and handles enquiries

**Scenario:** Caterer creates a service package, sets availability and replies to customer enquiries.

**Journey:** Vendor signup → profile → business KYC → add package → save draft → verification/moderation → active listing → availability → enquiry reply.

| Phone | Tablet | Desktop |
|---|---|---|
| Single-column package form; stacked cards and availability | Two-column form/cards; enquiry panel below | Catalogue grid, request table and enquiry panel |

**Success evidence:** Listing is stored under authenticated vendor; availability and enquiry replies use API endpoints.

**Known boundary:** Vendor event-gig summary is not yet a complete server-backed booking management workflow. A local status label is not a booking confirmation.

**Owner approval:** Vendor terms, service quality rules, cancellation/refund policy and listing activation requirements.

### Case study 5 — Customer discovers a vendor and requests a booking

**Scenario:** Customer filters active services by keyword, city, category, type and currency, then contacts a vendor.

**Journey:** Customer dashboard → Marketplace → listing detail → enquiry → vendor response → cart → choose owned event → select lead verifier → checkout.

| Phone | Tablet | Desktop |
|---|---|---|
| Search/filter controls stack or scroll; one-column results | Two-column results and compact filters | Filter/sidebar area and multi-column results |

**Success evidence:** Marketplace returns ACTIVE listings; enquiry is associated with the signed-in customer and selected listing.

**Owner approval:** Ranking rules, review moderation, dispute route, cancellation terms and whether vendor acceptance is required before payment.

### Case study 6 — Wallet funding and checkout

**Scenario:** Customer funds a wallet using a configured provider, then uses wallet balance for a service checkout.

**Journey:** Wallet → deposit intent → provider-hosted checkout → signed webhook → server-to-server verification → ledger credit → cart → checkout session → wallet payment → booking/escrow state.

| Phone | Tablet | Desktop |
|---|---|---|
| Stacked wallet summary and transaction rows; clear pending/success/error state | Summary cards and contained scrollable ledger | Wallet balances, ledger, payment history and checkout summary in separate panels |

**Success evidence:** API verifies provider reference, amount and currency, processes webhook idempotently and records ledger entries. Browser redirect alone is not proof of payment.

**Known boundaries:** Checkout currently exposes WALLET. Wallet deposit route supports NGN/GHS. OPay adapter currently points to sandbox/test endpoints. Stripe checkout is not enabled. Payout initiation must remain disabled until onboarding, destination validation and reconciliation controls are complete.

**Owner approval:** Merchant of record, countries/currencies, platform fee, provider selection, settlement account, refunds/chargebacks, payout policy and live-mode activation.

### Case study 7 — Guest RSVP and event-day check-in

**Scenario:** Event owner adds guests and shares RSVP links. Guests respond and an operator checks them in.

**Journey:** Event workspace → guest list → invite → public RSVP token page → RSVP response → check-in → check-in history.

| Phone | Tablet | Desktop |
|---|---|---|
| Single-column RSVP form; large lookup/check-in controls | Guest list and RSVP status in card/table hybrid | Guest table, bulk operations and check-in history side-by-side |

**Success evidence:** RSVP token maps to correct guest; check-in is stored server-side and duplicate check-ins are handled.

**Owner approval:** Guest privacy notice, invitation wording, permitted guest data, QR/token lifetime, staff permissions and deletion schedule.

### Case study 8 — Verifier confirms readiness

**Scenario:** Lead verifier is assigned and checks booked services before event time.

**Journey:** Owner selects verifier → verifier opens assigned event → readiness board syncs paid bookings → checks marked GREEN/AMBER/RED with notes → owner receives in-app status → eligible completion is finalized.

| Phone | Tablet | Desktop |
|---|---|---|
| Traffic-light cards stack; countdown and actions prominent | Two-column service checks with deadline summary | Readiness dashboard with timeline, service checklist and notes |

**Business rules:** Readiness window opens at T-6 hours. GREEN is blocked before the window opens. Target is all GREEN by T-2 hours. Verifier must be assigned; event owner selects lead verifier. Finalization does not automatically release escrow.

**Owner approval:** Verifier recruitment, background checks, geographic coverage, service levels, evidence standards, escalation and compensation.

### Case study 9 — Affiliate refers a customer

**Scenario:** Growth partner shares a referral link and customer registers using its code.

**Journey:** Affiliate workspace → enter referral code → copy link → customer opens link → signup → referral code is prefilled.

| Phone | Tablet | Desktop |
|---|---|---|
| Referral code and copy action stacked; manual-copy fallback | Compact partner panel and link card | Partner dashboard and referral programme information |

**Success evidence:** Clipboard copy is attempted, manual fallback is available, and referral parameter is prefilled in signup.

**Known boundary:** Link generation and signup prefill do not prove commission attribution, payout or tax handling is complete.

**Owner approval:** Affiliate agreement, commission, attribution window, eligible conversion, reversals, fraud controls, payout threshold and tax/KYC requirements.

### Case study 10 — Consultant and administrator operate the platform

**Scenario:** Authorized consultant reviews KYC/readiness work; administrator moderates listings, monitors finance exceptions and processes approvals.

**Journey:** Owner provisions privileged account → Consultant reviews permitted operational/KYC work; Admin reviews overview, listings, payment intents, ledger, reconciliation exceptions and maker/checker approvals.

| Phone | Tablet | Desktop |
|---|---|---|
| Review queues and summaries stack; sensitive actions need confirmation | Summary cards, contained tables and approval panel | Finance/reconciliation tables, audit context and approval workflow in multi-panel workspace |

**Success evidence:** Privileged APIs enforce roles; approvals are audited; requester cannot approve own request; finance feeds do not mutate ledger balances.

**Owner approval:** Named admin, least-privilege roles, maker/checker separation, approval limits, reconciliation escalation, incident contacts and audit retention.

---

## 4. Responsive design specification

Current shared styles establish these practical layout rules:

| Viewport | Intended layout |
|---|---|
| Phone: 360–767 px | Single-column forms/panels; compact navigation; horizontally scrollable dashboard tabs; large touch targets; safe-area-aware modals; tables contained in horizontal scroll regions |
| Tablet: 768–1023 px | Fluid centered content; two-column forms where suitable; adaptive card grids; contained tables; navigation may wrap or scroll |
| Desktop: 1024 px+ | Content up to about 1460 px; multi-column dashboards; wider catalogue grids and tables; side-by-side summary panels |

### Acceptance viewport sizes

- Small phone: 360 × 800
- Common phone: 390 × 844
- Large phone: 430 × 932
- Tablet portrait: 768 × 1024
- Tablet landscape: 1024 × 768
- Laptop: 1366 × 768
- Desktop: 1440 × 900

### Every journey must pass

- No page-level horizontal overflow.
- No hidden Back, Next, Save, Continue or Submit control.
- No oversized logo/hero image on phone.
- Dialogs/forms scroll without trapping the user.
- Sticky headers do not cover focused controls or headings.
- Touch targets are comfortable; keyboard focus is visible.
- Loading, empty, success, error and offline states are distinct.
- Tables scroll inside their own container; the page itself does not become wider than viewport.
- Long names, amounts and dates wrap without overlapping actions.
- Identity/payment data is never exposed in screenshots, logs or analytics.

Mobile role regression coverage exists in Playwright. The complete ten-case screenshot/tap-through matrix for phone, tablet and desktop still needs to be run. Do not describe all viewports as physically verified until evidence is recorded.

---

## 5. Owner acknowledgements, permissions and external contacts

No named application owner, owner email address or direct contact address is declared in the reviewed source. I have not invented a person's email. The owner should nominate the responsible person for each item and make introductions through official provider account portals or existing account representatives.

### Priority 0 — required before real public production launch

| Contact / owner | Required approval or access | Why | Evidence |
|---|---|---|---|
| **Application/business owner** | Legal operating entity, trading name, responsible director, business address, support contact, countries served and launch authority | Establishes accountable operator | Written owner sign-off and approved business details |
| **Legal/privacy counsel** | Terms, privacy notice, cookie/analytics notice, KYC consent, guest-data notice, retention/deletion, cross-border transfers, processor agreements, refund/cancellation and complaints process | App handles accounts, identity documents, event/guest data, messages and payment metadata | Approved and published legal documents; named privacy contact |
| **Payment merchant owner and provider account teams** | Merchant onboarding, settlement account, countries/currencies, live credentials, webhook setup, fees, refunds/disputes and payout policy | Real transactions require active merchant accounts and correct production setup | Provider approval, secret-manager configuration, signed webhook tests and reconciliation |
| **Database/storage owner (Neon)** | Approve production project/branch, database access, private KYC bucket, branch-scoped S3 credentials, retention and backup policy | KYC upload fails closed without private storage; production data needs durable backups | Production bucket, authorized upload/download test and restore drill |
| **Identity/KYC provider owner** | Contract/account approval, API URL/key, country/document coverage, hosted-flow terms, webhook signing, DPA and retention/deletion terms | Veriff session start exists, but signed decision webhook and automated decision mapping are not complete | Provider contract, sandbox, webhook specification and end-to-end tests |
| **Hosting/domain owner (Render + DNS)** | Grant Render GitHub App access; approve API/static-site/database services, production domains, TLS, CORS, environment variables and service tier | Required for stable public hosting | Approved service inventory, verified DNS/TLS, health/readiness and backup proof |

### Priority 1 — required before enabling each feature

| Contact | Owner action | Current source boundary |
|---|---|---|
| **Email provider/domain administrator** | SMTP credentials, verified sender, SPF/DKIM/DMARC and email branding | SMTP is used for password reset. Signup email verification and broad transactional email are not evidenced as complete |
| **Firebase/FCM and Apple push owners** | App credentials, push services, permission/privacy text and delivery tests | Device token registration is optional; server returns PUSH_PROVIDER_NOT_CONFIGURED for test push |
| **Google Play Console owner** | Developer account, app listing, privacy/data safety, signing custody, closed testing and release permissions | Android build pipeline exists; production signing/store release require owner-held access |
| **Apple Developer owner** | Membership, bundle ID, certificates/profiles, App Store Connect listing and iOS test devices | Capacitor iOS dependencies exist; this review does not claim an iOS build/store release passed |
| **Affiliate programme owner/finance** | Commission, attribution, payout threshold, reversal, tax and partner conduct rules | Referral link/signup prefill exist; full commission/payout ledger needs separate validation |
| **Verifier operations owner** | Eligibility, background screening, coverage, training, compensation, evidence and escalation | Assignment/readiness rules exist; recruitment and field operations are external |
| **Advertising owner / Google AdMob** | Account, app/ad-unit IDs, consent design, test IDs and policy review | Production native AdMob is not enabled; do not use guessed IDs |
| **Customer support owner** | Monitored email/phone, response SLA, escalation, complaint/dispute handling | In-app messages/notifications do not establish a staffed support operation |

### Provider-specific notes

- **Paystack:** obtain production merchant approval and server-side secret key from the merchant account. Configure webhook to /api/v1/payments/webhooks/paystack. Confirm NGN/GHS and settlement capabilities with Paystack.
- **Flutterwave:** obtain approved live credentials and configure /api/v1/payments/webhooks/flutterwave. Confirm country/currency and settlement arrangements.
- **OPay:** current adapter uses sandbox/test cashier and status endpoints. Obtain OPay's written confirmation of production API base, credentials, merchant account, callback format and webhook setup. Do not just swap URLs without provider validation and tests.
- **Stripe:** credentials and webhook verification are represented, but provider-selection code explicitly reports Stripe checkout is not enabled. Do not advertise Stripe as working until adapter completion and tests.
- **Veriff:** hosted identity session start exists when VERIFF_API_URL and VERIFF_API_KEY are supplied. Signed decision webhook, replay protection, decision mapping and automated account status update remain required before automated live KYC decisions.
- **Neon private storage:** API expects AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION and KYC_STORAGE_BUCKET. Obtain values from the correct production branch; never put them in frontend variables or Git.
- **SMTP:** configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM on API only. Verify sender-domain ownership and DNS records.

### Permissions never to grant casually

- Never share payment keys, database URLs, KYC storage credentials, JWT secrets, signing keys or webhook secrets in chat, source files, screenshots or tickets.
- Do not grant Admin/Consultant access to unvetted people. Require named accounts, MFA and least privilege.
- Do not let an administrator create and approve their own sensitive approval request; maker/checker separation is enforced by the approval API.
- Do not expose identity documents to support staff without a documented task, legal basis and least-privilege access.
- Do not enable live payments, automated KYC approval, advertising or push delivery until the relevant provider and legal owner sign off.

---

## 6. Environment configuration

Example environment files are templates, not credentials. Store production values in the hosting platform's secret manager.

### API core variables

| Variable | Purpose |
|---|---|
| NODE_ENV | development, test or production |
| PORT | API listener port |
| DATABASE_URL | PostgreSQL connection string |
| JWT_SECRET | Server-side signing secret; minimum 32 characters |
| ACCESS_TTL_MIN / REFRESH_TTL_DAYS | Session lifetime |
| CORS_ORIGINS | Exact allowed web/native origins |
| APP_BASE_URL | Customer-facing application base URL |
| API_BASE_URL | Public API base for callbacks where configured |
| COMMISSION_BPS | Platform fee in basis points; example default is 500 (5%) |
| DEFAULT_CURRENCY | Default ISO currency |

Optional provider variables:

- SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
- Paystack: PAYSTACK_SECRET_KEY
- Flutterwave: FLUTTERWAVE_SECRET_KEY
- Stripe: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- OPay: OPAY_MERCHANT_ID, OPAY_PUBLIC_KEY, OPAY_SECRET_KEY
- Payment mode: PAYMENT_MODE=test|live
- Veriff: VERIFF_API_URL, VERIFF_API_KEY
- Private KYC storage: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION, KYC_STORAGE_BUCKET

### Web build variables

- VITE_API_URL — full HTTPS API base ending in /api/v1 for production.
- VITE_ENABLE_PUSH — optional native push-registration toggle; it does not configure a push sender.
- VITE_UPDATE_URL — update-proxy base used by native web-layer updater when injected by release workflow.
- Optional AdMob variables are documented in apps/web/.env.example; do not enable without owner-supplied IDs and consent approval.

**Never use a VITE_ variable for a secret.** Vite variables are bundled into browser/native web assets and are public to app users.

---

## 7. Architecture and repository map

The repository is a monorepo. Application code is nested under eventsss123/eventsss-main/.

| Path | Responsibility |
|---|---|
| apps/web/src/main.tsx | Active React entry point |
| apps/web/src/EnterpriseApp.tsx | Active app shell, auth, role portals and route composition |
| apps/web/src/components/ | Event planner, marketplace, wallet, KYC, guest, RSVP, readiness and messaging components |
| apps/web/src/lib/api.ts | API client |
| apps/web/src/lib/appRoutes.ts | Canonical routes and legacy redirects |
| apps/web/src/lib/offline/ | Offline store, outbox and replay |
| apps/web/src/lib/liveUpdate.ts | Native shell web-layer updater |
| apps/web/src/enterprise.css | Active dashboard styles |
| apps/web/src/styles/ | Registration and shared design system |
| apps/api/src/app.ts | Express API, middleware and route mounting |
| apps/api/src/modules/ | Auth, events, marketplace, checkout, wallet, payments, KYC, billing, readiness, notifications and admin APIs |
| apps/api/prisma/schema.prisma | PostgreSQL data model |
| apps/mobile/ | Capacitor Android/iOS shell |
| docs/ | Deployment, security, provider, KYC and release runbooks |
| .github/workflows/ | CI, browser tests, web builds and APK release automation |

### Main web routes

- / — landing page
- /plan — guided event builder
- /auth/:mode — authentication
- /reset-password — password reset
- /rsvp/:token — guest RSVP
- /dashboard/:role — canonical role workspace

Legacy /app/* paths redirect to canonical dashboards. Unauthenticated dashboard access redirects to sign-in. Signed-in users are redirected away from a different role's dashboard.

### Main API groups

Mounted under /api/v1:

- /auth — register, login, refresh, logout, current user, password reset and security history
- /events — event, plan-answer, guest, task and budget resources
- /rsvp — token-based guest RSVP
- /marketplace — active listings, categories, details, enquiries and reviews
- /checkout — cart and checkout sessions
- /wallet — wallet balances, ledger and permitted wallet operations
- /payments — payment intents, demo checkout, provider webhooks and reconciliation
- /kyc — country matrix, submission, document retrieval and review
- /readiness — event readiness, verifier assignment, checks and completion
- /notifications — inbox, preferences and device token management
- /billing — plans, subscriptions and promotions
- /admin — moderation, finance, reconciliation and approval controls
- /app-updates — version manifest and web-bundle update proxy

Vendor-specific endpoints are mounted directly in apps/api/src/app.ts under /api/v1/vendor.

---

## 8. Local development

Requirements: Node.js 20+, npm and PostgreSQL for full API/database workflows.

From the application workspace:

    cd eventsss123/eventsss-main
    npm ci

Create an ignored local API environment file using apps/api/.env.example as the template. At minimum configure a reachable DATABASE_URL and a unique JWT_SECRET of at least 32 characters. Do not commit .env files.

Run the safe startup command:

    npm run dev

Documented local endpoints:

- Web app: http://localhost:5173/
- API health: http://localhost:5000/health
- API readiness: http://localhost:5000/ready

Useful commands:

    npm run check -w apps/api
    npm run test -w apps/web
    npm run build -w apps/web
    npm run build -w apps/api
    npm run check
    npm run mobile:sync
    npm run mobile:build
    npm run mobile:verify

For browser journeys, use the Playwright configuration under apps/web, install the configured browser, then run:

    npm run test:e2e -w apps/web

---

## 9. Deployment and mobile updates

### Web/API deployment

The documented hosting design uses Render Web Service for the Express API, Render Static Site for the React/Vite frontend, and managed PostgreSQL. An optional Supabase Edge Function can act as an API gateway; it is not required to host the API/database.

Follow docs/DEPLOY.md. Confirm /health and /ready before treating a deployment as ready. The web build must use the correct production VITE_API_URL and API CORS must allow the exact frontend origin.

### Android and OTA updates

The native app uses Capacitor package ID com.ephinta.app. CapacitorUpdater.autoUpdate is false in the current config; the application also has custom update logic in apps/web/src/lib/liveUpdate.ts that checks the configured update manifest and downloads web bundles when running inside the native shell.

- Web-layer changes can be delivered as a verified OTA bundle when the release workflow, proxy, manifest and updater are correctly configured.
- Native changes (Android/iOS code, plugin versions, permissions, app identity, signing or native SDKs) require a new APK/IPA and install/store update.
- A successful APK build is not proof of physical-phone installation.
- An OTA bundle does not deliver native plugin or permission changes.

Follow docs/ANDROID.md and docs/ANDROID_DEVICE_TEST.md. Physical-device file upload, camera, push, background and Android back-button behavior must be tested on supported hardware.

### Release gate

1. Review PR diff and obtain owner approval.
2. Confirm CI on exact release commit.
3. Review Prisma migrations and take a verified database backup.
4. Test restore to a non-production database.
5. Configure secrets in the correct environment.
6. Test staging login, role access, event creation, KYC, checkout test mode, signed webhooks, ledger, offline sync and notifications.
7. Verify Android APK signature and installation on physical devices.
8. Deploy immutable build and run health/readiness smoke tests.
9. Monitor API logs and provider dashboards.
10. Record release owner, revision, artifact checksum, migration status and rollback reference.

Never run destructive database cleanup as a release shortcut.

---

## 10. Security, privacy and financial controls

- Passwords are hashed server-side; refresh tokens are stored as hashes and rotated.
- Authentication and privileged API routes are role-protected.
- User-owned event, guest, notification and wallet resources must remain owner-scoped.
- KYC documents stay in private storage and are served through authenticated authorization checks.
- Never log identity documents, passwords, access/refresh tokens, provider keys, bank credentials or card security codes.
- Provider webhooks must be signature-verified and idempotent; settlement is verified server-to-server.
- Customer UI cannot be trusted as proof of payment.
- Wallet balances are derived from ledger entries; manual database balance edits are prohibited.
- Admin finance feeds are read-only. Sensitive approvals require a different authorized approver from the requester.
- Do not release escrow solely because an event is marked complete; follow the explicit booking/escrow policy.
- Use the PCI readiness questionnaire with the acquiring bank/provider and a qualified adviser. This README is not PCI certification.
- Obtain legal review for Nigerian data-protection requirements and each other country served. Do not assume one country's policy covers international users.

---

## 11. Known limitations and launch blockers

1. Payment credentials and merchant approvals are owner-supplied. OPay adapter currently targets sandbox endpoints. Stripe checkout is not enabled. Wallet checkout is distinct from external wallet funding.
2. KYC country/document rules and private storage support exist; a Veriff hosted-session adapter exists. Signed decision webhook handling and automated decision lifecycle are still required.
3. Production Neon/S3-compatible storage credentials must be configured in the API secret manager and verified against the correct branch.
4. SMTP supports password-reset email. Account email verification and broad transactional email are not evidenced as complete.
5. Push device token registration exists, but FCM/APNs sending credentials are not configured; test push explicitly returns not configured.
6. Referral link generation/signup prefill exist; complete commission attribution, tax, payout and reversal workflows need separate validation.
7. Vendor listing, availability and enquiry APIs exist; vendor event-gig summary is not a complete booking lifecycle workflow.
8. Privileged Admin/Consultant/Verifier roles need owner-controlled provisioning and least-privilege review.
9. Native AdMob requires owner account IDs, consent implementation and supported native integration; keep off until approved.
10. Web bundles and APKs have separate delivery requirements. Physical Android testing and iOS certification are separate from CI builds.
11. Mobile role regression exists, but the full ten-case journey matrix across phone/tablet/desktop needs screenshot/tap-through evidence.
12. Published support contact, terms, privacy, retention, incident handling and dispute processes must be supplied and staffed by the owner.

Historical plans/reports contain point-in-time results. A historical pass is not proof that the current feature branch or production deployment passed.

---

## 12. Owner sign-off checklist

Assign a named owner and evidence link to every item.

- [ ] Legal operating entity and accountable application owner confirmed.
- [ ] Public domain and support contact approved.
- [ ] Terms, privacy, cookie, KYC and guest-data notices approved.
- [ ] Data controller/processor responsibilities, retention and deletion policy approved.
- [ ] Render, GitHub and DNS access granted to minimum required team.
- [ ] Production database/private KYC storage provisioned; backup and restore verified.
- [ ] KYC provider contract, country coverage and decision webhook tests approved.
- [ ] Paystack/Flutterwave/OPay merchant approvals and production webhooks tested; Stripe remains disabled until complete.
- [ ] Platform commission and vendor/affiliate fee policy approved.
- [ ] SMTP sender authenticated and password-reset delivery tested.
- [ ] Push delivery configured or push left disabled.
- [ ] Admin, Consultant and Verifier accounts provisioned with least privilege and MFA.
- [ ] Vendor, customer, verifier and affiliate terms approved.
- [ ] Guest RSVP/check-in privacy and event-day access rules approved.
- [ ] Google Play signing, listing and release permissions approved.
- [ ] Apple Developer signing and App Store access approved if iOS is in scope.
- [ ] AdMob approval and consent completed if advertising is in scope.
- [ ] Phone/tablet/desktop screenshots and tap-through tests completed for all ten case studies.
- [ ] API/web/DB/browser/Android checks pass on exact release revision.
- [ ] Physical-device installation and real provider sandbox tests recorded.
- [ ] Production launch explicitly authorized by accountable owner.

---

## 13. Supporting documentation

- Development setup: docs/DEVELOPMENT.md
- Render deployment: docs/DEPLOY.md
- Android and OTA process: docs/ANDROID.md
- Android device test: docs/ANDROID_DEVICE_TEST.md
- KYC provider research: docs/KYC_PROVIDER_RESEARCH.md
- Private KYC storage: docs/KYC_STORAGE_SETUP.md
- Payment test mode/webhooks: docs/PAYMENTS-TEST.md
- PCI readiness questionnaire: docs/security/PCI-DSS-readiness-questionnaire.md
- Operations runbook: docs/PHASE9-OPERATIONS-RUNBOOK.md
- Release verification tracker: docs/RELEASE_VERIFICATION_TRACKER_2026-11-02.md
- Organization modes and Consultant: docs/REPORT-ORGANIZATION-MODES-CONSULTANT.md
- Full improvement roadmap: docs/EPHINTA_FULL_IMPROVEMENT_ROADMAP.md

---

## 14. Owner/provider approval request template

**Subject: EPHINTA production-readiness approvals and provider onboarding**

Hello [Owner/Provider Representative],

We are preparing EPHINTA, an event-planning and service marketplace with customer, organizer, vendor, affiliate, verifier and platform-operations workspaces.

Before enabling the relevant production features, please confirm:

1. The legal entity and person accountable for the application and customer data.
2. Approval of public terms, privacy/KYC notices, retention and support arrangements.
3. The approved payment merchant account, settlement details, countries/currencies, fees, refunds and webhook configuration.
4. The approved identity-verification provider, supported country/document matrix, contract and webhook decision process.
5. The production hosting, database and private document-storage accounts and named administrators.
6. The authorized people for Admin, Consultant and Verifier access.
7. The approved launch domain, customer-support contact and production release authority.

Please provide access through the provider's official team invitation or secret manager. Do not send passwords, API keys, signing keys or database credentials by ordinary email.

Kindly reply with the responsible contact, approved scope, any conditions and the evidence/documents required before launch.

Regards,  
EPHINTA Project Team

---

*Prepared from review of the active React entry point, role portals, API route modules, Prisma application structure, environment templates, Capacitor configuration and operational documentation at the revision stated above. Recheck the branch before relying on this guide for a later release.*
