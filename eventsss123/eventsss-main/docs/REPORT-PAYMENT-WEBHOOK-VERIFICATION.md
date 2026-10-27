# Payment webhook settlement verification

## Changelog

- Hardened Paystack signature verification and Flutterwave secret comparison using constant-time checks.
- Required a locally known payment intent, then queried the provider before any webhook can settle a payment.
- Matched provider-confirmed transaction reference, success status, amount, and currency to the stored intent.
- Rejected missing provider credentials and provider HTTP failures rather than returning demo-shaped verification success.
- Avoided floating-point rounding when converting Flutterwave decimal amounts to minor currency units.

## Verification

- API TypeScript build — passed.
- API tests — 24 passed, 1 skipped (database-dependent).
- Webhook helper tests cover signatures, provider verification field matching, and exact decimal conversion.

Webhook settlement against Paystack/Flutterwave sandbox keys, and the skipped database test, still require configured provider/database environments. No live payment was submitted.

## Phone tap-through checklist

1. Using provider sandbox credentials, complete a test payment and verify the provider webhook reaches the configured API URL.
2. Confirm a provider event with an unknown reference is rejected and does not credit the wallet.
3. Confirm an amount or currency mismatch is rejected and does not credit the wallet.
4. Replay the same valid webhook and confirm settlement is idempotent.
