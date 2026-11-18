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

The API now contains `refundFundingAssessment.service.ts` and focused unit tests. The helper is read-only and returns a structured eligibility decision. It checks the successful OPay NGN wallet-deposit intent, provider-safe gross amount, unique source deposit ledger row, matching customer wallet, net-credit amount, matching platform-fee journal entry, wallet ledger activity at or after the source-deposit timestamp, and competing active/completed refund requests.

The interim helper intentionally rejects partial refunds and any wallet with subsequent or ambiguous same-time ledger activity. It is not yet wired to the customer/admin routes, does not reserve funds, does not submit to OPay, and does not settle either ledger. The caller must invoke it inside a transaction after locking the payment-intent row and must compute the expected fee using the fee policy applicable to the original payment. Unit tests have been added, but execution and Prisma/typecheck validation remain outstanding.
