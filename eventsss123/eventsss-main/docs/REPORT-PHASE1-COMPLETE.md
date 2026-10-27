# ESS Phase 1 — Foundation Completion Report

## Scope
This patch completes the Phase 1 foundation defined in the ESS master requirements: dark theme, mobile safe areas, Executive Planner naming, HashRouter route table, role guards and portal adapters, Organization/Rider registration, audited Register behavior, menu-only authentication entry, landing-page marketing cleanup, planner handoff regression coverage, and link inventory.

## Implemented
- HashRouter is now the single web/native routing strategy so Capacitor deep links use the same URL model.
- Public route table includes `/`, `/plan`, `/plan/review`, `/plan/create-account`, `/login`, `/register`, `/register/:role`, `/forgot-password`, `/reset-password`, `/marketplace`, `/marketplace/:listingId`, and `/rsvp/:token`.
- Canonical protected role routes include Executive Planner, Organization, Vendor, Rider, Affiliate, Verifier, Consultant and Admin.
- `RequireRole` prevents a signed-in user from opening another role's canonical workspace.
- Legacy dashboard aliases remain supported and redirect safely.
- Portal adapters live under `apps/web/src/portals/` and are lazy-loaded by the shell without duplicating the existing portal implementation.
- `CLIENT` remains the internal database/API value while the user-facing label is `Executive Planner`.
- Shared role registration list excludes Executive Planner and Admin.
- Organization and Rider are available in the API registration schema; Rider is no longer rejected by authentication middleware.
- Register validates name, email, phone, password and role-specific fields as the user types.
- Password is visible by default with an eye toggle and the exact helper rule: `At least 8 characters, including a special character.`
- Password checklist, strength hint, confirmation matching and double-submit protection are enabled.
- Planner wizard preserves contact details and routes to the dedicated create-account step through a shared handoff constant.
- Landing page is now visitor-facing marketing copy and contains no API/routing/developer claims.
- Executive Planner entry starts the planning wizard; other roles open the shared registration flow.
- Sign in and sign up are exposed from the landing header menu; the Executive Planner role is never offered in the shared sign-up role list.
- Mobile safe-area viewport and layout tokens remain active, with Android native fallback values.
- `docs/LINKS.md` is refreshed as the Phase 1 source-wired link inventory.

## Intentionally not changed
Phase 8 deletion of unused/duplicate files remains separate and requires owner approval. Phase 2+ event-questionnaire expansion, Phase 3 payment hardening, Phase 4 messaging/readiness expansion, Phase 5 offline/PWA completion, Phase 6 performance, and Phase 7 Bluetooth/NFC remain separate patches.

## Validation
- TypeScript syntax check of the modified web project passes without syntax diagnostics.
- Existing web tests could not be executed in this source environment because the local `vitest` binary is not installed.
- Full production build remains environment-blocked by missing installed type packages in this checkout; the prior malformed `EnterpriseApp.tsx` syntax and duplicate JSX attribute errors addressed by this patch are removed.
