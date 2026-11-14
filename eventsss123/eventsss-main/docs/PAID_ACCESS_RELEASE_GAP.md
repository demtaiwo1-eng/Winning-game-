# EPHINTA paid-access release gap and acceptance checklist

**Reviewed:** 2026-11-14  
**Release candidate:** `integration/ephinta-release-candidate-final-20261114`

## Current verified state

The API has a plan catalogue and subscription records. The inspected `POST /api/v1/billing/subscriptions` route checks that a plan is active and belongs to the caller's account audience. It then deliberately rejects every paid plan with HTTP 503 and error code `PAID_SUBSCRIPTIONS_UNAVAILABLE` until verified payment processing is enabled. Zero-cost plans can still create active subscriptions.

This is a fail-closed safeguard. It is **not** a complete purchase flow and does **not** make the entire application purchase-only. The release candidate has no verified end-to-end paid purchase → provider confirmation → entitlement grant path established by the inspected evidence.

## Required implementation before paid-only launch

- [ ] Select the merchant-of-record/provider and approved payment method for subscription purchases. For NGN, confirm the exact OPay product/API permission and merchant account capability.
- [ ] Create server-side checkout intents with immutable amount, currency, plan, account, expiry and idempotency key.
- [ ] Verify provider webhook signatures against raw request bytes, enforce replay protection, and reconcile payment status with provider API before activation.
- [ ] Atomically record payment/ledger evidence and create or extend the subscription only once.
- [ ] Enforce entitlement in API middleware/service policies for every paid feature and sensitive data endpoint; do not rely on frontend route hiding.
- [ ] Keep public landing, sign-in, registration, plan catalogue, checkout, payment callback/webhook and subscription management available to non-subscribers.
- [ ] Define trial/grace period, renewal, cancellation, expiry, failed-payment, refund, chargeback and support/admin override behaviour.
- [ ] Add role/audience-aware plan assignment, owner/admin support access, and audit logs.
- [ ] Build an accessible purchase/upgrade UI with transparent price, renewal period, taxes/fees, terms, refund policy and receipt.
- [ ] Test unpaid, pending, successful, duplicate webhook, forged webhook, expired, cancelled, refunded, wrong-user, wrong-role and concurrent checkout cases.
- [ ] Verify all protected API routes return a consistent 403/402 entitlement error to unpaid accounts while checkout and account recovery remain usable.
- [ ] Complete sandbox tests with merchant-issued credentials stored only in the secret manager. Never test with real customer money without explicit release approval.

## Safety rule

Do not globally deny existing users or activate a hard paywall until the purchase path can actually sell and verify access. Otherwise customers could be locked out without a working way to purchase or restore entitlement.

## Acceptance criteria

The paid-only model is ready only when a new account can select a role-appropriate paid plan, pay through the approved provider, receive a server-verified entitlement, use protected workflows, and lose access at the correct expiry/cancellation point—while unpaid, forged, refunded and cross-account requests are denied. All of these must be demonstrated by automated API/browser tests and provider sandbox evidence.
