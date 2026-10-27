# ESS Phase 6 performance report

## Changes

- Split framework, router, icon and remaining third-party dependencies into named Rollup chunks.
- Lazy-load the landing page and high-cost dashboard panels (event creation, checklist, readiness, messages, marketplace, wallet, KYC, subscriptions, feedback and verifier UI) behind a shared React Suspense boundary.
- Compress large KYC image uploads client-side to WebP where supported, cap dimensions at 2400 px, and keep PDF documents unchanged. Server-side request parsing remains capped at 1 MB and KYC rejects base64 payloads above 900,000 characters.
- Add a reproducible production bundle report command (see below).

## Baseline and target

The last observed pre-Phase-6 production build emitted a 376.88 kB main JavaScript asset (114.95 kB gzip). That is an entry asset measurement, not the sum of all lazy chunks. The Phase 6 target is an initial JavaScript payload below 200 kB gzip. Compare the generated `dist/assets` after this patch; do not infer the target has been met without measuring the new build output.

## Measure locally

From the repository root after a successful build:

```bash
node scripts/report-web-bundle.mjs
```

The report lists each JavaScript chunk's raw and gzip size and the combined JavaScript gzip size. The combined total is not the same as initial-route transfer size because lazy chunks load on demand.

## Lighthouse

Run Lighthouse against a production preview, not the Vite dev server:

```bash
npm run build --workspace @ess/web
npm run preview --workspace @ess/web -- --host 0.0.0.0
npx lighthouse http://localhost:4173 --preset=desktop --output=html --output-path=./artifacts/lighthouse-desktop.html
```

A Lighthouse score is intentionally not fabricated in this report; it must be collected on the deployed or locally previewed production build and recorded with the test environment/device.
