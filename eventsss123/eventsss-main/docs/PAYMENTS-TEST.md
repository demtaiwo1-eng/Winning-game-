# ESS Payments Test Mode

Phase 3 starts with webhook security and explicit payment-mode separation.

## Configuration

Set `PAYMENT_MODE=test` until real production credentials are intentionally enabled. Never commit secrets.

- Paystack test keys: use the provider's current test-key documentation.
- Flutterwave test keys: use the provider's current sandbox documentation.
- Stripe test keys: use the provider's current test-key and webhook-signing documentation.

The API rejects an obvious live key while `PAYMENT_MODE=test`, and rejects an obvious test key while `PAYMENT_MODE=live`.

## Webhooks

Provider webhook endpoints are under:

`/api/v1/payments/webhooks/paystack`
`/api/v1/payments/webhooks/flutterwave`
`/api/v1/payments/webhooks/stripe`

Paystack requests are checked with the raw-body HMAC signature. Flutterwave requests are checked against the configured verification hash. Stripe remains fail-closed until the Stripe adapter's signed timestamp format is implemented.

## Codespaces

Expose the API port publicly and use the forwarded API URL as the provider webhook base. Do not paste secrets into source control.

## Safety

Demo mode must not be treated as real settlement. The UI displays a persistent test-mode notice. Offline clients must never authorise, capture, release or refund money.
