# EPHINTA Customer Funding Accounts — Implementation Blueprint

**Status:** Architecture prepared; provider onboarding and live-money activation remain gated.

## Product outcome

Every eligible EPHINTA customer can have a persistent NGN funding account displayed inside EPHINTA Wallet. The customer copies the bank name, account number and account name, then transfers from any external Nigerian bank. After the provider confirms the transfer server-to-server, EPHINTA credits the customer's existing NGN wallet ledger. The balance can then be used for supported EPHINTA purchases, booking deposits and marketplace payments.

This is a provider-issued virtual/reserved account mapped to an EPHINTA customer. It is not a personal deposit account at EPHINTA and does not mean EPHINTA itself is a bank.

## Recommended provider strategy

1. **Primary evaluation: Paystack Dedicated Virtual Accounts (DVA).** This is the closest match to Chowdeck: Chowdeck's customer help page says it provides dedicated Paystack account details and credits the Chowdeck wallet after transfer confirmation. Paystack supports customer-linked DVAs through its API. Paystack currently documents DVA eligibility for registered businesses in Nigeria/Ghana that have completed go-live; certain business categories, including general services and financial services, require customer identity validation. Paystack's support page currently states a 1% DVA transaction fee capped at NGN 300. Confirm eligibility and commercial terms directly with Paystack.
2. **Strong alternative: Monnify Customer Reserved Accounts.** Monnify explicitly identifies wallet-based businesses as a use case. Each reserved account is associated with a customer. Its reserved-account flow requires BVN or NIN. Sandbox reserved accounts must be tested with Monnify's simulator.
3. **Alternative: Flutterwave Virtual Accounts / Payout Subaccounts.** Flutterwave documents static virtual accounts for wallet funding and NGN payout subaccounts with their own dedicated virtual account. Its wallet/subaccount feature requires production activation; confirm fees, eligibility, settlement and custody arrangements.

Do not activate multiple collection providers for the same customer until reconciliation, duplicate-payment handling and customer support processes are ready. Build a provider interface so a second provider can be added without changing the wallet ledger.

## Customer journey

1. Customer completes EPHINTA registration and required identity/KYC checks for the provider's business category and risk limits.
2. Customer opens Wallet → Add money → Bank transfer.
3. API creates or retrieves one active NGN virtual account for that authenticated EPHINTA user and provider. The account number is stored against the user, not supplied by the browser.
4. App displays bank, account number, account name, provider and transfer instructions. It must state that only provider-confirmed transfers count.
5. Customer sends money from an external bank app.
6. Provider sends a signed webhook to EPHINTA. EPHINTA validates authenticity, event type, account mapping, provider transaction/reference, currency, amount and final successful status. For uncertain or high-risk notifications, EPHINTA verifies through the provider's server-to-server query API.
7. EPHINTA records the provider event exactly once and posts one append-only DEPOSIT ledger entry to the mapped customer's NGN wallet in a database transaction. Replayed webhooks must never credit twice.
8. Wallet balance and transaction history update; customer receives an in-app notification and, where configured, a push notification.
9. Finance/admin reconciliation compares provider collection transactions, EPHINTA payment records, ledger credits and provider settlement reports.

## Critical accounting and safety rules

- Provider-confirmed final transaction—not a screenshot, receipt upload, client redirect or customer assertion—is the only basis for wallet credit.
- Use immutable provider transaction identity and a unique idempotency key for each credit. Atomically claim the incoming event before posting.
- Check exact customer/account mapping, NGN currency, amount received, provider merchant account, transaction status and duplicate/reversal status.
- Do not credit pending, failed, rejected, expired, reversed or unverified transactions.
- Do not assume incoming gross amount equals eventual settlement amount. Store gross amount, provider fees, net settlement and settlement reference separately.
- Underpayments, overpayments, unknown account matches, late transfers and reversals go to an exception/reconciliation queue.
- Keep customer wallet money separate in EPHINTA's append-only ledger from platform revenue, provider fees, escrow and vendor payable balances.
- Wallet spending must debit/hold the customer wallet and create corresponding escrow/vendor/platform journal entries atomically. Vendor payouts remain a separate provider-confirmed workflow.
- No manual admin credit without a permissioned, reasoned, audited adjustment flow.
- Do not expose provider secret keys, BVN/NIN or sensitive KYC data to the client, logs or chat.
- Keep provider secrets only in protected Render environment variables. Use sandbox credentials and provider simulators before live-money testing.

