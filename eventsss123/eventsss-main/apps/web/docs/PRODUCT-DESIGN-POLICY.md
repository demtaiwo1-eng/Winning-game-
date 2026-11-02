# EPHINTA Product Design & Experience Policy

**Status:** Engineering standard  
**Applies to:** Every public page, authenticated workspace, role portal, shared component and Capacitor mobile view.

## Product principles

1. **Clarity before decoration.** Every screen has one clear primary task, an understandable heading and an obvious next action.
2. **Consistency.** Reuse the existing design tokens, component patterns, spacing scale, typography and interaction states. Do not introduce a one-off visual language for an individual module.
3. **Trust.** Never represent a payment, KYC result, booking, balance or verification as successful unless the server confirms it. Explain pending, failed and retry states.
4. **Progressive disclosure.** Ask only for information needed at the current step. Explain why sensitive information is requested and preserve entered data when safe.
5. **Responsive by default.** Layouts must work from 320 CSS pixels upward without clipped controls, overlapping content or unintended horizontal page scrolling.
6. **Accessible by default.** Target WCAG 2.2 AA; semantic HTML, keyboard access, visible focus, meaningful labels, sufficient contrast, reduced motion and accessible status announcements are mandatory.
7. **Performance.** Avoid unnecessary dependencies, oversized media, layout shifts and blocking work. Lazy-load noncritical routes and media where appropriate.
8. **Resilient states.** Every asynchronous screen accounts for loading, empty, success, validation, offline, permission-denied and server-error states as relevant.

## Visual system

- Use the shared tokens in `src/ephinta-product-excellence.css` as the source of truth for foundational colors, spacing, radii, focus and shadows.
- Preserve EPHINTA's established navy foundation with violet primary actions and orange accent actions.
- Use typography with a clear hierarchy: page title, section title, field label, supporting copy and metadata.
- Prefer spacing and alignment over extra borders or decorative elements.
- Keep cards purposeful; do not wrap every item in a card.
- Maintain consistent button hierarchy: one primary action per decision area, secondary actions visually quieter, destructive actions clearly differentiated.
- Use consistent icon sizing and always provide an accessible name when an icon is the only visible control content.

## Page and journey requirements

### Public landing and discovery
- Communicate what EPHINTA does, who it serves and the next step without requiring users to decode jargon.
- Provide clear navigation, trust information, support routes and responsive calls to action.
- Avoid oversized brand artwork that pushes essential content below the fold on mobile.

### Registration, authentication and KYC
- Use short, understandable steps with progress indication and working Back/Continue controls.
- Keep the primary form action visible and reachable on mobile.
- Associate every field with a label; explain validation inline and retain safe form state.
- Ask for country-relevant KYC details only when required by the applicable verification policy.
- Never log credentials, identity documents, tokens or sensitive form values.

### Dashboards and role workspaces
- Prioritize the user's next useful task, important status and relevant summary.
- Navigation labels must be understandable and consistent across roles.
- Empty states must explain how to get started; errors must offer a safe retry where possible.

### Wallet, payments and bookings
- Clearly distinguish available, pending, held and unavailable funds.
- Confirm amount, currency, recipient and action before consequential operations.
- Use server-confirmed transaction state; never fabricate balances, receipts or payment success.
- Make fees, cancellation and refund terms discoverable before confirmation.

### Marketplace and checkout
- Make search, filtering, comparison, seller identity, pricing and availability understandable.
- Explain unavailable inventory and checkout errors without losing the user's selections.
- Do not imply a vendor is verified unless the platform's authoritative state confirms it.

### Administration and support
- Clearly communicate role permissions and the scope of consequential actions.
- Require confirmation for destructive or irreversible actions.
- Provide audit-friendly success and failure feedback without exposing secrets.

## Responsive acceptance matrix

Verify critical journeys at these viewport sizes:

| Class | Viewport |
|---|---:|
| Compact mobile | 320 × 568 |
| Standard mobile | 375 × 812 |
| Large mobile | 430 × 932 |
| Tablet | 768 × 1024 |
| Desktop | 1366 × 768 |
| Large desktop | 1920 × 1080 |

Acceptance: no page-level horizontal overflow; text remains readable; touch targets are preferably at least 44 × 44 CSS pixels; dialogs fit within the viewport; navigation remains usable; forms do not hide their primary actions.

## Accessibility acceptance

- Target WCAG 2.2 AA.
- All functionality is keyboard-operable.
- Focus is visible and not obscured.
- Form controls have programmatic labels and clear error associations.
- Informational images have useful alternative text; decorative images use empty alt text.
- Color is not the only means of conveying state.
- Text and UI contrast meet applicable WCAG AA thresholds.
- Respect `prefers-reduced-motion`.
- Use appropriate landmarks, headings, button names and live regions.

## Engineering and release policy

- Inspect existing routes and components before redesigning them.
- Reuse existing business logic, APIs, authentication and authorization.
- Do not replace working backend integrations with mocks.
- Avoid broad global selectors that break feature-specific layouts.
- Add or update component and end-to-end tests for changed journeys.
- Run frontend tests, production build and the design audit.
- Run visual checks on the viewport matrix and test the Capacitor web view separately.
- Record failures and blocked infrastructure explicitly. A successful build alone is not proof of product quality.

## Definition of done

A screen is complete only when its visual hierarchy, responsive behavior, accessibility, loading/empty/error states and real user actions have been verified. A release is ready only when all critical journeys pass and no unresolved critical or high-severity issue remains.
