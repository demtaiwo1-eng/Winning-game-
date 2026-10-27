# Phase 12 — End-to-End Testing

## Scope

Patch 054 introduces Playwright browser coverage for real rendered ESS public UI and a GitHub Actions workflow. The browser tests cover:

- Public landing page rendering.
- Event designer selection, draft persistence, and registration entry.
- Registration password-length validation.
- A mocked failed sign-in response and visible error handling.
- Mobile menu and service-provider registration entry.

The tests use the real Vite-rendered frontend and intercept the login failure request. They do not create real accounts or send payments.

## Apply

From the repository root, run:

```bash
bash scripts/apply-054-phase12-e2e-testing.sh /workspaces/eventsss
```

The apply script refuses to overwrite existing target files, adds `@playwright/test` to `apps/web` and updates `package-lock.json`, then installs the new workflow, config, tests and docs. Internet access is required for the npm dependency installation.

## Validate

```bash
bash scripts/phase12-e2e-local-gate.sh
```

If Chromium is not available, the script attempts to install it. In restricted Codespaces environments, browser installation may require additional system libraries; GitHub Actions installs Chromium and its dependencies automatically.

## Boundaries

This patch does not claim complete end-to-end coverage for authenticated event creation, vendor listing, checkout, wallet settlement, live payment providers, production deployment, NFC or Bluetooth hardware. Those require additional seeded test fixtures and, for physical features, appropriate devices. The Phase 12 workflow runs against an isolated PostgreSQL service and uses safe mocked browser authentication failure; it does not use live payment credentials.
