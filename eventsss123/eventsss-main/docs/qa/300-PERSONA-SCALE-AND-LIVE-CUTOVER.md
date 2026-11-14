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

## Payment mode and current fee policy

The shared PostgreSQL `PlatformRuntimeSetting` row controls DEMO, TEST and LIVE for every connected web, PWA and native client. The API refreshes this setting before payment/payout requests and fails closed if it cannot verify the setting. See [CENTRAL-PAYMENT-MODE.md](../CENTRAL-PAYMENT-MODE.md).

**Current fee requirements in code:**
- Incoming NGN wallet deposits: fixed 2% fee (200 basis points).
- Outgoing OPay bank withdrawals: fixed 2% fee (200 basis points); the bank receives the net amount.
- Booking commission is a separate business rule and must not be conflated with the wallet-deposit or bank-withdrawal fee.
- Fees are recorded in the platform revenue ledger only at the appropriate confirmed transaction state. Failed or reversed payouts must reverse the associated ledger effects idempotently.

**Provider status:**
- Nigeria NGN collection and bank payouts are routed to OPay; the NGN path must not silently fall back to Paystack, Flutterwave or DEMO.
- OPay has separate TEST and LIVE credential/configuration paths. LIVE is rejected unless the production environment, dedicated OPay live credentials, readiness attestation and approved transfer endpoint are configured.
- OPay's presence in code and mocked tests does not prove merchant approval, live credentials, funded settlement balance or successful real settlement.
- Cleva and Eversend are not implemented in the current provider registry. Keep them disabled until the account owner obtains the exact official API contract, account approval, sandbox credentials and webhook specifications.
- Do not use the legacy payment-mode switching script described in older project notes to activate a different provider or overwrite the agreed fee policy. Use the shared ADMIN payment-mode control only after the provider-specific release gates are satisfied.

A live cutover requires, at minimum:
1. OPay confirms that the EPHINTA merchant account is enabled for the exact collection and bank-transfer products.
2. The owner configures dedicated OPay production credentials and approved production endpoint in Render API secrets/settings; never put them in Vite variables, Git, CI logs or chat.
3. Signed callback/webhook verification, replay protection, server-to-server status reconciliation, idempotent ledger effects, failure refunds, reversals and currency validation pass against OPay's official sandbox test vectors.
4. The owner approves production activation and OPay confirms settlement funding.
5. A low-value, provider-approved live transaction is completed and reconciled against the EPHINTA ledger before broader traffic is enabled.

Never infer production readiness from a mock, synthetic journey, browser redirect, successful CI build or ADMIN mode toggle. Keep real-money movement disabled until every provider-specific acceptance item is evidenced.

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
