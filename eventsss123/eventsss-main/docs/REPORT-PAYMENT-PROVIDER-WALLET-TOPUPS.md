# Provider-Backed Wallet Top-Ups Report

## Changelog

- Wallet deposits now redirect to the hosted Paystack or Flutterwave checkout
  URL when a configured provider initializes successfully.
- Provider initialization failures are surfaced; they no longer become
  successful-looking demo intents.
- Simulated checkout is limited to pending `demo` intents in non-production
  test mode. Live-provider intents cannot be settled through the demo endpoint.
- Provider selection no longer chooses simulated payments for production when
  a supported provider is unavailable, and does not pretend Stripe is enabled.
- Provider callbacks return to the signed-in role dashboard's wallet tab;
  returning to ESS refreshes the wallet and explains that provider
  confirmation/webhook processing may still be pending.
- Disabled the simulated external payout path. It previously deducted wallet
  funds while returning a success-shaped “queued” response without an actual
  bank/mobile-money transfer; payout requests now fail clearly without moving
  funds until a payout adapter exists.
- Updated wallet copy to reflect that deposits use configured checkout and
  that external withdrawals are not enabled.

## Verification

- API build: passed.
- Web build: passed.
- Full API suite: 42 passed, 1 database-dependent test skipped.
- Full web suite: 6 passed.
- Combined delivery script: passed, including both production builds.
- Regression test confirms the unavailable payout path responds without a
  database write.

No provider credentials were read or changed. Live-provider payment could not
be completed without a configured sandbox account and owner-provided test
credentials.

## Phone tap-through checklist

1. Confirm the backend uses `PAYMENT_MODE=test` and only provider **test** keys.
2. Sign in, open Wallet, and request a small wallet top-up.
3. With Paystack/Flutterwave configured, confirm ESS redirects to its hosted
   secure checkout instead of crediting the wallet locally.
4. Complete the provider's sandbox payment and return to the ESS wallet tab.
5. Refresh the wallet if necessary; confirm the provider webhook credits the
   balance only after verification.
6. With no provider keys in a non-production test environment, confirm the
   clearly labelled simulated checkout remains available.
7. In production or `PAYMENT_MODE=live`, confirm missing/failed provider
   initialization does not create a simulated balance.
8. For a vendor, verify wallet copy says external withdrawal is not enabled;
   confirm the payout API does not deduct funds.
9. Confirm marketplace cart checkout still accurately states that it accepts
   wallet payment only.
