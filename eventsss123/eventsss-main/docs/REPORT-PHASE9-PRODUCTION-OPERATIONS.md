# EPHINTA Phase 9 — Production Operations

## Delivered

- Safe HTTPS smoke-test script: `scripts/phase9-production-smoke-test.sh`.
- Canonical repository-root manual workflow: `.github/workflows/ephinta-phase9-staging-smoke.yml`.
- Operational procedure: `docs/PHASE9-OPERATIONS-RUNBOOK.md`.

The script checks API `/health`, API `/ready`, and the web root. It sends no credentials, follows redirects with TLS verification enabled, prints only endpoint labels and HTTP status codes, and requires 2xx responses.

## Run the staging workflow

Open **Actions → EPHINTA Phase 9 Staging Smoke Test → Run workflow**. Supply both HTTPS staging base URLs in the optional `api_base_url` and `web_base_url` inputs, or configure the repository Variables below. Input values override repository Variables.

- `ESS_STAGING_API_URL` — HTTPS staging API base URL, without `/health` or `/ready`.
- `ESS_STAGING_WEB_URL` — HTTPS staging web base URL.

The workflow blocks the known production Render API and web URLs. Use actual staging services only; do not relabel production URLs as staging. Do not place credentials, database URLs, or payment secrets in these inputs or variables.

## Run locally

```bash
API_BASE_URL="https://staging-api.example.com" \
WEB_BASE_URL="https://staging.example.com" \
bash scripts/phase9-production-smoke-test.sh
```

## Status and limits

Workflow/script are now located where GitHub Actions can execute them. Live staging acceptance remains pending until valid staging URLs are supplied and the manual workflow completes. Production smoke testing, authenticated business journeys, provider sandbox verification, database restore, and physical-device acceptance are separate release gates. No payment or database mutation is performed by this smoke test.
