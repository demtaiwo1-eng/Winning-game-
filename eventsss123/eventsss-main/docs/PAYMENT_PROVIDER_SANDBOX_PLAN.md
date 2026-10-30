# EPHINTA Payment Provider Sandbox Integration Plan

Status: implementation plan and initial audit, 2026-10-30
Target service: Render Free API service ephinta_wss
Default posture: sandbox only; all provider switches off until credentials and endpoint details are verified.

## Existing payment foundation

The API already has:
- A provider adapter module at apps/api/src/modules/payments/providers.ts for Paystack, Flutterwave, and a Stripe-ready path.
- Payment-intent creation and wallet-deposit settlement in payments.routes.ts.
- Raw-body webhook verification and provider-side verification before wallet credit.
- Atomic pending-intent claims, unique ledger idempotency keys, and scheduled pending-payment reconciliation.

The first integration must extend this foundation. Do not introduce a second wallet, payment-intent table, or settlement path.

## Shared provider contract

Each adapter should expose capabilities explicitly:
- collect: create a payment intent, verify status, process notification
- payout: validate beneficiary, create payout, verify payout status
- refund: refund an eligible settled collection, verify refund status
- fx: quote a conversion, execute only after explicit confirmation, verify result

A provider must return unsupported for a capability it has not documented or enabled. Never emulate a payout, refund, or FX transfer.

All provider calls must originate from the API server, use HTTPS and server-side secrets, use unique references/idempotency keys, independently verify provider status, match reference/amount/currency/transaction identity, and be retry-safe without logging credentials or sensitive payment data.

## OPay

Initial target: OPay Checkout / international payment API sandbox.
- Sandbox payment API documented at https://sandboxapi.opaycheckout.com/api/v1/international/cashier/create.
- OPay Cashier creation uses the merchant Public Key with MerchantId; status/refund APIs use HMAC-SHA512 signatures with the merchant Secret Key and MerchantId. Callback notifications have their own HMAC-SHA3-512 signature.
- Payment status and refund operations have separate signed API requests.
- Refunds should be supported only after the original payment is verified and provider confirms eligibility.
- Payout and FX are not assumed available under the same Checkout credentials; require OPay product/API approval and endpoint documentation before enabling either.

Proposed Render variables:
- OPAY_ENABLED=false
- OPAY_MODE=sandbox
- OPAY_MERCHANT_ID
- OPAY_PUBLIC_KEY (only if required by the selected OPay API product)
- OPAY_SECRET_KEY
- OPAY_API_BASE_URL=https://testapi.opaycheckout.com
- OPAY_WEBHOOK_SECRET only if OPay supplies a separate webhook signing secret; otherwise use the documented signature scheme.

Never place OPay secrets in source code, GitHub Actions, client-side config, or Android assets.

## Eversend

Eversend Merchant API access and sandbox credentials must be approved by Eversend. Its documentation describes API IP allowlisting. Confirm sandbox calls can originate from the existing Render Free service without a paid static outbound IP or changes to the database IP allowlist.

Proposed Render variables (final names must match the approved API product):
- EVERSEND_ENABLED=false
- EVERSEND_MODE=sandbox
- EVERSEND_CLIENT_ID
- EVERSEND_CLIENT_SECRET
- EVERSEND_API_BASE_URL (only the confirmed sandbox URL)
- EVERSEND_WEBHOOK_SECRET (only if issued)

Implement collect, payout and FX only where the approved Merchant API exposes those exact operations. Refunds require a documented refund endpoint or supported compensating transfer workflow approved by Eversend; do not assume one exists.

## Cleva

Account type is currently unknown. Confirm business/merchant API eligibility and obtain Cleva's current API specification, sandbox base URL, authentication method, webhook signing instructions, supported currencies, and supported operations before writing an adapter.

Potential Render variables, only after Cleva confirms the authentication scheme:
- CLEVA_ENABLED=false
- CLEVA_MODE=sandbox
- CLEVA_ACCOUNT_TYPE
- CLEVA_CLIENT_ID (if issued)
- CLEVA_CLIENT_SECRET (if issued)
- CLEVA_API_KEY (if issued instead)
- CLEVA_API_BASE_URL
- CLEVA_WEBHOOK_SECRET (if issued)

Do not invent endpoint URLs or credentials. Keep Cleva unavailable until its API contract is confirmed.

## Global safety controls

Initial configuration intent:
- PAYMENTS_ENABLED=false
- PAYMENTS_MODE=sandbox
- PAYMENTS_LIVE_ENABLED=false

Wire these controls into the API's existing PAYMENT_MODE validation rather than adding unused settings. Existing Paystack/Flutterwave behavior must not be weakened.

No Render environment changes are part of this initial code work. Add provider credentials only after provider sandbox access is approved and code is ready to test. Do not set production keys, enable live money movement, change Render plans, or change database IP allowlists.

## Test and release gates

1. Unit-test request signing, mode guards, amount conversion, and response parsing.
2. Test successful, failed, pending, timed-out, malformed and replayed responses.
3. Test duplicate webhook delivery and duplicate API retries.
4. Test provider verification mismatch for reference, amount and currency.
5. Test partial/full refund boundaries and payout/FX authorization boundaries.
6. Run API typecheck, unit tests, database tests where available, and CI.
7. Keep live functions disabled until provider joint testing and owner approval.