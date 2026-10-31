# ESS Phase 0 Source Audit

Audit date: 2026-10-31  
Source of truth: repository `main` at the current production-readiness review. This is a static source inventory; route-level integration, browser/device behavior, and provider operation are not implied by source presence.

## Phase count and scope

The supplied master prompt's Part 10 explicitly lists Phase 0 through Phase 8
(nine numbered phases). Its Part 9 tracks 9.1, 9.2 and 9.3 are assigned to
Phases 5, 6 and 7 respectively. It does not define an 11-phase acceptance
matrix. The implementation therefore must not claim "all 11 phases" without an
owner-provided definition for the two additional phases.

Phase 0 is inventory and workflow setup only. No product feature changes or
deletions are made by this audit refresh.

## Entry points and web source usage

`apps/web/index.html` loads `src/main.tsx`. `main.tsx` mounts
`EnterpriseApp.tsx`, chooses `BrowserRouter` for web and `HashRouter` for the
native Capacitor app, registers the web service worker, and mounts offline
status/sync. `EnterpriseApp.tsx` now declares public, wizard, auth, reset,
protected-dashboard and legacy-role redirects with React Router `<Routes>` and
`<Route>`. Physical browser/native back, refresh and deep-link behavior remains
unverified, and the legacy shell remains unmounted.

| Web source | Status in current entry graph | Notes |
|---|---|---|
| `src/main.tsx` | Active entry | Mounts `EnterpriseApp`, `OfflineStatus`, router and runtime setup. |
| `src/EnterpriseApp.tsx` | Active shell | Public landing, auth, planner wizard and guarded role dashboard routes. |
| `src/lib/appRoutes.ts` | Active | Shared route paths and legacy `/app/:role` destination mapping. |
| `src/App.tsx` | Unmounted legacy shell | Not imported by `main.tsx`; retains older event/vendor implementation and direct API calls. |
| `src/components/LandingPageFunctional.tsx` | Active | Imported by `EnterpriseApp.tsx` as the public landing. |
| `src/components/LandingPage.tsx` | Legacy-only | Imported by unmounted `App.tsx`, not the active landing. |
| `src/components/PublicLanding.tsx` and `src/PublicLanding.tsx` | No active imports found | Duplicate/older auth/landing implementations. |
| `src/components/SplashLogo.tsx` | Legacy-only | Imported by unmounted `App.tsx`. |
| `src/components/MarketplaceBrowse.tsx`, `WalletPanel.tsx`, `FeedbackPanel.tsx`, `EventReadinessBoard.tsx`, `EventCreatePanel.tsx`, `VerifierPicker.tsx`, `KycUpload.tsx`, `SubscriptionsPanel.tsx`, `EmptyState.tsx`, `JourneyMoments.tsx` | Active imports | Included directly or indirectly by `EnterpriseApp.tsx`. |
| `src/lib/api.ts`, `i18n.ts`, `passwordRule.ts`, `roleLabels.ts`, `nativeFetch.ts`, `liveUpdate.ts`, `push.ts`, `offline/*` | Active or test imports | API helpers and runtime support; offline modules also have unit tests. |
| `src/components/LandingPageFunctional.tsx` | Active landing implementation | The similarly named legacy landing files above are not interchangeable without review. |

`react-router-dom` is installed and the active app uses `useLocation` and
`useNavigate`; browser refresh/deep-link behavior still depends on deployment
fallback configuration and was not device-tested.

## API route inventory

All paths below are mounted under `/api/v1` unless shown otherwise. `Auth`
means bearer authentication. Status is static: implemented source does not
mean a complete browser/provider/database flow was exercised. Module-wide
guards and validation are stated above each table.

### Health and readiness probes

| Method + path | Guard / behavior | UI caller / static status |
|---|---|---|
| `GET /health` | Public | No UI caller; implemented probe. |
| `GET /ready` | Public; DB probe, returns 503 on DB failure | No UI caller; implemented probe. |

### Auth — `/auth`

All request-body schemas listed are Zod validated. Auth forms are in active
`EnterpriseApp.tsx`; API calls are selected from the auth mode. The active app
also calls password reset there.

