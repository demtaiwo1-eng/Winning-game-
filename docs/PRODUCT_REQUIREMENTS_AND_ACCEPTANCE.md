# EPHINTA product requirements and acceptance baseline

**Status:** Working product baseline compiled from the current `main` source tree, Prisma data model, workspace scripts, CI workflows and previously approved product decisions. This is a requirements and audit baseline, not a claim that every item is implemented or production-ready.

## 1. Product purpose

EPHINTA is a multi-sided event-planning and entertainment-services platform. It should let people plan and deliver events while connecting them to discoverable service providers, venues, goods, payments, communications and operational assurance. It must work responsively on desktop, tablet and mobile web, with Android and iOS shells where platform support exists.

## 2. Personas and permissions

| Persona | Primary job | Required capabilities |
| --- | --- | --- |
| Client / event planner | Plan and deliver personal or professional events | Create events, budget, tasks, guests/RSVPs, discover/book services, pay deposits and balances, message participants, monitor readiness |
| Organization / organizer | Coordinate events and teams | Organization profile, team/workspace operations, event coordination and role-appropriate access |
| Vendor / service provider | Sell venues, goods or services | Business profile, listings, availability, enquiries, bookings, payment requests, KYC, fulfilment and payout visibility |
| Affiliate / growth partner | Refer users and eligible rights-holder relationships | Referral tracking and transparent statements for approved programmes |
| Verifier | Confirm readiness of booked services | Assigned event/service checklist, evidence, status, timestamps and audit history |
| Consultant | Support assigned event operations | Scoped workspace, assigned work, progress and communication |
| Administrator | Operate platform and marketplace | User/role administration, verification review, platform configuration, payments oversight, catalogue and audit visibility |
| Guest / invitee | Participate in an event | Invitation/RSVP, event-specific information and permitted messaging/check-in |

Authorization must be enforced by the API for every protected operation. Hiding a button is not authorization.

## 3. Functional domains

### 3.1 Identity, registration and sessions
- Role-aware registration with clear, compact mobile layouts, visible back/continue navigation and field-level validation.
- Sign-in, sign-out, refresh-token lifecycle, forgot/reset password and understandable wrong-password/duplicate-account/disabled-account/rate-limit/server-error messages.
- Secure password hashing, token revocation, email/phone uniqueness and account status handling.
- Device-security gate and optional biometric capability where supported.
- No account enumeration through overly specific public error messages beyond the approved UX needs.

**Acceptance:** new users can register once; duplicate email/phone is handled clearly; wrong password never crashes or traps the user; password reset is token-expiring and single-use; refresh/logout revokes sessions; protected routes and API endpoints reject unauthorised roles.

### 3.2 Event planning and operations
- Create personal, corporate, social, sports, cultural, religious, political, entertainment, educational and virtual events.
- Store dates, location, expected guests, format, scale, budget, currency, special requests and event series relationships where relevant.
- Manage event tasks with tiers and statuses; track planned versus actual budget.
- Manage guest lists, plus-ones, RSVPs, invitation links and guest check-in where enabled.
- Show event readiness and service status (pending/green/amber/red), assigned verifier and evidence.
- Allow planners to communicate with individuals and groups tied to the event.
- Support deposits and payment milestones reflected in the event and wallet/ledger.

**Acceptance journeys:**
1. Planner registers/signs in → creates event → sets budget/date/location → adds guests/tasks → discovers and books a provider → pays a sandbox deposit → sees the deposit and ledger entry reflected consistently in event and dashboard.
2. Planner messages one participant and a group → recipients see the correct event-scoped conversation and notification → access is denied to unrelated users.
3. Event reaches readiness review → verifier records service checks with timestamps/evidence → planner sees accurate overall readiness and outstanding risks.

### 3.3 Marketplace and vendor operations
- Browse/filter venues, goods and services by category and location.
- Vendor profile, storefront/shop, listing lifecycle (draft/active/paused/archived), price/currency, images/media and availability.
- Enquiries, vendor responses, booking, cancellation, reviews and promotions.
- KYC identity/business submission and review status.
- Vendor payment requests for essential goods/services and staged/part payments where the business rules permit.
- Clear booking fulfilment state and dispute/refund path.

**Acceptance journey:** vendor registers → creates business profile and listings → submits business KYC → receives planner enquiry/booking → requests an allowed deposit or part-payment → planner pays in sandbox → vendor sees the correct payment status → fulfilment is confirmed and audited.

