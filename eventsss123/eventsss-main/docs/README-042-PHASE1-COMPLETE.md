# ESS Patch 042 — Phase 1 Complete

This patch implements the Phase 1 foundation from the ESS master requirements. It supersedes overlapping Phase 1 foundation work where necessary and leaves Phase 2–8 feature work separate.

## Included

- Dark-blue theme remains the active theme from the preceding patch.
- HashRouter is now the single router strategy for browser and Capacitor use.
- Complete Phase 1 public route table and canonical role routes.
- `RequireRole` protection for canonical role workspaces.
- Lazy-loaded portal adapters under `apps/web/src/portals/` for Executive Planner, Organization, Vendor, Rider, Affiliate, Verifier, Consultant and Admin.
- Organization and Rider registration support retained/enabled.
- Rider is no longer rejected by API authentication middleware.
- Executive Planner remains the user-facing name while API/DB role `CLIENT` is unchanged.
- Shared registration role list excludes Executive Planner and Admin.
- Register validation while typing, visible password by default, eye toggle, password checklist, strength hint, confirmation matching and double-submit protection.
- Exact password rule: `At least 8 characters, including a special character.`
- Dedicated planner handoff helper and regression tests for wizard → create-account data preservation.
- Landing page rewritten as visitor-facing marketing copy with no developer/API/routing claims.
- Executive Planner starts from `/plan`; other roles use the shared registration flow.
- Mobile safe-area and dark-blue work from preceding patches are preserved.
- Phase 1 link inventory and completion report.

## Apply

From the ESS repository root:

```bash
bash scripts/apply-042-phase1-complete.sh
```

The script backs up the repository, validates the patch, applies it, runs static Phase 1 acceptance checks, performs a web TypeScript check, and runs web tests when Vitest is installed.

## Validation in the supplied environment

- `git apply --check`: passed.
- Patch application to the reconstructed pre-Phase-1 source: passed.
- Resulting key files match the implemented ESS working tree.
- Web TypeScript syntax check: passed.
- Vitest could not be executed in the supplied checkout because the local Vitest binary is not installed.
- Full production build remains dependent on the repository's installed dependency/type environment.

## Phase boundary

This patch does not claim Phase 2–8 completion. Phase 8 physical deletion remains approval-gated as required by the master specification.
