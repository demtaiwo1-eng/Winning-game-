# ESS Phase 1 Report

## Status
**Complete — Phase 1 implementation patch 042.** The foundation requirements in the master prompt are implemented in the active shell. Runtime/device verification remains an environment/device validation step; Phase 2+ work is intentionally separate.

The active app now has a declarative React Router route table for public
landing, planner wizard, sign-in/sign-up, password reset and protected
dashboards. Role paths are guarded, and recognized legacy `/app/...` role paths
redirect to their dashboard. Completed wizard briefs now post to the existing
event API after authentication using an owner-scoped idempotency key; failed
handoffs stay on-device and can be retried. Portal extraction, browser-level
authentication/event journey testing and manual mobile verification remain
incomplete.

## Implemented
- Browser/native router selection is present (`BrowserRouter` for web,
  `HashRouter` for native); route matching now uses a declarative `<Routes>`
  map.
- Unauthenticated dashboard access redirects to role-appropriate sign-in;
  signed-in users are redirected to their own dashboard when requesting a
  different role.
- Legacy `/app/planner`, `/app/vendor`, `/app/organization` and the other
  supported role aliases redirect to their `/dashboard/:role` destination.
- Route shape and legacy role-alias tests pass.
- The active landing page has menu-driven sign-in and role-signup callbacks
  and sends planning CTAs to the event wizard.
- The landing page no longer makes unsupported claims about pricing, yield,
  PCI-DSS, biometrics, global reach, downloads or Android distribution.
- Removed the unsupported “170+ markets” badge from the active sign-up screen.
- Replaced unsupported location, volume, savings and performance claims in the
  unused `PublicHome` fallback with neutral planning copy, avoiding stale
  claims if that component is reactivated.
- Replaced fabricated admin/vendor financial metrics and success-shaped
  administrative controls with explicit “not connected” preview states;
  vendor balances direct users to the live wallet panel.
- Android download actions render only when an app-provided callback exists;
  there is no generic Play Store fallback.
- Escrow copy reflects the existing release policy: the event must have
  ended, all service checks must be green, and the assigned lead verifier must
  authorize release.
- [LINKS.md](./LINKS.md) records the active landing/menu/footer controls and
  provides a phone tap-through checklist. It is a source inventory, not a
  claim that manual device testing has occurred.
- User-facing `CLIENT` label is now **Executive Planner**.
- Executive Planner accounts are initiated by the event wizard; the shared registration role picker excludes CLIENT, RIDER and ADMIN.
- `ORGANIZATION` added to Prisma and registration schema.
- Shared web password rule matches the API rule: 8–128 characters including at least one special character.
- Safe-area design tokens and `.screen` foundation added.
- Rider portal removed from the active web app.
- Legacy Rider jobs endpoints return `410 Gone`; Rider database history remains untouched.
- API regression tests cover Organization registration, Rider registration exclusion and the password rule.
- Planner handoff maps the wizard answers into the existing Event schema and
  uses the server's existing type-specific checklist generation.
- Event creation accepts an optional owner-scoped client request ID so a
  network retry returns the original event instead of creating a duplicate.
- Executive Planner dashboard lists saved events, surfaces handoff failures,
  and offers a retry while preserving the local draft.
- Planner, verifier, and vendor surfaces can list event messages and send
  selected-recipient or event-team broadcasts through authenticated API
  routes. Message delivery currently requires manual refresh; notifications
  and real-time delivery are not implemented.

## Intentionally deferred
- Organization dual-mode onboarding questionnaire (Phase 2).
- Add a browser-level regression covering landing → wizard → account creation
  and role-correct dashboard arrival.
- Exercise signup/sign-in/reset through the running API and browser in the target deployment environment.
- Manual mobile-device tap-through and Android distribution verification.
- Full Verifier/Affiliate/Consultant/Admin operating workflows where not already present in the active app.
- Payments, escrow hardening, messaging notifications/realtime, PWA/offline,
  performance and other later phases.
- Physical deletion/merge of `eventsss-main/` and duplicate artifacts.

## Validation
- Combined `scripts/apply-034-phase1-declarative-routes.sh` delivery runner —
  passed; both patches were recognized as already applied and the build/test
  steps completed.
- API and web production builds — passed.
- API tests — 44 passed; 1 database-dependent test skipped.
- Web tests — 28 passed, including field-validation, event-draft conversion
  and route tests.
- Prisma schema validates; migration `20261008124000_event_client_request_id`
  was applied successfully to the configured development database.
- Database integration tests remain skipped because this workspace has not
  established a dedicated disposable test database.
- Registration validates fields as entered, exposes visible-by-default passwords with confirmation and role-aware fields, and blocks double submit; full API/browser/device journeys remain deployment-level verification.
- Latest messaging increment: API build passed; API tests **46 passed / 2
  database-dependent skipped**; web production build passed; web tests **28
  passed**. Database-dependent messaging access tests were skipped because a
  dedicated disposable database is not configured.
- Patches 034 and 035 apply sequentially to a clean archive of baseline
  `9078247`.
- No physical-phone tap-through was performed.

The master prompt defines Phase 0 through Phase 8 (nine numbered phases), not
eleven. No definitions for two additional phases were supplied, so the app
cannot be certified against eleven defined phases.
