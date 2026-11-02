# EPHINTA KYC provider research

Run from `eventsss123/eventsss-main` with Node 20+ and the API country catalogue available:

```bash
node scripts/research-kyc-providers.mjs --country NG
node scripts/research-kyc-providers.mjs --country GB --format json
KYC_COUNTRIES_API_URL=https://YOUR_API/api/v1/kyc/countries node scripts/research-kyc-providers.mjs --format json
```

The script reads EPHINTA's country catalogue and checks three providers' official coverage pages:

- Smile ID — country-specific document list: https://smile.id/supported-documents
- Veriff — country/document coverage: https://www.veriff.com/supported-countries
- Sumsub — global coverage and verification methods: https://docs.sumsub.com/docs/identity-verification

It labels an exact country match only when that country's name appears on a fetched provider country/document page. A provider's advertised global country count is not treated as proof of that country's document or feature support. Scores are shortlist heuristics, not an endorsement or legal-compliance decision. Before choosing, confirm the precise document type and production features in writing, local regulatory requirements, lawful basis/consent, data location and transfers, retention/deletion, subprocessors, security certifications, SLAs and total cost.

The script does not submit applicant data to any provider, does not create provider accounts, and does not configure production credentials.

## Hosted identity verification integration

The API adapter `apps/api/src/lib/kyc-provider.ts` starts a hosted Veriff identity session. It expects these server-side environment variables:

- `VERIFF_API_URL`: the base URL issued for EPHINTA's Veriff integration (do not guess or use a public URL copied from another customer).
- `VERIFF_API_KEY`: the integration API key, stored only in the backend secret manager.

The adapter sends a session request using Veriff's documented `X-AUTH-CLIENT` header and stores no raw identity image in EPHINTA. Applicants complete document capture in Veriff's hosted flow. The session-start adapter alone is not a complete production integration: the authenticated decision webhook, signature verification, replay protection, decision mapping, retention/deletion workflow, and end-to-end sandbox tests must be implemented before a provider decision can automatically change an EPHINTA account to VERIFIED.

Veriff's official API guide documents session creation, hosted URL/session ID responses, and decision webhooks:
https://devdocs.veriff.com/apidocs/veriff-api-reference-index
https://devdocs.veriff.com/apidocs/v1sessions

**Important:** Do not enable live KYC until webhook verification and the provider's country/document feature matrix have been contractually confirmed. Business KYB requires a separate company-verification product and is not covered by the individual identity session adapter.
