# EPHINTA commercial source access plan

**Offer under preparation:** US$60 one-time source package.  
**Status:** Not for sale yet. No checkout, entitlement service or paid delivery is active.

## 1. What the buyer is being offered

The proposed package is a copy of the EPHINTA source repository at a clearly identified release tag, plus setup instructions, dependency notices, a version manifest and a commercial licence signed off by the rights holder. It must state exactly what is included and excluded. It is not a promise of hosting, production credentials, customer data, payment-provider accounts, signing keys, third-party services, support or future updates unless a separate written offer says so.

## 2. Current repository facts

- Canonical source repository: https://github.com/demtaiwo1-eng/Winning-game-
- Repository was public when this plan was prepared.
- A public repository cannot enforce payment before viewing or cloning.
- No LICENSE file was present at the audited main checkpoint.
- No verified contributor assignment / licence register was present at that checkpoint.
- The automated dependency inventory and IP release gate are useful engineering evidence, not legal opinions or proof of ownership.
- The public repository must not be represented as paywalled until visibility and delivery controls have been changed and tested.

## 3. Release architecture

Recommended initial design:

1. Keep a public marketing/README surface with no proprietary source or secrets.
2. Keep the full source in a private repository or a private release-storage bucket.
3. Publish a versioned release manifest (tag, commit, package checksum, included files, excluded files, dependency notice bundle).
4. Use a hosted checkout from a payment provider that supports the seller's country, settlement currency and intended buyer markets.
5. Create an order only on the server. Generate a unique order reference and amount from server-side product configuration (US$60, not a client-supplied amount).
6. Verify the provider's signed webhook or verify endpoint server-to-server. Never grant access based only on a browser redirect or screenshot.
7. Record the provider transaction ID, order ID, currency, amount, status and timestamps. Enforce idempotency.
8. Grant a time-limited, single-buyer download entitlement only after verified successful payment.
9. Deliver a short-lived download URL or invite the verified buyer to the private release repository. Do not expose a long-lived shared secret URL.
10. Support refunds, chargebacks, duplicate webhook delivery, expired links, access revocation and customer support.

## 4. Required security controls

- Keep payment secret keys in Render environment variables; never commit them or paste them into chat.
- Use HTTPS for checkout callbacks and download delivery.
- Verify provider webhook signatures using the raw request body where required.
- Enforce exact expected amount and currency, correct product, successful final payment status and unique transaction reference.
- Reject replayed events and duplicate fulfilment.
- Do not accept client-submitted price, payment status, download path or repository invite.
- Rate-limit order creation and download attempts.
- Log access events without storing card data.
- Do not include environment files, production data, KYC files, database backups, private signing keys, API credentials or customer records in the package.
- Scan the final archive and verify its checksum before delivery.

## 5. Legal and rights gates — blocking

Before sale, the rights holder must obtain and retain:

- Written contributor assignments or sufficiently broad licences for all human contributions.
- Confirmation of employer, contractor and third-party ownership obligations.
- Asset register for images, fonts, icons, music, audio, video and brand assets, with source, licence, territory, term and commercial-use permission.
- Dependency inventory and required verbatim notices.
- Review of generated code and any source-derived materials for licence/attribution conditions.
- A commercial buyer licence drafted/reviewed by qualified counsel.
- Terms covering permitted users, number of deployments, modification, redistribution, resale, sublicensing, warranty disclaimer, liability limits, support, updates, refunds and termination.
- Confirmation that third-party services, trademarks and provider credentials are not included or transferred.

No automated script can establish legal ownership. The sale must remain disabled until these documents are reviewed and approved by the rights holder and counsel.

## 6. Operational acceptance checklist

- [ ] Rights-holder identity and authority confirmed.
- [ ] Every contributor and contractor contribution cleared in writing.
- [ ] Third-party asset and dependency licence review completed.
- [ ] Legal buyer licence approved.
- [ ] Exact US$60 offer and tax/refund disclosures approved.
- [ ] Payment provider merchant account verified for seller country and buyer markets.
- [ ] Test-mode checkout and signed webhook verified.
- [ ] Failed, pending, duplicate, refunded and chargeback paths tested.
- [ ] Private repository/package storage configured.
- [ ] Paid entitlement and expiring download flow tested.
- [ ] Package secret/PII scan and checksum completed.
- [ ] Public repository no longer exposes paid source.
- [ ] Purchase and download flow tested from a clean buyer account.
- [ ] Public README checkout links activated only after all above pass.

## 7. Go-live rule

Until every blocking item is checked, display **Coming soon — paid source access is not yet available**. Do not accept manual transfers as proof of payment and do not promise a download that cannot be delivered securely.