| Method + path | Validation / guard | UI caller / static status |
|---|---|---|
| `POST /auth/register` | `registerSchema` | `EnterpriseApp.tsx`; implemented, full signup journey unverified. |
| `POST /auth/login` | `loginSchema` | `EnterpriseApp.tsx`; implemented, full sign-in journey unverified. |
| `POST /auth/forgot-password` | `forgotPasswordSchema` | `EnterpriseApp.tsx`; implemented, email delivery unverified. |
| `POST /auth/reset-password` | `resetPasswordSchema` | `EnterpriseApp.tsx`; implemented, full reset journey unverified. |
| `POST /auth/refresh` | `refreshSchema` | Active session refresh; implemented. |
| `POST /auth/logout` | `refreshSchema` | Active auth flow; implemented. |
| `GET /auth/me` | Auth | No explicit active UI call found; implemented. |

Evidence: [`auth.routes.ts`](../apps/api/src/modules/auth/auth.routes.ts),
[`auth.schemas.ts`](../apps/api/src/modules/auth/auth.schemas.ts).

### Events — `/events`

All routes require Auth; event/child operations scope through the authenticated
owner and verify child-to-event association. UUID parameters and Zod schemas
are applied where listed. `EventCreatePanel.tsx` and readiness/dashboard
surfaces are active; direct event-list/task/guest/budget operations also remain
in the unmounted `App.tsx`, so not every route has a confirmed active caller.

| Method + path | Validation | UI caller / static status |
|---|---|---|
| `POST /events` | `createEventSchema` | Active `EventCreatePanel`; legacy `App.tsx`; implemented. |
| `GET /events` | `listEventsQuery` | Legacy `App.tsx`; active dashboard use not fully verified. |
| `GET /events/:eventId` | UUID; owner | Legacy `App.tsx`; implemented. |
| `PATCH /events/:eventId` | UUID; `updateEventSchema`; owner | Legacy `App.tsx`; implemented. |
| `DELETE /events/:eventId` | UUID; owner | Legacy `App.tsx`; implemented. |
| `POST /events/:eventId/guests` | UUID; `guestCreateSchema`; owner | Legacy `App.tsx`; implemented. |
| `POST /events/:eventId/guests/bulk` | UUID; `guestBulkSchema`; owner | No confirmed active caller; implemented. |
| `GET /events/:eventId/guests` | UUID; `listGuestsQuery`; owner | Legacy `App.tsx`; implemented. |
| `PATCH /events/:eventId/guests/:guestId` | UUIDs; `guestUpdateSchema`; owner and association | Legacy `App.tsx`; implemented. |
| `DELETE /events/:eventId/guests/:guestId` | UUIDs; owner and association | Legacy `App.tsx`; implemented. |
| `GET /events/:eventId/tasks` | UUID; owner | Legacy `App.tsx`; implemented. |
| `POST /events/:eventId/tasks` | UUID; `taskCreateSchema`; owner | Active event panel/legacy `App.tsx`; implemented. |
| `POST /events/:eventId/tasks/generate-checklist` | UUID; owner | No confirmed active caller; implemented. |
| `PATCH /events/:eventId/tasks/:taskId` | UUIDs; `taskUpdateSchema`; owner and association | Legacy `App.tsx`; implemented. |
| `DELETE /events/:eventId/tasks/:taskId` | UUIDs; owner and association | Legacy `App.tsx`; implemented. |
| `GET /events/:eventId/budget` | UUID; owner | Legacy `App.tsx`; implemented. |
| `POST /events/:eventId/budget/items` | UUID; `budgetCreateSchema`; owner | Legacy `App.tsx`; implemented. |
| `PATCH /events/:eventId/budget/items/:itemId` | UUIDs; `budgetUpdateSchema`; owner and association | Legacy `App.tsx`; implemented. |
| `DELETE /events/:eventId/budget/items/:itemId` | UUIDs; owner and association | Legacy `App.tsx`; implemented. |

Evidence: [`events.routes.ts`](../apps/api/src/modules/events/events.routes.ts),
[`events.schemas.ts`](../apps/api/src/modules/events/events.schemas.ts),
[`events.service.ts`](../apps/api/src/modules/events/events.service.ts).

### RSVP — `/rsvp`

Rate-limited, public routes; UUID token lookup and `rsvpRespondSchema` apply.
No active web RSVP caller was found in the checked-in `apps/web/src`.