### 3.4 Wallet, ledger and payments
- Currency-aware wallet and immutable/auditable ledger entries.
- Collection, payout, refund, booking deposits, escrow hold/release/refund, commissions and subscriptions as applicable.
- Store money in integer minor units and an ISO currency code.
- Provider adapter boundaries, idempotency keys, webhook signature validation, replay protection, status reconciliation and clear failure states.
- OPay is the first provider to validate. Eversend and Cleva remain future/integration candidates until account status, current API contract, credentials and sandbox evidence are confirmed.
- Sandbox by default. Credentials are deployment secrets; no credentials in source, logs, issues or chat.
- FX must show source, quote, rate timestamp, fees and final amount before confirmation; do not imply a live FX rate when no provider is configured.

**Acceptance:** duplicate webhooks cannot double-credit; a payment intent and ledger entry reconcile; failed/pending payments remain distinguishable; refunds and payouts are idempotent; balances are derived from ledger-consistent records; cross-currency operations never silently mix currencies. Mock tests are labelled as mock tests.

### 3.5 Messaging and notifications
- Event-scoped direct and group conversations.
- In-app notification centre, read/unread state and relevant event/payment updates.
- Native push registration/unregistration only when permission is granted and provider configuration exists.
- Graceful fallback when push/email is unavailable; no false “sent” state when delivery is not confirmed.

### 3.6 Global entertainment business catalogue
- Directory concept for entertainment-sector businesses across regions and categories, with profile, description, services, contact channels, location, opening hours, media, verification and enquiry/booking paths.
- Synthetic seed set target: 2,000 distinct test businesses worldwide, with rich fields and sample imagery for dashboard/demo evaluation.
- Synthetic entries must be clearly labelled as synthetic; use reserved `.example` domains, test-only phone identifiers, fictional addresses and non-real coordinates. Never imply these are actual businesses or expose them as production listings.
- Search/filter by category, country/region/city and service type; provide responsive business cards, detail panel and global coverage visualization.

### 3.7 Music experience and DSP administration
- Responsive player/experience with explicit user permission/gesture before playback; do not autoplay audio unexpectedly.
- Playback telemetry must distinguish plays, qualified usage duration and repeat/fraud signals.
- Rights-holder portal: repertoire/track metadata, rights-owner identity, territory/term, split percentages, usage reports, statements, disputes and payout status.
- User-approved commercial model: 30% of eligible song revenue allocated to the relevant rights owner(s), based on validated play/usage-time attribution; the remaining allocation and platform deductions must be explicit in the governing contract/accounting policy.
- The user has stated they hold commercial rights to repository music; that statement is not a substitute for track-by-track documentation, contributor/performer/publisher clearances, territory/term scope or legal review.
- Advertising/sponsorship revenue attribution must be auditable and not double-counted.

**Acceptance:** each eligible play maps to a track, timestamp, duration and rights split version; statements reconcile to the revenue pool; unverified rights or disputed tracks are held from payout; no royalty amount is described as legally owed until validated by the approved rights policy.

### 3.8 Experience, design and accessibility
- Hybrid design direction approved; apply consistently across public landing, registration, dashboards, event workflows, marketplace, wallet, messaging and admin.
- Responsive desktop/tablet/mobile layouts; legible type, contrast, keyboard navigation, focus states, labels, loading/empty/error states and accessible dialogs.
- Theme switching must preserve readable foreground/background contrast in light, dark and colorful themes.
- Registration should not be dominated by an oversized logo; include back/continue controls and clear progress.
- Fast startup, sensible lazy loading, optimized images and no unnecessary blocking splash.
- Consistent navigation and dialog positioning across viewport sizes.
- Audio only after explicit permission/user gesture.
- App icon, splash and branding must be consistent in web/PWA and native shells.

### 3.9 Mobile app and updates
- Capacitor Android/iOS shells use the shared web application and native plugins only where supported.
- Android build: sync, lint, unit tests and APK assembly; signed release only when secrets/certificate fingerprint are configured.
- Test physical installation, cold start, authentication, navigation, payment journeys, offline/reconnect, push permission and update rollback/safety.
- OTA updates require compatible native runtime/plugin versions, signed/approved channel configuration and a reliable rollback path. Web deployment does not automatically guarantee every installed native binary updates.
- iOS release requires macOS/Xcode and Apple signing/provisioning.

