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

## Active integration status

The current API uses the Bytid hosted KYC adapter in `apps/api/src/lib/bytid.ts` and the `/bytid` routes in `apps/api/src/modules/kyc/kyc.routes.ts`. Live mode is explicitly gated by `BYTID_ALLOW_LIVE=true`; keep it disabled until EPHINTA has an approved provider contract, production credentials, verified webhook configuration, privacy/DPA review, and end-to-end sandbox evidence.

A small unused Veriff session-start prototype previously existed in the repository but was not called by any route, did not implement a verified decision webhook, and had no configured `VERIFF_API_*` environment variables. It has been removed from the current release branch rather than being presented as an active integration.

Smile ID, Veriff, and Sumsub in this document are research references only. The research script reads public provider coverage pages; it does not submit applicant data, start verification sessions, or configure provider accounts.