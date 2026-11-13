# External bank withdrawals (Nigeria)

EPHINTA's first external payout adapter uses Paystack's Nigerian bank-transfer API.

## Safety and funding

- Only NGN bank accounts are enabled by this adapter.
- The API resolves the account number and bank code before creating a Paystack transfer recipient.
- The complete account number is never stored. Payout records retain only the verified account name and last four digits.
- The wallet reserves the gross withdrawal amount atomically. The vendor receives the net amount after the 2% outgoing fee.
- The 2% fee is posted to the platform revenue ledger only after Paystack confirms success.
- Failed transfers refund the gross wallet debit. Reversed transfers refund the debit and append a negative platform-fee journal entry.
- Paystack transfers are funded from the merchant's Paystack balance; an internal EPHINTA wallet balance does not itself guarantee sufficient Paystack settlement liquidity.
- Signed `transfer.success`, `transfer.failed`, and `transfer.reversed` webhooks are handled on the existing `POST /api/v1/payments/webhooks/paystack` endpoint. Payout status can also be reconciled by reading `GET /api/v1/payments/payouts/:id`.

## Render environment

Configure these values on the API service in Render (never commit credentials):

| Variable | Test | Live |
| --- | --- | --- |
| `PAYSTACK_SECRET_KEY` | Paystack test secret key (`sk_test_...`) | Paystack live secret key (`sk_live_...`) |
| `PAYSTACK_WEBHOOK_SECRET` | Dedicated Paystack webhook signing secret (`whsec_...`) | Dedicated Paystack webhook signing secret (`whsec_...`) |
| `PAYMENT_MODE` | `test` | `live` |
| `PAYSTACK_TRANSFERS_ENABLED` | `true` only after transfer access is enabled for the Paystack integration | `true` only after Paystack live transfer approval and funding checks |
| `PAYOUT_FEE_BPS` | `200` | `200` |
| `ALLOW_PRODUCTION_TEST_MODE` | `true` only for an intentional production-hosted sandbox test | `false` |

Set `PAYSTACK_WEBHOOK_SECRET` from Paystack Dashboard → Developers → API configuration. The API validates the timestamped `Paystack-Signature` header (300-second clock tolerance) using the raw request body; legacy `x-paystack-signature` remains supported during migration. Set the webhook URL to `https://YOUR_API_HOST/api/v1/payments/webhooks/paystack` and enable transfer success, failed, and reversed events. Signed `ping` events are acknowledged with HTTP 200.

Do not switch to live mode until Paystack has enabled transfers for a registered business, live credentials and the webhook signing secret are installed securely, the merchant Paystack balance is funded, and end-to-end test payouts have been reconciled. Paystack checks business eligibility, payout holds, recipient validity, transfer limits, and available balance plus provider fees. The API refuses to use a test key in live mode or a live key in test mode.

## API

1. `GET /api/v1/payments/payouts/banks` — list active Nigerian banks.
2. `GET /api/v1/payments/payouts/resolve-account?accountNumber=0123456789&bankCode=058` — verify the destination and return its account name.
3. `POST /api/v1/payments/payouts` — submit a payout with an `Idempotency-Key` header and body fields `amountMinor`, `accountNumber`, `bankCode`, and `confirmAccountName: true`.
4. `GET /api/v1/payments/payouts` and `GET /api/v1/payments/payouts/:id` — retrieve payout status.
5. `POST /api/v1/payments/payouts/:id/finalize` — ADMIN-only completion when Paystack requires a transfer OTP; body contains `otp`.

`amountMinor` is the gross wallet debit in kobo. Example: a gross request of 100,000 kobo charges 2,000 kobo and sends 98,000 kobo to the bank account.

## Operational prerequisites

Paystack account KYC/approval, Transfers API access, webhook configuration, and sufficient Paystack balance are controlled in the Paystack dashboard. A successful build cannot grant those external permissions. Configure the Paystack webhook URL as `https://YOUR_API_HOST/api/v1/payments/webhooks/paystack` and subscribe to transfer success, failed, and reversed events. Do not send secret keys or webhook signing secrets through chat or commit them to the repository.
