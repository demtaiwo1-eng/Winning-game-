# EPHINTA payment-provider onboarding and release gates

**Current rule:** Keep payment traffic in sandbox/test mode until each provider has approved the merchant account, supplied its official API contract and test credentials, and passed signed-webhook, idempotency, reconciliation, refund and settlement tests. Never infer endpoints or signing rules from another provider.

## OPay

The repository currently contains a Nigeria NGN OPay cashier sandbox adapter. It is not evidence of live merchant approval or production settlement.

Official onboarding guidance:
- Establish an OPay business account and complete KYC.
- Work with an OPay sales representative to select the merchant products/endpoints required.
- A Superadmin configures API keys, webhook URLs and IP allowlisting in the OPay Business Dashboard.
- Complete joint testing with OPay before going live.

References:
- [OPay integration overview](https://documentation.opayweb.com/)
- [OPay API basics and webhook setup](https://documentation.opayweb.com/doc/offline/api-basics.html)
- [OPay cashier authentication](https://documentation.opaycheckout.com/payment-authentication.html)

Acceptance evidence required for each enabled operation:
- Merchant-issued production credentials held only in Render secret settings.
- Request authentication and callback signature verification using the exact OPay product specification for the selected integration.
- Replay-safe webhook processing and server-to-server status verification.
- Amount, currency, merchant, reference and final status match before ledger settlement.
- Provider-confirmed sandbox collection and reconciliation; separate approval for refunds, payouts and FX if requested.
- Written OPay production activation approval and a monitored low-value live test.

Do not change the existing sandbox base URL to a guessed production URL. Confirm the exact environment and endpoint with OPay for EPHINTA's merchant account.

## Eversend

Eversend publishes a Merchant API reference. Its onboarding documentation says a business must first be verified, then request Merchant API access by emailing **business@eversend.co** with:
1. The email address linked to the Eversend for Business account.
2. A brief description of the business.
3. A short description of the intended API use.

After approval, retrieve the client ID and client secret from the business dashboard and whitelist the outbound IP address under Settings → Developers. The published API overview describes token-based authentication using the client ID and secret, with a bearer token for API requests.

References:
- [Eversend API onboarding](https://eversend.readme.io/reference/before-getting-started)
- [Eversend API overview](https://eversend.readme.io/reference/api-overview)
- [Eversend authentication](https://eversend.readme.io/reference/authentication-1)

Before implementation, obtain the account-specific sandbox base URL, complete endpoint schemas, token expiry/refresh behavior, idempotency support, webhook signature specification, IP requirements, and settlement/reconciliation rules from Eversend. Do not assume all advertised operations are enabled for EPHINTA's account or country.

## Cleva — product identity and API access must be confirmed

There are distinct Cleva-branded services. The public site [clevaglobal.com](https://clevaglobal.com/) describes merchant-facing payments, billing, checkout, invoicing and payment links, but its public integration section currently says API documentation is coming soon. It lists **info@clevaglobal.com** for contact.

The separate [getcleva.com](https://www.getcleva.com/) service describes consumer and business wallet products; its public website and help center do not provide a public merchant API specification in the sources reviewed for this integration. Do not treat those two products as interchangeable.

Before writing a Cleva adapter, the account owner must confirm which Cleva product is intended and obtain the official merchant API package directly from that provider:
- approved business/merchant account and product eligibility;
- sandbox and production base URLs;
- authentication and key rotation;
- payment create/status/refund/payout/FX endpoint schemas, if supported;
- webhook signature, timestamp/replay and retry behavior;
- idempotency, settlement and reconciliation rules;
- test credentials and joint-test contact.

Until that contract exists, keep Cleva disabled and do not invent endpoint paths, payloads, signatures or environment variable semantics.

## EPHINTA integration acceptance checklist

For every provider and every operation (collection, status verification, refund, payout, FX):
- [ ] Provider identity and merchant account are confirmed.
- [ ] Official API contract and version are recorded in the repo.
- [ ] Sandbox credentials are configured in Render secrets, never source control or client code.
- [ ] Request authentication and webhook signature tests use provider-published test vectors.
- [ ] Invalid signature, stale timestamp, duplicate event, wrong merchant, wrong amount/currency and unknown reference are rejected.
- [ ] Idempotent retry cannot double-credit or double-debit a wallet.
- [ ] Provider status is verified server-to-server before ledger settlement.
- [ ] Refund, payout and FX are separately permissioned and remain disabled until individually tested.
- [ ] Reconciliation report matches provider statements and EPHINTA ledger entries.
- [ ] Provider confirms production activation and owner approves the switch.

No production payment mode should be enabled by this document alone.