| Method + path | Static status |
|---|---|
| `GET /rsvp/:token` | Implemented; no active UI caller found. |
| `POST /rsvp/:token` | Implemented; no active UI caller found. |

Evidence: [`rsvp.routes.ts`](../apps/api/src/modules/rsvp/rsvp.routes.ts).

### Marketplace — `/marketplace`

All routes require Auth. Marketplace uses active `MarketplaceBrowse.tsx`;
review submission/eligibility uses active `FeedbackPanel.tsx`.

| Method + path | Role / checks | Static status |
|---|---|---|
| `GET /marketplace` | Active listings; optional search/location/category/currency/type filters | Implemented; active browse UI. |
| `GET /marketplace/categories` | Auth | Implemented; active browse UI. |
| `GET /marketplace/reviews/eligible` | `CLIENT`; caller's fulfilled bookings without a review | Implemented; active feedback UI. |
| `POST /marketplace/reviews` | `CLIENT`; booking ownership/fulfilled checks; rating 1–5 and comment length limit | Implemented; active feedback UI. |
| `GET /marketplace/:listingId/reviews` | Auth; listing lookup | Implemented; caller not confirmed. |

Evidence: [`marketplace.routes.ts`](../apps/api/src/modules/marketplace/marketplace.routes.ts).

### Wallet — `/wallet`

All routes inherit Auth and scope wallet/ledger operations to the caller.
Active `WalletPanel.tsx` uses wallet listing, ledger and deposit surfaces.

| Method + path | Validation / static status |
|---|---|
| `GET /wallet` | Caller wallets; implemented. |
| `GET /wallet/:walletId/ledger` | Wallet ownership; implemented. |
| `POST /wallet/deposit` | Positive amount/currency checks; provider checkout is implemented, provider sandbox unverified. |
| `POST /wallet/escrow-hold` | Positive amount and balance checks; implemented. |

Evidence: [`wallet.routes.ts`](../apps/api/src/modules/wallet/wallet.routes.ts),
[`WalletPanel.tsx`](../apps/web/src/components/WalletPanel.tsx).

### Billing — `/billing`

Auth is required. `SubscriptionsPanel.tsx` is active; admin/vendor promotion
flows are not verified as complete.

| Method + path | Role / ownership / validation | Static status |
|---|---|---|
| `GET /billing/plans` | Optional audience filter | Implemented; active plans caller. |
| `GET /billing/subscriptions/me` | Caller subscriptions | Implemented; active subscriptions caller. |
| `POST /billing/subscriptions` | Caller role must match plan audience (including organization mode); zero-cost plans only | Implemented; paid plans fail closed until verified checkout is enabled. |
| `POST /billing/subscriptions/:id/cancel` | Subscription must belong to caller | Implemented. |
| `GET /billing/promotions` | `VENDOR`/`ADMIN`; vendor scoped to own | Implemented; end-to-end UI unverified. |
| `POST /billing/promotions` | `VENDOR`; vendor profile and inline input checks | Implemented; end-to-end UI unverified. |

Evidence: [`billing.routes.ts`](../apps/api/src/modules/billing/billing.routes.ts),
[`SubscriptionsPanel.tsx`](../apps/web/src/components/SubscriptionsPanel.tsx).

### KYC — `/kyc`

Country lookups are public. Other routes require Auth; route handlers use
inline validation rather than shared Zod body schemas. Active `KycUpload.tsx`
uses the user submission surfaces; admin review UI is not confirmed as an
operational end-to-end workflow.

| Method + path | Role / ownership / validation | Static status |
|---|---|---|
| `GET /kyc/countries` | Public; optional region | Implemented; active KYC selector. |
| `GET /kyc/countries/:code` | Public | Implemented; caller not confirmed. |
| `GET /kyc/me` | Caller requests | Implemented; active KYC surface. |
| `POST /kyc/submit` | Caller request; inline document/type checks | Implemented; active KYC surface. |
| `GET /kyc/queue` | `ADMIN` or `CONSULTANT` | Implemented; operational admin workflow unverified. |
| `POST /kyc/:id/review` | `ADMIN` or `CONSULTANT`; status constrained | Implemented; operational admin workflow unverified. |

