# Phase 4 — Operations, Risk, Reliability and Scale

## Status and non-goals

This is the Phase 4 implementation plan. It does not activate live payments, payouts, refunds, FX, campaign billing, or new paid infrastructure. All payment providers remain disabled unless separately sandbox-tested and explicitly approved. Render Free remains the deployment target. Do not change database IP allowlists or existing database access policy.

## Delivery sequence

### 4.1 Financial operations (read-only first)
- Build an admin-only finance overview from the existing immutable wallet ledger and payment-intent records.
- Show pending, succeeded, failed, and reconciled payment counts and amounts by provider/currency.
- Add date/provider/status filters and CSV export with audit logging.
- Reconcile provider status against local intents without creating wallet credits unless the existing atomic settlement path verifies the exact reference, amount, and currency.
- Do not expose secret keys, raw authorization headers, or full webhook secrets in logs or UI.

Acceptance: read-only dashboard tests, admin authorization tests, pagination, and ledger totals matching database aggregates.

### 4.2 Risk and approvals
- Introduce explicit approval states for sensitive administrative actions.
- Require maker-checker separation for future payouts/refunds: requester and approver must be different accounts.
- Add configurable transaction limits and immutable audit events.
- Keep payout/refund execution disabled until provider capability, accounting entries, idempotency, reversal behavior, and sandbox tests are documented.

Acceptance: authorization matrix, separation-of-duties tests, replay protection, and audit completeness.

### 4.3 Reliability
- Add a durable retry/reconciliation queue using existing database primitives before introducing Redis or paid services.
- Use bounded exponential backoff, dead-letter state, operator replay, and per-provider rate limits.
- Add webhook delivery observability without storing credentials or sensitive payment data.
- Add readiness checks for database and provider configuration; provider outages must not block wallet reads.

Acceptance: retry/idempotency tests, provider timeout tests, duplicate webhook tests, and operational runbook.

### 4.4 Multi-currency and FX readiness
- Keep currency balances separate; never infer or silently convert currency.
- Add a quote/lock/expiry model only after a provider's documented FX API and commercial approval are available.
- Record source, quote ID, rate, fees, expiry, and final settlement reference.
- Eversend requires confirmed API access and Render Free outbound-IP compatibility. Cleva requires account eligibility and a current API contract. OPay FX/payouts are out of scope until separately documented.

Acceptance: currency isolation tests and deterministic quote-expiry tests before any conversion feature is enabled.

### 4.5 Admin experience and mobile operations
- Consolidate payment intents, ledger entries, promotions, provider health, and audit events into role-protected admin screens.
- Optimize responsive layouts for Android mobile browsers.
- Keep sensitive actions behind confirmation, permissions, and audit records.

Acceptance: mobile viewport tests, accessibility checks, and role-based UI/API tests.

## Required engineering gates

1. Final-head CI (API, web, migration, Android build where applicable).
2. Disposable PostgreSQL migration and integration tests.
3. Authorization and tenant-isolation tests.
4. Concurrency/idempotency tests for every money-moving path.
5. Provider sandbox evidence before enabling any provider.
6. Staging journey and owner sign-off before production activation.
7. Render Free resource budget and database-expiry/backup continuity check.

## Explicitly deferred

- Live payouts, refunds, FX, provider failover that can move funds, campaign spend drawdown, paid Render services, database allowlist changes, and production feature flags.
