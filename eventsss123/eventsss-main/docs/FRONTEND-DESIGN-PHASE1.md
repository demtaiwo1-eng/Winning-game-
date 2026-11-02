# EPHINTA Unified Front-End Design — Phase 1

## Delivery scope
This increment establishes the shared premium-hybrid visual foundation for the active web/native application. It deliberately does not replace the API, authentication, route graph, event workflows, wallet, payment, KYC or offline behavior.

## Active entry points verified
- `apps/web/src/main.tsx` mounts `EnterpriseApp` and loads the shared styles.
- `apps/web/src/EnterpriseApp.tsx` is the active application shell.
- `apps/web/src/components/LandingPageFunctional.tsx` is the active landing implementation.
- `apps/web/src/styles/event-planner-registration.css` contains the existing registration layout and compact logo/navigation rules.
- `apps/web/src/enterprise.css` contains the active signed-in portal shell and dashboard component styles.
- `apps/web/src/App.tsx` is a legacy, unmounted shell and is not the redesign target.

## Changes in this increment
- Added `styles/ephinta-unified-design-system.css`.
- Loaded the shared design system after existing styles to establish a predictable final token and component layer.
- Defined hybrid brand, semantic, surface, radius, shadow, motion and touch-target tokens.
- Aligned active portal accents, status states, cards, authentication branding and landing-page accents.
- Added mobile layout refinements for dashboard grids and registration navigation.
- Added reduced-motion and focus-visible support.

## Design rules
- Midnight navy is the signed-in product frame.
- Violet is the brand/selection accent.
- Warm orange is reserved for primary actions and meaningful emphasis.
- Light surfaces are used for public content and review-oriented forms where already designed that way.
- Existing logo assets and application behavior are preserved.
- No placeholder business, financial, KYC or analytics data is introduced.

## Verification status
Source-level change only. A successful GitHub Actions run, browser screenshots, role-by-role interaction tests and physical Android testing are still required before this phase can be marked fully verified. The design layer is intentionally additive to reduce regression risk.
