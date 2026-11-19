# EPHINTA responsive UX audit

This audit is an evidence-producing quality gate, not a claim that the whole product is certified.

## Run from the repository workspace

From `eventsss123/eventsss-main`:

```bash
npm ci
npm run db:deploy -w apps/api
npx playwright install chromium
npm run ux:audit
```

The Playwright configuration starts the API and Vite app against a local test database. The audit visits the public landing route and event-planner route at 390×844 (phone), 768×1024 (tablet) and 1440×900 (desktop). It also captures the event-planner surface under light, dark and colorful theme tokens at all three breakpoints. Full-page PNG screenshots and JSON reports are attached to the run and uploaded as a GitHub Actions artifact.

## Run without a computer

1. Open the repository on GitHub.
2. Open **Actions**.
3. Select **EPHINTA responsive UX audit**.
4. Tap **Run workflow** and choose the branch containing this workflow.
5. Wait for the run to finish.
6. Open its **Artifacts** section and download `ephinta-responsive-ux-audit`. It contains screenshots and a JSON report.

The workflow needs the repository's normal GitHub Actions permission to read the repository and upload workflow artifacts. It does not need production secrets, a live payment credential, or access to user data.

## Important scope boundary

This automated audit covers the public landing and event-planner surfaces, including the three global themes at the requested breakpoints. It still does not sign into private customer, vendor, planner, wallet, messaging or admin dashboards, execute real bookings/payments, or certify every workflow. Those require owner-provisioned synthetic test accounts and sandbox payment credentials. Never put account passwords, production API keys, customer data or payment credentials in the repository or screenshots.

A failed overflow/page-error assertion is a finding to fix; the workflow intentionally does not silently rewrite production UI. Re-run the audit after fixes and retain the artifacts as visual evidence.