Evidence: [`kyc.routes.ts`](../apps/api/src/modules/kyc/kyc.routes.ts),
[`KycUpload.tsx`](../apps/web/src/components/KycUpload.tsx).

### Payments — `/payments`

All authenticated routes require Auth, with route-specific role and ownership
checks noted. Payment UI exists in active wallet/marketplace flows; external
provider sandbox behavior was not verified.

| Method + path | Role / checks | Static status |
|---|---|---|
| `POST /payments/intents` | Auth; positive amount; caller intent | Implemented; provider test flow unverified. |
| `POST /payments/demo-checkout/:intentId` | Auth; intent owned by caller and eligible for test-mode demo | Implemented; test-mode guarded. |
| `POST /payments/webhooks/:provider` | Public provider callback; provider/signature/raw-body verification | Implemented; automated tests present, provider sandbox unverified. |
| `POST /payments/book` | Auth; caller event, verifier, wallet and listing checks | Implemented legacy single-listing booking API. |
| `POST /payments/bookings/:id/release` | Auth, `VERIFIER`; escrow policy checks | Implemented; end-to-end release unverified. |
| `POST /payments/payouts` | Auth, `VENDOR`/`AFFILIATE`/`ADMIN`; returns 501 without ledger mutation | Intentionally unavailable until payout provider integration. |
| `GET /payments/bookings` | Auth; caller buyer or vendor scope | Implemented. |

Evidence: [`payments.routes.ts`](../apps/api/src/modules/payments/payments.routes.ts),
[`webhookVerification.ts`](../apps/api/src/modules/payments/webhookVerification.ts).

### Checkout — `/checkout`

All routes require Auth. Input checks are inline; caller/cart/event/session
ownership is checked in handlers. Active marketplace/cart components call
`checkoutApi` in `lib/api.ts`.

| Method + path | Static status |
|---|---|
| `GET /checkout/cart` | Implemented; caller/event-scoped. |
| `POST /checkout/cart/items` | Implemented; listing/vendor and caller/event checks. |
| `PATCH /checkout/cart/items/:itemId` | Implemented; quantity bounds and cart ownership. |
| `DELETE /checkout/cart/items/:itemId` | Implemented; cart ownership. |
| `POST /checkout/checkout-sessions` | Implemented; caller cart/event, verifier, vendor/listing/currency checks. |
| `GET /checkout/checkout-sessions/:id` | Implemented; session ownership and expiry handling. |
| `POST /checkout/checkout-sessions/:id/pay-with-wallet` | Implemented; wallet/session ownership, balance and idempotency checks. |
| `POST /checkout/checkout-sessions/:id/cancel` | Implemented; caller session, paid sessions rejected. |

Evidence: [`checkout.routes.ts`](../apps/api/src/modules/checkout/checkout.routes.ts),
[`api.ts`](../apps/web/src/lib/api.ts).

### Notifications — `/notifications`

All routes inherit Auth and scope reads/writes to the caller. Active
`EnterpriseApp.tsx` displays notifications; push registration uses
`lib/push.ts`.

| Method + path | Static status |
|---|---|
| `GET /notifications` | Implemented; active notification surface. |
| `POST /notifications/read-all` | Implemented. |
| `POST /notifications/push-token` | Inline token length check; implemented. |
| `POST /notifications/test-push` | Inline defaults; implemented test surface. |

Evidence: [`notifications.routes.ts`](../apps/api/src/modules/notifications/notifications.routes.ts),
[`push.ts`](../apps/web/src/lib/push.ts).

### Readiness — `/readiness`

All routes require Auth; route-specific roles, event ownership and verifier
assignment checks vary. `EventReadinessBoard.tsx`, `VerifierPicker.tsx`, and
`EnterpriseApp.tsx` call readiness APIs. Body validation is generally inline.
Event-scoped board, sync, snapshot and verifier-list routes now require the
event owner, an admin/consultant, or an assigned verifier. Zone changes are
restricted to the event owner, admin or consultant.

