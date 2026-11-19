# EPHINTA US$60 source-access checkout (Paystack)

## Current implementation boundary

The API has a dedicated, authenticated source-access order flow. It is deliberately separate from EPHINTA wallets, booking deposits, vendor payments and marketplace ledgers.

- Product identifier: `EPHINTA_SOURCE_ACCESS_60`
- Server-owned price: USD 60.00 (6,000 cents)
- Payment provider: Paystack hosted checkout
- Initial environment: test mode only
- Order states: `PENDING`, `PAID_PENDING_RELEASE`, `CANCELLED`
- Payment completion: verified server-to-server with the Paystack transaction verification endpoint and exact reference, amount and currency matching.
- Duplicate webhook deliveries: safe; only a pending order can transition to paid.
- The API never trusts the browser redirect as proof of payment.

## API endpoints

- `POST /api/v1/source-access/orders` — authenticated buyer creates a fixed-price Paystack test checkout.
- `GET /api/v1/source-access/orders/:reference` — authenticated buyer reads only their own order.
- `POST /api/v1/source-access/webhooks/paystack` — Paystack-signed webhook; records successful payment as awaiting package release.

The raw request body is retained only for webhook signature verification. Webhook signing uses `PAYSTACK_WEBHOOK_SECRET` when configured, otherwise the Paystack API secret as the legacy signature secret.

## Render API environment

Set these only in the API service's secret environment settings:

- `PAYMENT_MODE=test`
- `PAYSTACK_SECRET_KEY=sk_test_...`
- `PAYSTACK_WEBHOOK_SECRET=...` (if Paystack supplies a separate webhook signing secret)
- `SOURCE_ACCESS_CHECKOUT_ENABLED=true` only when test checkout is ready to be exercised.
- `API_BASE_URL=https://<your-api-host>`
- `APP_BASE_URL=https://<your-web-host>`

Never put secret keys in the web app, mobile bundle, GitHub files, chat, or buyer package. Do not configure live keys or set payment mode to live for this source-access product.

## What is intentionally not enabled

A successful payment is recorded as `PAID_PENDING_RELEASE`, not as an active download entitlement. The repository is currently public, IP/contributor clearance and the buyer licence still need approval, and no private release artifact or gated download service has been approved. This endpoint does not send a GitHub invitation or expose a download URL.

Before live sales: obtain Paystack activation and international-payment approval for the digital product, complete ownership/contributor and third-party licence checks, obtain legal approval of the buyer licence and refund terms, publish a sales page, move the package to a private controlled release store, implement short-lived download entitlement issuance/revocation, and test refunds/chargebacks and webhook reconciliation.
