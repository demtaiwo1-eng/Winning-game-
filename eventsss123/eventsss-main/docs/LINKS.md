# EPHINTA Web Route Inventory

This inventory reflects the active React entry graph in `apps/web/src/main.tsx`
and the route declarations in `apps/web/src/EnterpriseApp.tsx`. Source wiring
is not the same as a live production or authenticated-workflow pass; browser
regressions are maintained in `apps/web/e2e/public-journeys.spec.ts`.

## Public routes

| URL | Behavior |
|---|---|
| `/` | Public landing page |
| `/plan` | Event-planning wizard |
| `/join/:role` | Role-specific introduction for supported self-registering roles |
| `/auth/signin?role=...` | Sign-in dialog |
| `/auth/signup?role=...` | Registration dialog |
| `/auth/forgot?role=...` | Password reset request |
| `/reset-password?token=...` | Set a new password using a valid reset token |
| `/rsvp/:token` | Public guest invitation and RSVP |
| `/login` | Compatibility redirect to sign-in |
| `/register`, `/register/:role` | Compatibility redirects to registration |
| `/forgot-password` | Compatibility redirect to password reset request |
| `/marketplace` | Opens the marketplace tab in a signed-in customer workspace; signed-out visitors are sent through sign-in and returned to the marketplace |
| `/plan/review` | Compatibility redirect to the resumable planner |
| `/plan/create-account` | Compatibility redirect to customer registration |

## Protected canonical routes

| URL | Behavior |
|---|---|
| `/dashboard/:role` | Role-guarded workspace |
| `/plan` | Event planner for eligible signed-in roles |
| `/rsvp/:token` | RSVP remains available while signed in |

## Compatibility routes

- `/app/*` redirects supported legacy role paths to `/dashboard/:role`.
- `/app/executive-planner`, `/app/client`, and `/app/planner` map to the client dashboard.
- Organization, vendor, affiliate, verifier, consultant, and admin legacy paths map to their corresponding dashboards.
- Rider is decommissioned and is not a supported account or dashboard route.

## Not standalone routes

- Marketplace browsing is part of the authenticated customer workspace and is deep-linkable at `/marketplace`; there is no separate `/marketplace/:listingId` listing-detail screen in the active route graph.
- The planner review/create-account legacy paths are redirects, not separate page implementations.
- Unknown paths intentionally return users to the landing page (or their dashboard when authenticated).

## Deployment

The Render static site uses a catch-all rewrite to `/index.html`, so browser
refreshes and direct requests reach the React Router application. The web build
also emits `dist/404.html` as a secondary static-host fallback.
