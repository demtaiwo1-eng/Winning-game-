# Phase 4.3 — Payment reconciliation and reliability safeguards

## Scope

This phase adds read-only visibility into payment settlement exceptions and makes the existing background reconciliation loop safer to operate.

- Admin-only `GET /api/v1/admin/finance/reconciliation` report.
- Pending payment intents older than a validated threshold (5–1,440 minutes), with a bounded sample of 50.
- Successful wallet-deposit intents checked against their append-only ledger rows.
- Detect missing or duplicate DEPOSIT rows and gross-amount mismatches between the payment intent and DEPOSIT + COMMISSION ledger entries.
- Bound the successful-payment scan to 500 records and explicitly report when the scan is truncated.
- Prevent overlapping in-process reconciliation timer runs and log sanitized run outcomes.

## Safety properties

- The report performs reads only. It does not update payment intents, wallets, ledger rows, webhook records, refunds, or payouts.
- It returns payment intent IDs and provider/currency/amount metadata only; no customer names, email addresses, phone numbers, or user IDs.
- It does not expose provider references or credentials.
- Existing settlement remains gated by provider verification and the atomic PENDING-to-SUCCEEDED claim in the payment transaction.
- OPay remains disabled until merchant credentials and sandbox verification are complete.
- No schema migration, paid Render resource, or destructive database operation is included.

## Admin report

`GET /api/v1/admin/finance/reconciliation?olderThanMinutes=10`

The response contains:
- `stalePending.total` and up to 50 oldest stale pending intents.
- `succeededDepositLedger.scanned`, total succeeded wallet-deposit count, scan truncation flag, and ledger exceptions found in the scanned set.
- `readOnly: true` and a generation timestamp.

A ledger exception is a succeeded wallet-deposit payment intent that does not have exactly one DEPOSIT entry or whose DEPOSIT + COMMISSION ledger amount does not equal the gross payment amount. The report flags exceptions for human investigation; it does not attempt automatic repair.

## Validation

- CI must pass API/web checks, disposable PostgreSQL migration/integration tests, web build, and Android APK build before merge.
- The reconciliation report's auth and filter validation are covered by DB-free tests.
- Production rollout is only considered after the merged commit's Render deployment is confirmed live and a read-only smoke check succeeds.

## Operational limits

The background reconciliation loop is process-local and intentionally does not claim distributed locking across multiple API instances. The atomic payment-intent claim and unique ledger idempotency keys remain the settlement safety boundary. If the service is later scaled horizontally, move scheduling to a single Render cron/worker or add a database-backed lease before relying on a single global scheduler.

## Durable retry queue update

The payment-intent row now carries durable reconciliation scheduling state:
- attempt count and next-attempt timestamp;
- expiring worker lease token to prevent concurrent processing across API instances;
- sanitized last-error category;
- dead-letter timestamp after eight failed attempts.

The worker uses bounded exponential backoff (one minute base, six-hour cap) and provider verification requests time out after 15 seconds. It never stores provider response bodies or raw error messages in the retry metadata. Existing atomic PENDING-to-SUCCEEDED settlement and unique ledger idempotency keys remain the wallet-credit safety boundary.

Admins can inspect a bounded dead-letter sample in the finance reconciliation report and request an audited replay. Replay only requeues the pending payment intent; it does not itself settle or credit funds. Provider verification must still succeed before settlement.

## Additional validation

- Retry schedule and sanitized error persistence have unit tests.
- CI must validate the new migration against disposable PostgreSQL and build API/web/Android before merge.
- The in-process timer remains a scheduler trigger, but the durable database lease and retry state survive restarts and coordinate concurrent instances. For a future larger deployment, move the trigger to a single cron/worker service.