### 3.10 Operations, security and privacy
- Health/readiness endpoint, structured redacted logs, metrics, backups and rehearsed restore.
- Secrets in Render/GitHub secret stores with least privilege and rotation.
- Rate limiting, input validation, secure headers, CORS allow-list, access control and audit logs.
- KYC documents and personal information are private; define access and retention.
- Data migrations must be backward-compatible where possible, backed up and tested against disposable PostgreSQL.
- Preserve Render Free deployment constraint unless explicitly changed.
- No real-money tests in CI or demo fixtures.

## 4. Technical baseline observed in repository

- Monorepo using npm workspaces; root package scripts invoke the app workspace under `eventsss123/eventsss-main`.
- API: Express + TypeScript, Prisma 5 and PostgreSQL.
- Web: React 18, TypeScript, Vite, React Router, PWA and Playwright.
- Mobile: Capacitor 6 with Android and iOS native projects.
- API schema includes users/roles, events, vendors/listings, wallets, payment intents, payouts, bookings, notifications, messaging, verification, dispatch and music rights-owner records.
- CI workflows cover browser journeys, responsive UX, scale QA, Android, iOS simulator, security, licence inventory, backup/restore, release gates and branch consolidation.
- Root scripts include `check`, `build`, `build:web`, `mobile:verify`, `device-security:verify`, `ux:audit`, payment mode, scale QA and worldwide persona QA.

## 5. Release acceptance gates

| Gate | Evidence required | Not sufficient by itself |
| --- | --- | --- |
| Install/dependencies | Clean `npm ci` | Existing node_modules |
| API | Prisma validate/generate, TypeScript and API tests | Typecheck alone |
| Database | Disposable PostgreSQL migration + integration tests | Schema file review |
| Web | Unit tests, production build, route smoke tests | Dev server starts |
| Browser journeys | Desktop and mobile Playwright for planner/vendor/payment/messaging | Mocked single component test |
| Responsive/accessibility | Design audit plus manual screen-reader/keyboard/device review | CSS audit alone |
| Payments | Sandbox provider credentials, signed webhook, idempotency and reconciliation evidence | Mock adapter or green test fixture |
| Email/push | Provider configuration and controlled delivery verification | UI notification rendered |
| Android | Gradle lint/unit/debug build, signed artifact if release, physical-device install/use | APK compiles |
| iOS | Simulator build and device/signing validation for release | Simulator build alone |
| Security | Dependency audit, auth/authorization tests, secret scan, device-security checks | No known vulnerabilities report |
| Backup/restore | Successful restore rehearsal and data-integrity checks | Backup file exists |
| Production | Live health, logs, deployment verification and smoke tests | CI success |
| Music rights | Track-level chain-of-title, splits, usage/revenue reconciliation and legal review | User assertion or asset in repository |

## 6. Known external configuration dependencies

These cannot be completed by source-code changes alone:
- Render service configuration, environment variables, database and health checks.
- OPay merchant sandbox credentials and enabled product permissions; Eversend/Cleva account and API approvals if pursued.
- SMTP/email provider, sender-domain verification and delivery configuration.
- Push provider configuration and platform credentials.
- Android keystore/secrets and certificate fingerprint.
- Apple developer account, certificates and provisioning profiles for iOS distribution.
- Track-level commercial rights documentation and approved royalty/accounting policy.

## 7. Current completion rule

Every requirement must be marked **implemented and tested**, **implemented but externally unverified**, **partially implemented**, **not implemented**, or **not applicable**. Never infer completion from the existence of a component, schema model, workflow or mock test. Record the evidence (file, test, workflow run, provider receipt or device result) and the owner of each remaining action.

## 8. Immediate audit sequence

1. Establish current `main` SHA and inspect all open PRs/branch diffs before integrating anything.
2. Map each API route, UI route, Prisma model and test to the domains above.
3. Run clean install, API/web tests, production builds, DB integration, browser E2E, responsive/design, security and Android checks.
4. Reproduce and fix failures at their source; add regression tests.
5. Verify sandbox OPay collection, payout, refund and reconciliation with provider-backed evidence.
6. Verify planner/vendor/guest/verifier/admin journeys end-to-end.
7. Validate real-device APK installation and update behaviour.
8. Complete operational secrets, backups, monitoring and release gates.
9. Publish a dated status report with evidence and explicitly listed external blockers.
