# ESS Phase 1 Link Inventory

## Landing page

| Control | Destination/action | Status |
|---|---|---|
| ESS logo | Top of landing page | Source-wired |
| Start planning an event | `/plan` | Source-wired |
| Menu → Sign in | `/auth/signin` | Source-wired |
| Menu → Sign up | `/auth/signup` | Source-wired |
| Menu → other role sign-up | `/auth/signup?role=...` | Source-wired |
| Executive Planner card | `/plan` | Source-wired |
| Other role cards | Shared sign-up flow with role preselected | Source-wired |
| Funds protected | `#security` | Source-wired |

## Public routes

- `/`
- `/plan`
- `/plan/review`
- `/plan/create-account`
- `/login`
- `/register`
- `/register/:role`
- `/forgot-password`
- `/reset-password`
- `/marketplace`
- `/marketplace/:listingId`
- `/rsvp/:token`

## Protected canonical routes

- `/app/executive-planner`
- `/app/organization`
- `/app/vendor`
- `/app/rider`
- `/app/affiliate`
- `/app/verifier`
- `/app/consultant`
- `/app/admin`

## Compatibility routes

- `/dashboard/:role`
- `/app/*` legacy aliases
- `/app/client` and `/app/planner` resolve to the Executive Planner dashboard through the legacy role mapping.

No Phase 8 deletion was performed.
