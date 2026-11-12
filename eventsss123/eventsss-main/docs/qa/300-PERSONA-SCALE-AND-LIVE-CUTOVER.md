# EPHINTA 300-persona QA and release hardening

## What the one-command suite covers

Run from `eventsss123/eventsss-main`:

```bash
npm run qa:scale:plan
QA_SCALE_CONFIRM=YES DATABASE_MODE=local npm run qa:scale
```

The suite provisions **300 distinct test identities in a disposable database**:
- 100 CLIENT accounts, each creating a different event draft with varied event type, guest count, budget and Nigerian city.
- 100 VENDOR accounts, each verifying its own vendor profile exists and is accessible.
- 100 VERIFIER accounts, each accessing the verifier queue; CLIENT access to the verifier-only queue must be rejected.
- It checks event ownership boundaries and performs a bounded 100-session verifier queue read burst.

The runner then executes API/web checks, the production web build, strict design-quality audit and Playwright end-to-end regression. It writes `artifacts/ephinta-scale-qa-report.json`.

## Safety requirements

- Use a fresh, disposable PostgreSQL database. Never point this suite at production.
- The runner refuses `NODE_ENV=production`, `DATABASE_MODE=online`, and managed database URLs.
- The test does not initialize real payment intents, payouts, refunds, or provider callbacks.
- It creates synthetic accounts and events, then removes the generated user rows after the database test.
- This is a functional/concurrency smoke test, **not** a 50-million-transaction capacity certification. That requires a dedicated load-test environment, provider-approved traffic, capacity targets, observability, and an agreed ramp schedule.

## Demo-to-live payment mode

The API uses server-side `PAYMENT_MODE=test|live`. EPHINTA's confirmed fee policy is two independent 1% fees: `WALLET_TOPUP_FEE_BPS=100` on successful wallet funding, and `BOOKING_COMMISSION_BPS=100` on completed booking settlement (100 basis points = 1% each). The legacy `COMMISSION_BPS` remains a fallback for existing deployments only. Staging is configured for test mode; the guarded mode-switch script sets both explicit fee variables to 100. Production settings remain unchanged until a separately approved live cutover.

Use the guarded one-command Render switch from the repository root. Set `RENDER_API_KEY` in a private shell/CI secret store; never commit it:
```bash
EPHINTA_RENDER_TARGET=staging npm run payments:mode -- demo
```
For live, use the production target and complete every explicit cutover approval required by the script:
```bash
EPHINTA_RENDER_TARGET=production EPHINTA_LIVE_PROVIDER=paystack EPHINTA_LIVE_CUTOVER_APPROVED=YES EPHINTA_LIVE_PROVIDER_APPROVED=YES EPHINTA_LIVE_CREDENTIALS_VERIFIED=YES EPHINTA_LIVE_WEBHOOKS_VERIFIED=YES EPHINTA_LIVE_RECONCILIATION_VERIFIED=YES EPHINTA_LIVE_IDEMPOTENCY_VERIFIED=YES npm run payments:mode -- live
```
The script accepts only Paystack or Flutterwave for live mode; OPay is sandbox-only, Cleva/Eversend adapters are not present, and Stripe checkout is disabled. It checks for the appropriate live secret-key prefix without printing the key. The script changes payment mode, production-test opt-in, the legacy fallback, and both explicit 1% fee variables, then requests a Render deploy.

**Fee policy confirmed:** charge 1% separately on successful wallet top-ups and completed booking settlement. These are separate transaction events: a top-up fee reduces the net wallet credit, while the booking commission is withheld from the vendor's escrow release. Do not deduct the booking commission from the customer a second time at booking checkout. The two fee rates are independently configurable as `WALLET_TOPUP_FEE_BPS` and `BOOKING_COMMISSION_BPS`; both are set to 100 bps in staging. The fee policy is not a live-payment approval.

A live cutover is a controlled backend configuration change, not a frontend switch:

1. Confirm a live-capable provider adapter is implemented and approved. OPay in this repository is explicitly sandbox-only; it must not be treated as a live provider.
2. Configure that provider's live credentials as Render backend secrets (never as `VITE_*` variables).
3. Set the Render API service environment variable `PAYMENT_MODE=live` and redeploy the API.
4. Run a low-value provider-approved live verification and reconcile the provider transaction against the EPHINTA ledger before opening traffic.

A single environment variable selects the backend mode, but it does not make an unsupported provider live-capable. Do not switch production to live until the provider adapter, webhook verification, idempotency, reconciliation, refund and payout paths are independently verified.

## Capacity target: 50 million transactions

A 50M transaction target must be defined as a time-windowed throughput and business-volume target (for example, 50M per month vs per year). Before a production load test, define:
- sustained and peak transactions/second, burst duration, read/write mix and concurrency;
- p95/p99 latency and error-rate SLOs;
- database connection-pool, indexes, queue, webhook and ledger write capacity;
- idempotency/replay tests, duplicate webhook delivery, out-of-order callbacks and reconciliation;
- provider rate limits, settlement windows, fees, dispute/refund handling and operational staffing.

Do not load-test live payment endpoints with synthetic money. Use provider sandboxes and an isolated database.

## Test limitations

The 300-account suite exercises real API/database code. Playwright tests use the repository's existing isolated API fixtures where configured; they do not create real external provider transactions. Passing this suite is a release gate, not proof of regulatory compliance, payment-provider approval, or production capacity.
