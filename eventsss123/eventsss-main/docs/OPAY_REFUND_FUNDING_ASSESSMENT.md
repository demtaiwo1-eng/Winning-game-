# OPay refund funding assessment

## Status

This document defines the accounting gate required before an approved customer refund can be submitted to OPay. It is an implementation specification, not a claim that automated funding assessment or refund settlement is already enabled.

The current refund intake and admin-review routes are deliberately non-financial: they create/audit refund requests but do not call OPay or move wallet or platform-revenue balances.

## Source-of-funds model

A successful wallet-deposit payment intent stores the provider-collected gross amount in `PaymentIntent.amountMinor`. The payment-success transaction then:

1. Calculates the wallet top-up fee using `walletTopupFeeMinor`.
2. Credits only `gross - fee` to the customer's `Wallet.availableMinor`.
3. Appends a `LedgerEntry` with type `DEPOSIT`, `refType = PAYMENT_INTENT`, and `refId = PaymentIntent.id`.
4. Appends the platform fee to `PlatformRevenueEntry` with `refType = PAYMENT_INTENT`, the same payment-intent ID, and idempotency key `platform_wallet_topup_fee:<paymentIntentId>`.

Consequently, a refund of the provider's gross amount has two distinct accounting legs: the wallet's net credit and the platform's fee revenue. They must be reversed together, in one database transaction, only after provider success is authoritatively reconciled.

## Conservative eligibility gate

A refund must remain in manual review unless every check below can be proven from committed database state:

- The original payment intent belongs to the requesting customer, is successful, is an OPay NGN wallet deposit, and its gross amount is positive and within the provider's safe-integer limit.
- Exactly one source wallet deposit ledger entry exists for that payment intent, with a positive amount and the expected idempotency key.
- The wallet still exists, belongs to the payment owner, and has the same currency as the payment.
- The corresponding platform fee journal entry exists when the configured fee is non-zero. Its amount must equal the fee recomputed from the original gross payment using the fee policy that applied to that payment. Missing or inconsistent journal entries are a hard manual-review outcome.
- The original source deposit is still untouched. Until a source-allocation ledger exists, the conservative proof is that no later wallet ledger entry for that wallet exists after the source deposit. This intentionally rejects deposits followed by any subsequent wallet activity, including another deposit, withdrawal, escrow hold/release, adjustment, or other posting. Do not infer that a current wallet balance belongs to this particular payment.
- No active or completed refund reservation for the payment overlaps the amount being assessed. Cancelled/rejected requests may be excluded only after their state transition and audit record are committed.
- The proposed refund amount does not exceed the original gross amount less all non-cancelled reservations, and all partial-refund fee calculations reconcile exactly, including the final refund's rounding remainder.

The conservative "no later ledger entries" check is intentionally restrictive. It is a safe interim eligibility rule, not a scalable allocation model. A later source-allocation ledger can replace it only after its debit/escrow/release paths are comprehensively instrumented and tested.

## Required atomic settlement

Never debit the wallet or reverse platform revenue when merely requesting, reviewing, approving, submitting, or receiving an ambiguous provider response.

After a provider refund is authoritatively confirmed as successful:

1. Lock the original payment intent, refund row, wallet row, and relevant platform revenue account in a consistent lock order.
2. Recheck the refund state, source deposit, fee journal, all reservations, and funding eligibility inside the transaction.
3. Calculate the wallet-net reversal and platform-fee reversal from immutable original-payment amounts and the deterministic partial-refund allocation rule.
4. Ensure the wallet has enough attributable, unencumbered funds. Do not create a negative wallet balance, take funds from another deposit, or release escrow to finance a refund.
5. Append idempotent, source-referenced wallet and platform-revenue reversal entries. Update balances in the same transaction.
6. Mark the refund successful and record the provider's final reference/status and completion timestamp in the same transaction.
7. Make webhook delivery, provider status polling, and retry processing idempotent. Duplicate or out-of-order notifications must not post a second reversal.

If any check fails, record the reason and leave the refund in manual review. Do not call OPay when funding cannot be proven before submission. If OPay has already accepted a request but its outcome is unknown, reconcile by the same provider reference; never submit a second refund merely because a request timed out.

## Required tests before enabling submission

