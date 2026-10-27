# Marketplace cart and wallet checkout

## Changelog

- Replaced the marketplace's immediate booking request with the existing API-backed cart flow.
- Added quantity edits, item removal, subtotal, event association, and checkout-session review.
- Added wallet payment through the existing checkout API; successful payment reports booking IDs and confirms escrow placement.
- Displayed the session expiry, cancellation/review action, insufficient-funds wallet route, and escrow/release explanation.
- Kept checkout method disclosure honest: marketplace checkout currently supports wallet only; direct provider/card checkout at the cart is not integrated.

## Verification

- Web production build — passed.
- Web tests — 6 passed.
- TypeScript diagnostics on changed files — no errors.
- Existing API route contract was inspected and reused; no API/schema changes were made.

## Phone tap-through checklist

1. Sign in as an executive planner and open Marketplace.
2. Choose an event (or leave it unlinked), then add a verified listing to the cart.
3. Increase/decrease quantity and remove an item; confirm subtotal and item count track changes.
4. Review checkout and confirm the amount, expiry, wallet-only payment disclosure, and escrow explanation.
5. With enough test wallet balance, pay and confirm success plus booking IDs; verify the cart clears.
6. With insufficient balance, select **Add wallet funds**. In configured provider mode, complete hosted provider checkout; in non-production test mode without provider keys, use the explicit simulated checkout. Return to the wallet tab and retry after the webhook credits the balance.
7. Confirm the resulting booking appears on the event's readiness/verifier flow.

Marketplace checkout still advertises wallet payment only; direct card/provider payment at the cart is not integrated. Hosted Paystack/Flutterwave wallet top-ups use provider checkout and webhook verification when test keys are configured. Physical-device and provider sandbox transactions still require owner verification.