## Proposed implementation against the existing EPHINTA code

The repository already has a per-user, per-currency Wallet, append-only LedgerEntry, PaymentIntent, wallet/ledger APIs, payment provider adapters and webhook verification utilities. The current /wallet/deposit endpoint is explicitly disabled in production and must remain so; it must not be used to fund real customer balances.

Add:
- CustomerFundingAccount: userId, provider, providerCustomerRef, providerAccountRef, bankName, accountNumber, accountName, currency, status and timestamps; unique provider/account reference and one active account per user/provider/currency.
- IncomingTransfer: provider, providerTransactionId, providerReference, fundingAccountId, userId, amountMinor, currency, gross/net/fee amounts when available, status, safe event metadata, receivedAt, verifiedAt and creditedAt; unique provider transaction identity.
- Provider methods to create/retrieve customer-linked static/reserved accounts and verify incoming transfer details.
- Authenticated endpoint to retrieve the current user's funding account and an idempotent account-provisioning endpoint.
- Public provider webhook endpoint with provider-specific signature validation and event replay protection.
- Reconciliation worker/admin report for pending, unmatched, reversed and settlement-mismatched transfers.
- Wallet UI showing funding account details, copy controls, instructions, incoming transfer status and ledger history.
- Automated tests for duplicate webhooks, invalid signatures, mismatched account, amount/currency mismatch, pending/failed/reversed payments, concurrent duplicate delivery, successful credit exactly once and provider outage.

Reuse the existing wallet ledger posting logic where possible; do not create a second balance system or cached balance outside Wallet.

## Release gates

- Confirm EPHINTA's registered-business status, business category and provider go-live eligibility.
- Confirm the provider's wallet/marketplace use case, account naming, KYC requirements, fees, settlement timing, limits, refunds/reversals and support escalation in writing.
- Configure sandbox credentials and webhook secrets privately in Render.
- Test with provider sandbox/simulator and prove a signed, provider-confirmed transfer credits exactly once.
- Complete finance, fraud, privacy and Nigerian regulatory review before holding or representing customer stored value as withdrawable or spendable money. Use an appropriately licensed provider/partner and obtain advice on whether EPHINTA's exact wallet, custody, escrow and payout model requires additional CBN authorization or a different contractual structure.
- Keep live funding disabled until all gates and provider approvals are documented.

## Research sources

- Chowdeck wallet funding: https://help.chowdeck.com/en/articles/6735817-how-do-i-fund-my-wallet
- Paystack DVA docs: https://paystack.com/docs/payments/dedicated-virtual-accounts/
- Paystack DVA API: https://paystack.com/docs/api/dedicated-virtual-account/
- Monnify reserved accounts: https://developers.monnify.com/docs/collections/recurring-payments/reserved-accounts
- Monnify webhooks: https://developers.monnify.com/docs/webhooks
- Monnify transaction verification: https://developers.monnify.com/docs/collections/manage-payments/verify-transactions
- Flutterwave virtual accounts: https://developer.flutterwave.com/docs/virtual-accounts/introduction
- Flutterwave payout subaccounts: https://developer.flutterwave.com/docs/payout-subaccount
- CBN Regulation on Electronic Payments and Collections: https://www.cbn.gov.ng/Out/2019/PSMD/Regulation%20on%20Electronic%20Payments%20and%20Collections.pdf
