# External bank withdrawals through OPay (Nigeria)

EPHINTA's external NGN bank-withdrawal rail is OPay Merchant Transfer API v3. Paystack is not used for bank withdrawals. Paystack may remain configured for unrelated collection flows, but it cannot enable or process an EPHINTA bank payout.

## OPay API operations

The adapter follows the OPay Merchant Transfer SDK contract:

- `POST /api/v3/banks` — list supported Nigerian banks using the OPay public key.
- `POST /api/v3/verification/accountNumber/resolve` — resolve a bank account name using the OPay public key.
- `POST /api/v3/transfer/toBank` — initiate a bank transfer using an HMAC-SHA512 signature generated with the OPay private/secret key.
- `POST /api/v3/transfer/status/toBank` — query transfer status using the same HMAC-SHA512 signing scheme.

The sandbox base URL is `https://sandbox-cashierapi.opayweb.com`; production base URL is `https://cashierapi.opayweb.com`. The adapter uses HTTPS and signs the exact recursively key-sorted JSON request body. It does not log or return credentials.

OPay's merchant transfer integration does not use the Paystack transfer webhook. EPHINTA stores OPay's transfer order number and queries OPay's transfer-status endpoint from the API's existing once-per-minute background reconciliation loop (bounded to 5 pending payouts per tick), as well as on individual payout status reads. Funds remain reserved until a final provider status is confirmed.

## Wallet and fee safety

- Only NGN bank accounts are enabled.
- The API resolves the account number and bank code with OPay before creating a transfer.
- The complete account number is never stored. Payout records retain the verified account name and last four digits only.
- The wallet reserves the gross withdrawal amount atomically. The bank receives the net amount after the 2% outgoing fee.
- The 2% fee is posted to the platform revenue ledger only after OPay reports success.
- Failed transfers refund the gross wallet debit. Reversed transfers refund the debit and append a negative platform-fee journal entry.
- A network timeout is treated as ambiguous. The wallet debit stays reserved until an OPay status enquiry reconciles the transfer; EPHINTA does not risk a duplicate transfer by blindly retrying.
- OPay merchant transfers are funded from the merchant's OPay settlement balance. A positive EPHINTA user wallet balance does not itself guarantee sufficient OPay merchant settlement liquidity.
- Transfer status is reconciled by order number and EPHINTA reference. Do not treat a browser redirect or client-submitted status as proof of payout.

## Render environment

Set these on the API service only. Keep all values in Render secret settings; never commit or send the private key through chat.

| Variable | Sandbox | Production |
| --- | --- | --- |
| `OPAY_MERCHANT_ID` | OPay-issued sandbox merchant ID | OPay-issued production merchant ID |
| `OPAY_PUBLIC_KEY` | OPay sandbox public key | OPay production public key |
| `OPAY_SECRET_KEY` | OPay sandbox private/secret key | OPay production private/secret key |
| `OPAY_TRANSFERS_ENABLED` | `true` only after OPay confirms merchant bank-transfer access in sandbox | `true` only after OPay approves production bank transfers |
| `OPAY_TRANSFER_BASE_URL` | `https://sandbox-cashierapi.opayweb.com` | `https://cashierapi.opayweb.com` |
| `PAYMENT_MODE` | `test` | `live` |
| `ALLOW_PRODUCTION_TEST_MODE` | `true` only for an intentional sandbox test on the production API host | `false` |
| `PAYOUT_FEE_BPS` | `200` | `200` |

If `OPAY_TRANSFER_BASE_URL` is omitted, the API selects the sandbox host in test mode and production host in live mode. The transfer feature defaults to disabled. Do not enable it until OPay confirms that the merchant credentials are entitled to the Merchant Transfer API, sandbox bank transfers have passed joint testing, and the OPay merchant settlement account is funded.

## API

1. `GET /api/v1/payments/payouts/banks` — list OPay-supported banks.
2. `GET /api/v1/payments/payouts/resolve-account?accountNumber=0123456789&bankCode=058` — resolve the destination account name through OPay.
3. `POST /api/v1/payments/payouts` — submit a payout with an `Idempotency-Key` header and body fields `amountMinor`, `accountNumber`, `bankCode`, and `confirmAccountName: true`.
4. `GET /api/v1/payments/payouts` and `GET /api/v1/payments/payouts/:id` — retrieve payout history and reconcile pending transfers with OPay.
   
`amountMinor` is the gross wallet debit in kobo. Example: a gross request of 100,000 kobo charges 2,000 kobo and sends 98,000 kobo to the bank account.

## Provider acceptance and live readiness

The application code can be tested with mocked OPay responses, but an actual sandbox bank transfer requires OPay-issued sandbox credentials and merchant-transfer entitlement. Production requires OPay's approval, production credentials, settlement funding, and joint end-to-end testing with OPay. A successful CI build is not proof that OPay has enabled the merchant service or that a real bank transfer settled.
