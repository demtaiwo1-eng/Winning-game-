# Ephinta full improvement patch — phased delivery plan

This plan is the acceptance contract for the full Ephinta hardening and product
improvement programme. It deliberately separates safe code changes from
provider-account setup, production operations, and features that need
end-to-end validation. Existing user records, authentication, event data,
vendor profiles, bookings, wallet balances, ledger entries, and migration
history must be preserved.

## Delivery rules

- Work only on the feature branch until the pull request is reviewed.
- No destructive schema changes, data resets, migration squashing, or cleanup
  based on filenames alone.
- Do not activate a real-money, paid-placement, payout, or advertising flow
  until its provider verification, consent, audit trail, and tests exist.
- Keep credentials in GitHub/Render secret stores. Never commit keys, tokens,
  signing files, or production environment files.
- Every phase ends with build, typecheck, unit tests, database integration
  tests where applicable, and a written result. Mark work blocked rather than
  claiming it passed when the environment/provider is unavailable.
- Keep existing public role registration rules; privileged roles must not be
  assignable by public signup. Preserve legacy role login and authorization.
- Keep API and database contracts backwards compatible unless a versioned
  migration and compatibility plan is approved.

## Phase 0 — baseline, backups and release safety

- Record current main SHA, branch state, service topology, environment variable
  names (never values), Prisma schema and migration inventory.
- Take and verify a PostgreSQL backup before any production migration.
- Add a restore rehearsal and a rollback procedure.
- Capture existing web/API/mobile test results and baseline APK build status.
- Verify the real Render services and domains before changing deployment
  configuration.
- Acceptance: backup can be restored to a non-production database; no live
  service or data is modified by this phase.

## Phase 1 — production blockers and web API correctness

- Use one shared API URL resolver for auth and application API requests.
- Configure VITE_API_URL as the full HTTPS API base ending in /api/v1 for
  production builds; retain the relative development proxy for local work.
- Verify CORS origins against the actual frontend and Capacitor origins.
- Remove the misleading AdSense markup that was labelled AdMob. Native AdMob
  requires a supported Capacitor/native SDK integration and account-issued IDs.
- Do not render fake vendor advertisements or placeholder paid listings.
- Fix Android SDK licence acceptance without the yes/pipe SIGPIPE pattern.
- Acceptance: web build succeeds with configured API base; browser requests
  target the API host, not the static-site host; auth, signup, login, and
  public promotions work against staging; Android SDK setup proceeds reliably.

## Phase 2 — paid vendor promotions and monetization integrity

- Vendor promotion creation must always begin in DRAFT.
- Validate positive integer minor-unit budgets, valid start/end dates, and
  ownership of any selected listing.
- Add a verified payment record and idempotent payment callback before
  promotion activation; do not trust a client-supplied ACTIVE status.
- Add an authorized admin approval action, campaign pause/expiry, cancellation,
  budget/spend limits, and an audit record.
- Add impression/click tracking with bot/rate controls and transparent
  reporting. Do not expose sensitive vendor or financial data publicly.
- Keep editorial content clearly labelled as editorial, separate from paid
  placements.
- Acceptance: unpaid, unapproved, expired, or foreign-vendor campaigns never
  appear in the public feed; duplicate payment callbacks cannot double-credit
  or double-activate; tests cover ownership, dates, and status transitions.

## Phase 3 — payments, wallet and booking reliability

- Review every payment provider adapter and webhook signature/raw-body path.
- Enforce idempotency on payment intents, wallet credits, holds, releases,
  refunds, and checkout completion.
- Reconcile provider references with internal payment and append-only ledger
  records; never accept client-side proof of payment as settlement.
- Add explicit pending/succeeded/failed/refunded states and retry-safe webhook
  handling.
- Add booking cancellation, dispute, refund and release policy with role and
  ownership checks. Do not release funds solely because a frontend says
  delivered.
- Keep payout initiation unavailable until provider onboarding, destination
  validation, webhook reconciliation, and operational controls are complete.
- Acceptance: concurrency and duplicate-webhook tests prove no double spend,
  double release, or double refund; failed provider calls leave balances intact.

## Phase 4 — event planner completeness

- Audit current event wizard, drafts, events, plan answers, guests, RSVPs,
  tasks, budgets, venue selection and readiness modules before extending them.
- Add save/resume and recoverable drafts without overwriting existing events.
- Complete guest list import/export, RSVP response links, check-in history and
  privacy controls.
- Complete task timeline, due dates, reminders, budget planned-vs-actual views,
  and vendor booking linkage.
- Add event readiness checklist and useful export/print views.
- Acceptance: client can create, edit, resume, plan, invite, track, and complete
  an event; owner scoping is tested for every event resource.