| Method + path | Additional role / scope | Static status |
|---|---|---|
| `POST /readiness/events/:eventId/sync` | Event owner, admin/consultant, or assigned verifier; completed events blocked | Implemented. |
| `GET /readiness/events/:eventId` | Event owner, admin/consultant, or assigned verifier | Implemented. |
| `GET /readiness/queue` | `VERIFIER`/`CONSULTANT`/`ADMIN` | Implemented. |
| `POST /readiness/events/:eventId/claim` | `VERIFIER`/`CONSULTANT`/`ADMIN`; assignment checks | Implemented. |
| `PATCH /readiness/checks/:checkId` | `VERIFIER`/`CONSULTANT`/`ADMIN`; assigned verifier and status checks | Implemented. |
| `POST /readiness/events/:eventId/finalize` | `VERIFIER`; assignment/event policy | Implemented. |
| `GET /readiness/mine` | Caller events | Implemented; active dashboard caller. |
| `POST /readiness/events/:eventId/seed-zones` | Owner or privileged roles; completed events blocked | Implemented. |
| `POST /readiness/events/:eventId/verifiers` | Verifier may self-assign; event owner/admin/consultant may assign another verifier; target must have VERIFIER role | Implemented and covered by readiness access-policy tests. |
| `GET /readiness/events/:eventId/verifiers` | Event owner, admin/consultant, or verifier assigned to the event | Implemented and covered by readiness access-policy tests. |
| `GET /readiness/events/:eventId/snapshot` | Event owner, admin/consultant, or verifier assigned to the event | Implemented and covered by readiness access-policy tests. |
| `PATCH /readiness/checks/:checkId/zone` | Event owner, admin, or consultant | Implemented and covered by readiness access-policy tests. |
| `GET /readiness/verifiers/directory` | Auth; optional event/location filters | Implemented. |
| `GET /readiness/verifiers/:userId/profile` | Auth | Implemented. |
| `POST /readiness/events/:eventId/select-verifiers` | Owner or `ADMIN` | Implemented. |
| `PUT /readiness/verifiers/me/profile` | `VERIFIER`/`ADMIN`; caller's profile | Implemented. |
| `POST /readiness/verifiers/:userId/reviews` | Client owner of a completed event; target verifier must be assigned; one review per event | Implemented; no full browser review journey confirmed. |

Evidence: [`readiness.routes.ts`](../apps/api/src/modules/readiness/readiness.routes.ts).

### Inline vendor, rider and listing routes — `app.ts`

Vendor profile/listing/KYC handlers require `VENDOR`; owner scoping is stated
below. These are called by legacy `App.tsx`, which is not mounted by the active
entry point. The public marketplace UI uses `/marketplace`; do not assume these
legacy routes are its caller.

| Method + path | Guard / behavior | Static status |
|---|---|---|
| `GET /vendor/profile` | Auth, `VENDOR`; caller profile | Implemented; only legacy UI caller found. |
| `PATCH /vendor/profile` | Auth, `VENDOR`; caller profile; no shared schema | Implemented; only legacy UI caller found. |
| `GET /vendor/categories` | Auth, `VENDOR` | Implemented; only legacy UI caller found. |
| `GET /vendor/kyc` | Auth, `VENDOR`; caller requests | Implemented; only legacy UI caller found. |
| `POST /vendor/kyc` | Auth, `VENDOR`; inline body handling | Implemented; only legacy UI caller found. |
| `POST /vendor/listings` | Auth, `VENDOR`; caller's vendor profile; no shared schema | Implemented; only legacy UI caller found. |
| `PATCH /vendor/listings/:listingId` | Auth, `VENDOR`; listing must be caller-owned; no shared schema | Implemented; only legacy UI caller found. |
| `DELETE /vendor/listings/:listingId` | Auth, `VENDOR`; listing must be caller-owned | Implemented; only legacy UI caller found. |
| `GET /rider/jobs` | Always 410 `ROLE_RETIRED` | Intentionally retired per [`DECISIONS.md`](./DECISIONS.md); historical data retained. |
| `PATCH /rider/jobs/:jobId` | Always 410 `ROLE_RETIRED` | Intentionally retired per owner decision. |
| `GET /listings` | Auth; optional search/city/currency/type/max-price filters; vendors see own active listings | Implemented; legacy app caller. |

Evidence: [`app.ts`](../apps/api/src/app.ts).

## P1–P13 original findings: corrected status