- Original source deposit and matching platform fee are found and exactly reconciled.
- Missing, duplicate, wrong-wallet, wrong-owner, wrong-currency, or mismatched source records fail closed.
- Any subsequent wallet ledger entry causes the conservative interim assessment to require manual review.
- Escrowed, withdrawn, spent, or otherwise encumbered funds cannot be used to fund a refund.
- Concurrent refund requests cannot reserve more than the original gross payment.
- Partial refunds allocate fee minor units deterministically and the final refund absorbs any rounding remainder.
- Provider timeout, duplicate callback, callback-before-poll, poll-before-callback, and repeated success reconciliation produce at most one wallet reversal and one fee reversal.
- Rejected/cancelled requests release reservations only through an audited state transition.
- No refund path creates a negative wallet balance or releases escrow to fund a refund.

## Release gate

The provider adapter, customer request intake, and administrator review workflow do not constitute a complete customer refund workflow. Keep provider submission disabled until the funding assessment, durable allocation/reservation logic, provider outcome reconciliation, and atomic two-ledger settlement are implemented and covered by database-backed tests. Apply and validate the existing refund migrations before deploying any route that reads these models.

## Implemented interim assessment helper

The API contains `refundFundingAssessment.service.ts` and focused unit tests. The helper is read-only and returns a structured eligibility decision. It checks the successful OPay NGN wallet-deposit intent, provider-safe gross amount, unique source deposit ledger row, matching customer wallet, net-credit amount, matching platform-fee journal entry, wallet ledger activity at or after the source-deposit timestamp, and competing active/completed refund requests.

The helper is now called by the admin approval route inside a serializable transaction after locking the original payment-intent row. An eligible untouched full deposit advances to `REQUESTED` for a separate provider/settlement review. An ineligible request remains in `MANUAL_REVIEW` with the reason recorded in both the refund record and review audit note. The helper still rejects partial refunds and any wallet with subsequent or ambiguous same-time ledger activity. This route does not reserve or move funds, submit to OPay, or settle either ledger. The expected fee is recomputed using the current fixed 2% wallet-top-up fee policy. Unit tests have been added, but execution and Prisma/typecheck validation remain outstanding.

## Admin review integration

The admin approval route now locks the original payment-intent row and calls the read-only funding assessment in the same serializable transaction. If the assessment passes, the request advances from `MANUAL_REVIEW` to `REQUESTED`, with an audit note recording that provider submission is still disabled. If any assessment check fails, the request stays in `MANUAL_REVIEW` and the specific reason is stored in the refund record and review audit note. Rejection still cancels the request and records the administrator's decision.

This integration is a pre-submission gate only. It is not a funds reservation or settlement transaction, and it does not call the OPay provider adapter.


## Provider callback and reconciliation status

The existing `/webhooks/opay` handler is for payment transactions. It verifies OPay transaction-status callbacks and deliberately ignores non-success and refunded payment notifications; it is not a refund callback handler. Do not point OPay refund callbacks at that payment handler or treat a payment webhook acknowledgement as proof of refund settlement.

Although `createOpayRefund` and `queryOpayRefund` provider adapters exist, there is not yet a durable refund-submission worker or refund-specific callback processor. In particular:

- `REQUESTED` is a review queue state, not permission for an automatic provider call.
- `SUBMITTING` and `SUBMISSION_UNKNOWN` must not be treated as permission to submit again.
- A timeout after a create request must be reconciled by querying the same `providerRef`; never create a new reference or blindly retry.
- Provider-reported success must remain distinct from internally settled `SUCCEEDED`. Until an explicit provider-success-awaiting-ledger state and atomic two-ledger settlement exist, do not mark a refund `SUCCEEDED` from a callback or query result.
- Refund callback authentication, replay protection, out-of-order event handling, durable provider response capture, and database-backed concurrency tests remain release blockers.


## Provider success is not settlement

The refund lifecycle now includes `PROVIDER_SUCCEEDED_PENDING_SETTLEMENT`. A future callback or status-polling worker may use this state only after authenticating and validating the provider's final success response. It is deliberately distinct from `SUCCEEDED`, which is reserved for the transaction in which EPHINTA has atomically posted both the wallet-net reversal and the platform-fee reversal.

This intermediate state remains an active refund reservation in both the funding assessment and customer refund-intake amount cap. It must not be treated as a completed refund, and it must not permit another refund request to reuse the same original payment amount. The new enum value is introduced by migration `20261118000300_add_provider_success_pending_settlement`.

No callback handler, provider submission worker, or settlement routine is implemented by this schema change. Until those components exist, do not write this state from application code and do not enable OPay refund submission.


## Atomic internal settlement implementation