## Phase 5 — vendor marketplace and vendor portal

- Complete vendor storefront/profile, category and listing management,
  availability, enquiries, booking calendar and booking lifecycle.
- Add listing ownership checks, validation, image/file constraints, and safe
  draft/publish workflow.
- Add reviews only for eligible completed bookings; prevent duplicate reviews.
- Add vendor performance metrics, booking revenue, payout status, campaign
  status and customer enquiry views using verified source data.
- Add comparison and search filters only where the underlying data supports
  them; show honest empty states rather than invented rankings.
- Acceptance: vendor A cannot read or alter vendor B's private data, bookings,
  campaign, or metrics; public listings show only approved/active inventory.

## Phase 6 — messaging, notifications and trust

- Complete authenticated message threads with participant-only access,
  pagination, abuse controls and event context.
- Keep in-app notifications user-scoped; add delivery state and retry handling.
- Verify push-token registration and notification preferences on web/mobile.
- Add account security history, vendor verification status and clear user-facing
  booking/payment timelines.
- Acceptance: unauthorized participants cannot read messages or notifications;
  push failures do not break core app workflows.

## Phase 7 — Android/iOS and advertising

- Verify Capacitor app IDs, app name Ephinta, origin configuration, deep links,
  Android back button, file uploads, camera permissions, push notifications,
  and offline draft sync.
- Add native AdMob only with a Capacitor 6-compatible plugin and account-issued
  app/ad unit IDs. Use Google test IDs during development; production IDs are
  supplied by the owner. Implement consent/privacy requirements and no-fill
  graceful fallback.
- Keep Ephinta vendor promotions separate from AdMob inventory.
- Add signed release automation only after keystore custody and Play signing
  configuration are explicitly set by the owner.
- Acceptance: debug APK installs and role flows work on physical Android
  devices; release signing is not attempted with missing credentials; ads are
  disabled safely when consent/configuration is absent.

## Phase 8 — deployment, database and operations

- Verify Render web/static site, API service, PostgreSQL service, health checks,
  environment variables, CORS, build commands and start commands.
- Use managed PostgreSQL backups and test restores; do not rely on temporary
  free database storage for durable customer records.
- Run Prisma migrations as a controlled deploy step, never as an unreviewed
  production startup side effect.
- Add structured logs, request IDs, error monitoring, uptime checks, readiness
  checks and a rollback runbook.
- Verify web, API and Capacitor origins against production domains.
- Acceptance: staging deployment passes smoke tests and migration rehearsal;
  production deployment requires a verified backup and owner go-ahead.

## Phase 9 — security, accessibility and performance

- Audit auth/session expiry, password reset, rate limits, CORS, file uploads,
  authorization on every resource, secrets, dependency vulnerabilities and
  admin actions.
- Add security headers and safe logging that excludes tokens, passwords,
  identity documents and payment secrets.
- Improve keyboard navigation, screen-reader labels, focus states, contrast,
  reduced motion and mobile responsive layouts.
- Add pagination, query limits, database indexes based on measured query plans,
  lazy loading and asset-size budgets.
- Acceptance: authorization regression suite passes; critical/high security
  findings are fixed or explicitly risk-accepted; core flows meet agreed
  performance budgets.

## Phase 10 — repository hygiene and release readiness

- Rebuild the dependency/import inventory from the active entry points.
- Update stale audit documents before considering deletions.
- Generate a report-only unused-file inventory; preserve backups, migrations,
  credentials, signing assets, package manifests, lockfiles, CI/deployment
  configuration, licenses, historical data and required assets.
- Delete only files proven unused after static and dynamic checks and owner
  approval. No bulk deletion by filename, age, or lack of direct import.
- Add regression tests for all fixes and an end-to-end role matrix.
- Acceptance: clean install, API/web builds, unit tests, DB integration tests,
  browser smoke tests and Android debug build all pass; release checklist is
  signed off.

## Current branch patch included

The first implementation slice on this branch:
1. Adds shared `apiUrl()` resolution and routes the API client through it.
2. Routes landing-page auth and public promotion requests through the same
   configured API base.
3. Removes the false AdSense/AdMob component and fabricated fallback vendor
   promotion cards from the public landing page.
4. Forces new vendor promotion requests to DRAFT; validates budget, date range,
   and selected listing ownership.
5. Replaces the Android SDK `yes | sdkmanager --licenses` pipe with finite
   here-document input to avoid the known SIGPIPE failure mode.

These code changes still require CI and staging verification. Native AdMob,
payment-provider settlement, admin promotion approval, full event/vendor
workflow expansion, production deployment and cleanup remain separate phases;
this plan does not claim they have already been implemented.