| Finding | Current evidence-based status |
|---|---|
| P1 Two front ends | **Partly confirmed.** `main.tsx` mounts `EnterpriseApp.tsx`; `App.tsx` remains unmounted legacy code. |
| P2 Role routing incomplete | **Partly corrected.** Active shell has role-specific portals and organization/consultant behavior; Admin remains a static preview and Rider is intentionally retired by owner decision. |
| P3 No URL routing | **Corrected in code.** Declarative route table and role guards are present; required physical browser/native deep-link coverage remains. |
| P4 Duplicate landing/backup files | **Confirmed.** Candidate inventory below; no deletion without Phase 8 approval. |
| P5 Register mismatch | **Partly corrected.** Shared role/password rules and Organization registration exist; Rider removal is the owner decision. Full input/phone/browser tests remain. |
| P6 Cart UI stub | **Stale.** Cart API/session/UI are present; provider/card checkout is not integrated. |
| P7 Escrow not wired to UI | **Stale in part.** Wallet/checkout/escrow UI paths exist; full end-to-end validation and legal custody are unresolved. |
| P8 One vendor per booking | **Stale for cart checkout.** Checkout-session path can split bookings by vendor/currency; legacy `/payments/book` remains single-listing. |
| P9 Webhook security | **Corrected in code/tests.** Provider signature/verification checks exist; live provider sandbox is unverified. |
| P10 Feedback route missing | **Stale.** Review routes and active feedback UI exist. |
| P11 No messaging | **Still open.** Notifications exist; direct and multi-recipient message threads do not. |
| P12 No PWA/offline | **Stale in part.** PWA/offline cache/outbox modules exist; Bluetooth/NFC and installed-device behavior remain unverified. |
| P13 Demo payment mode | **Guarded in code.** Demo checkout is test-mode constrained; deployment/provider-mode verification remains. |

## Phase 8 deletion candidates — not approved, not deleted

These are inventory candidates only. Confirm imports/contents and obtain owner
approval before any deletion patch.

| Candidate | Static evidence / reason to review |
|---|---|
| `eventsss-main/` | Nested repository snapshot with its own app and docs; current workspace entry/build does not import it. May contain historical source worth retaining. |
| `apps/web/src/App.tsx` | Not imported by `main.tsx`; old shell. |
| `apps/web/src/components/LandingPage.tsx` | Imported only by unmounted `App.tsx`. |
| `apps/web/src/components/SplashLogo.tsx` | Imported only by unmounted `App.tsx`. |
| `apps/web/src/PublicLanding.tsx` | No current source import found. |
| `apps/web/src/components/PublicLanding.tsx` | Active landing component: imported by the active `EnterpriseApp.tsx` entry shell (verify current imports before cleanup). Not a deletion candidate. |
| `apps/web/src/components/LandingPageFunctional.tsx` | **Not a deletion candidate:** imported by active `EnterpriseApp.tsx`. |
| `apps/web/src/**/*.bak*`, `*.rej` | Backup/reject artifacts found by file inventory; preserve until content/intent is reviewed. |
| Rider schema/history/fee code | Owner decision retires active Rider product routes; schema and historical records are deliberately retained. |

No files were deleted in this audit. The owner decision to retire Rider
supersedes the older Phase 0 question asking whether Rider should be hidden or
fully dropped. Cleanup still requires approval.

## Current blockers (not Phase 0 feature work)

- The full master prompt supplied here enumerates nine numbered phases, not
  eleven. An authoritative definition for two additional phases is absent.
- Phase 1–8 completion remains partial; the current status and remaining tasks
  are summarized in [`REPORT-031-COMPLETENESS-AUDIT.md`](./REPORT-031-COMPLETENESS-AUDIT.md).
- PR #24, #25 and #26 final-head CI runs passed API/web checks, PostgreSQL 16 migrations and database integration tests, web builds, and Android debug APK builds. This is CI evidence, not physical-device or full browser E2E sign-off.
- Render API `/health` and `/ready` returned 200 in the GitHub Actions online-readiness check. Render API and web deployments for the readiness authorization fix are live.
- The owner-supplied PostgreSQL backup has not completed `pg_restore --list` or a disposable restore rehearsal; the live database contains records and must be preserved.
- Provider sandbox journeys, real-payment activation, restore rehearsal, physical-device behavior, and complete role-by-role browser E2E remain unverified.
- API endpoint presence and caller mapping are static findings; do not treat the whole route set as end-to-end verified.
