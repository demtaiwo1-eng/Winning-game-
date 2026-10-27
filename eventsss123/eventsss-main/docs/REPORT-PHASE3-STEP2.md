# ESS Phase 3 Report — Step 2: Cart + CheckoutSession

## Status

Phase 3 Step 2 is prepared against the uploaded current repository state.

## Important repository audit finding

The uploaded current tree already contains the Phase 3 payment-security files and documentation, but it does **not** contain the Phase 2 `EventPlanAnswer` / `eventEssentials` source files. The older 005/006 patches are therefore not treated as authoritative for this tree.

This Step 2 patch does not overwrite or fabricate the missing Phase 2 implementation. It integrates with the payment, wallet, booking, marketplace and existing vendor-verification models that are actually present.

## Changes

- Added persistent `Cart` and `CartItem` models.
- Added persistent `CheckoutSession` and `CheckoutItem` snapshot models.
- Linked optional checkout sessions to `PaymentIntent`.
- Added cart endpoints:
  - `GET /api/v1/checkout/cart`
  - `POST /api/v1/checkout/cart/items`
  - `PATCH /api/v1/checkout/cart/items/:itemId`
  - `DELETE /api/v1/checkout/cart/items/:itemId`
- Added checkout endpoints:
  - `POST /api/v1/checkout/checkout-sessions`
  - `GET /api/v1/checkout/checkout-sessions/:id`
  - `POST /api/v1/checkout/checkout-sessions/:id/pay-with-wallet`
  - `POST /api/v1/checkout/checkout-sessions/:id/cancel`
- Checkout snapshots listing title, vendor, quantity, unit price and currency so later listing edits cannot silently change an open checkout.
- Enforced one currency per cart/checkout.
- Enforced active-listing checks.
- Enforced verified-vendor gating before cart/checkout/payment.
- Enforced event ownership when an event is attached to the cart or checkout.
- Added 30-minute checkout expiry.
- Added atomic batch booking from a checkout session.
- Batch booking uses existing wallet escrow and append-only ledger entries.
- Uses BigInt minor units only.
- Added web `checkoutApi` client types and methods.
- Added payment webhook raw-body capture to the application middleware because the existing payment-security routes expected `req.rawBody`.

## Financial safety

The checkout does not invent a second money ledger. It uses the existing Wallet + LedgerEntry + Booking + escrow flow.

External provider settlement remains separate from this step. A customer can fund the existing wallet using the established payment-intent flow, then atomically convert the checkout into bookings and escrow holds.

## Validation

Patch was applied successfully to a clean copy of the uploaded tree with:

- `git apply --check`
- `git apply`
- `git diff --check`

Dependency-backed Prisma/build/test gates could not be executed here because the uploaded tree does not contain installed `node_modules`. The supplied apply script runs the real Prisma generation/migration, API build, web build and tests in Codespaces and automatically restores the backup if a gate fails.

## Next

Phase 3 Step 3 should connect external payment intents directly to CheckoutSession settlement, then harden escrow release/refund/cancellation state transitions and receipts.
