# Central EPHINTA payment mode

The platform payment mode is stored in the shared PostgreSQL `PlatformRuntimeSetting` row with ID `global`. The ADMIN dashboard exposes DEMO, TEST and LIVE. The API reads this shared row before every payment/payout request. It refuses a mode change while pending payment intents or pending/processing payouts exist, so a transaction is never verified against credentials for a different mode. This ensures separate Render instances and connected web/PWA/native clients use the same server-side policy.

## Modes

- **DEMO**: simulated checkout only; never permits external bank withdrawals. Disabled in production.
- **TEST**: OPay sandbox checkout and transfer endpoints. Production API test operation additionally requires `ALLOW_PRODUCTION_TEST_MODE=true`.
- **LIVE**: OPay production checkout and transfers. The API refuses this mode unless the dedicated `OPAY_LIVE_MERCHANT_ID`, `OPAY_LIVE_PUBLIC_KEY`, `OPAY_LIVE_SECRET_KEY`, `OPAY_LIVE_MODE_READY=true`, `OPAY_TRANSFERS_ENABLED=true`, production `NODE_ENV`, `EPHINTA_ENVIRONMENT=production`, and exact production transfer endpoint are configured. Set `EPHINTA_ENVIRONMENT=staging` on the staging service; LIVE is rejected there even if production secrets are accidentally present.

Use separate `OPAY_TEST_*` and `OPAY_LIVE_*` credentials and separate `OPAY_TEST_TRANSFER_BASE_URL` / `OPAY_LIVE_TRANSFER_BASE_URL` endpoints. Legacy `OPAY_MERCHANT_ID`, `OPAY_PUBLIC_KEY` and `OPAY_SECRET_KEY` are fallback credentials for TEST only; they are never used for LIVE. Keep all secrets in Render environment settings, never in source control or chat. `OPAY_LIVE_MODE_READY=true` is an explicit operational attestation and must only be set after OPay confirms production merchant access, checkout, transfers, callbacks/webhooks and reconciliation.

## Rollout

1. Deploy the API code and apply Prisma migrations (`npm run db:deploy`).
2. Confirm the global row exists and reads TEST.
3. Configure `OPAY_TEST_*` credentials and the sandbox transfer endpoint on the staging service.
4. Test wallet deposits, webhook signature/reference/amount/currency verification, bank-name resolution, payout idempotency, failure refunds, reversals and reconciliation.
5. Configure dedicated OPay production credentials on the production Render service only after OPay confirms live access. Keep `OPAY_LIVE_MODE_READY=false` until the production readiness checklist is signed off.
6. Use the ADMIN dashboard to switch to LIVE only after the API reports the live readiness requirements are satisfied.

If the database cannot confirm the global mode, payment and payout requests fail closed with HTTP 503. The API response is not cached by clients. Mode changes apply to the next payment/payout request across all API instances; installed apps do not need reinstalling for server-side payment policy changes. Offline clients cannot receive a server-side change until they reconnect. Changes that require new native code still require an app update.

## Fees

Incoming wallet deposits and outgoing OPay bank withdrawals use a fixed 200 basis-point (2%) transaction fee. The retired Render mode script no longer changes fee settings.