A settlement service now exists at `apps/api/src/modules/payments/refundSettlement.service.ts`. It accepts only an OPay refund already in `PROVIDER_SUCCEEDED_PENDING_SETTLEMENT`, locks the original payment and wallet rows, reruns the conservative funding assessment, and posts the negative customer-wallet ledger entry and negative platform-fee revenue entry in one serializable database transaction. It uses refund-scoped unique idempotency keys and marks the refund `SUCCEEDED` only after both accounting legs have been written.

The service fails closed if the wallet no longer contains the original net credit, the platform revenue account cannot cover the original fee reversal, or the funding assessment no longer passes. A thrown error rolls back both accounting legs and the status change.

**Important limitation:** this service is not wired to a callback or reconciliation worker. No code currently moves refunds into `PROVIDER_SUCCEEDED_PENDING_SETTLEMENT`, and no OPay refund submission is enabled. It is an internal settlement primitive only; it must be covered by database-backed concurrency and rollback tests before it is called in production.


### Settlement unit-test coverage

A mocked Vitest suite now covers the settlement success path, refusal before provider confirmation, insufficient customer wallet funds, insufficient platform revenue funds, already-settled idempotency, and missing refund records. These tests assert that the completion transition is not written when a required accounting leg cannot be posted. They are unit tests with mocked Prisma transactions; they do not replace database-backed rollback, isolation, or concurrent-execution tests, and have not yet been executed in CI.


## Durable refund reconciliation lease fields

`PaymentRefund` now has nullable `reconciliationLockToken`, `reconciliationLockedUntil`, and `reconciliationDeadLetteredAt` fields, plus indexes for status/lease-expiry and dead-letter lookup. Migration `20261118000400_add_payment_refund_reconciliation_leases` adds these fields without changing existing refund states or claiming existing rows.

These fields are storage primitives only. No worker currently claims refunds, renews leases, increments attempts, dead-letters exhausted work, or calls OPay. A future worker must atomically claim eligible rows with a unique lock token and bounded lease, verify the token before every state update, recover only expired leases, and never re-submit an ambiguous `SUBMITTING`/`SUBMISSION_UNKNOWN` create request. It must reconcile the same provider reference first. Dead-lettering must preserve the financial reservation until an audited operator action resolves it; it must not silently release reserved refund capacity.

Do not enable a worker or provider submission solely because these columns exist. Callback authentication, provider response capture, idempotent event processing, and database-backed concurrency tests remain required.


## Atomic reconciliation claim primitive

`apps/api/src/modules/payments/refundReconciliationClaim.service.ts` now provides a parameterized, single-statement PostgreSQL claim operation. It uses `FOR UPDATE SKIP LOCKED` to claim bounded batches, assigns a fresh lock token and lease expiry, increments the attempt count, and returns the existing provider reference with each claimed row. Only OPay `INITIAL`, `PENDING`, and `SUBMISSION_UNKNOWN` rows are eligible; `REQUESTED`, `MANUAL_REVIEW`, `SUBMITTING`, provider-success-pending-settlement, terminal states, dead-lettered rows, rows not yet due, and rows with an active lease are excluded. A `SUBMISSION_UNKNOWN` row is explicitly query-only and must never trigger a second create request.

This is a claim primitive, not a running worker. It does not call OPay, update retry scheduling, release leases, mark dead letters, process callbacks, or settle balances. A worker must use the returned lock token as a compare-and-set guard for every later update and must reconcile the same `providerRef`. The accompanying unit tests cover returned claims and option validation; SQL concurrency and lease-expiry behavior still require database-backed tests before production use.


### Token-guarded reconciliation lease updates

The reconciliation claim module now also exposes three compare-and-set operations:

- `completeRefundReconciliationClaim` releases a still-valid lease after a status-query cycle without changing the refund lifecycle state.
- `scheduleRefundReconciliationRetry` stores a bounded error message and a future retry time, then releases the lease without changing the provider lifecycle state.
- `deadLetterRefundReconciliationClaim` records a dead-letter timestamp and error, clears the lease, and preserves the refund status and its financial reservation for audited operator resolution.

Every operation requires both the refund ID and the exact lease token, and updates only a lease that has not expired. A stale token, expired lease, or ineligible refund state produces a zero-row update and returns `false`. Error text is limited to 1,000 characters, and retry times must be later than the supplied clock.

These operations are storage primitives only. They do not call OPay, interpret provider responses, authenticate callbacks, or settle funds. Unit tests cover successful compare-and-set updates, stale-token rejection, retry/dead-letter input validation, and the invariant that the provider lifecycle status is not changed. Database-backed concurrency and SQL validation remain outstanding.
