# EPHINTA Phase 3 Payment Integrations and Phase 4 Readiness

Date: 2026-10-30
Status: Phase 3 implementation in progress; Phase 4 preparation only.

## Phase 2 — Promotions

Phase 2 work exists on branch ephinta/phase-2-promotions (PR #3) and is not assumed merged. It includes vendor campaign drafts, admin approval controls, NGN wallet-funded campaign budgets, atomic wallet debits, idempotency keys, audit records and basic tracking endpoints.

Known Phase 2 follow-up gates before production activation:
- Authenticated database integration tests for vendor isolation, concurrent campaign payments, insufficient funds, admin-only approval and state transitions.
- Refund/cancellation policy and settlement, scheduled expiry/status reconciliation, and attribution deduplication/bot resistance.
- Connect public campaign cards to tracking endpoints and test vendor/admin journeys.
- Keep PROMOTIONS_WALLET_PAYMENTS_ENABLED disabled until owner sign-off and all gates pass.

## Phase 3 — Payments and settlement

Phase 3 is the current workstream. Existing foundations include provider verification, webhook signature checks, wallet payment intents, atomic payment-intent claims, unique ledger idempotency keys, checkout sessions and escrow policy checks.

Current OPay sandbox implementation branch: ephinta/opay-sandbox-collection.

OPay scope currently being implemented:
- Hosted cashier collection for NGN using the documented sandbox cashier create endpoint.
- Query payment status with HMAC-SHA512 signature authentication before wallet settlement.
- Signed callback validation and independent status query; callback itself is never treated as proof of payment.
- Strict HTTPS and cashier-host validation.
- Refund API preparation follows only after a verified original payment and refund ledger/state model are in place.

Not yet complete or enabled:
- OPay refund request and refund-status integration, including atomic refund accounting and partial-refund rules.
- Payout and FX: not assumed to be supported by the OPay Checkout product; require product-specific API approval and documentation.
- Eversend adapter: wait for approved sandbox credentials and confirm IP allowlisting works with Render Free outbound networking.
- Cleva adapter: wait for account classification, merchant API eligibility, sandbox specification and confirmed operations.
- Provider-specific database-backed replay/concurrency tests and full CI pass.

Safety posture:
- No provider credentials are stored in GitHub.
- No Render environment variables have been changed.
- No live payments, payouts, refunds or FX transfers are enabled.
- No Render plan or database IP allowlist changes.
- Existing wallet settlement must remain atomic and idempotent.

## Phase 4 — Platform finance, operations and scale readiness

Phase 4 preparation checklist (planning only; do not activate automatically):
1. Finance operations: unified transaction ledger views, settlement reconciliation, provider fee reporting, payout batches, refund queues and exception handling.
2. Risk and compliance: recipient/beneficiary verification, role-based payout approval, limits, velocity checks, dispute handling, audit trails and data retention.
3. Multi-currency: FX quote snapshots, quote expiry, explicit customer confirmation, transparent fees/rates, conversion ledger entries and reconciliation.
4. Reliability: provider circuit breakers, bounded retries, idempotency, dead-letter/manual review queue, webhook replay tooling and alerts.
5. Admin experience: payment/provider health, transaction search, refund/payout approvals, settlement reports and reconciliation exports.
6. Test coverage: end-to-end sandbox tests, duplicate/reordered webhooks, provider timeouts, partial refunds, concurrent payouts, FX rounding and ledger invariants.
7. Deployment: staged feature flags, sandbox-only configuration, operational runbook, backup/restore rehearsal and explicit owner approval before any live switch.

Phase 4 must not begin live money movement until Phase 3 provider integrations, financial ledger invariants, reconciliation and compliance gates are accepted.