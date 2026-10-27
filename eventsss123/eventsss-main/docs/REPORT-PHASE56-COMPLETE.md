# ESS Phase 5 Repair + Phase 6 Performance Report

## Phase 5 completion repair

- Uses the literal `self.__WB_MANIFEST` token required by Workbox `injectManifest`.
- Uses direct top-level `self.addEventListener` handlers so Rollup retains the service-worker entry and does not emit an empty worker chunk.
- Adds a post-build gate that rejects a missing/empty worker, an un-injected manifest placeholder, or a worker missing the expected precache implementation.
- Fixes the IndexedDB `by-updated` index typing issue without disabling TypeScript checking.
- Preserves browser-only service-worker registration; Capacitor continues using Capgo.
- Keeps auth, checkout, payment, wallet and escrow API requests network-only; financial operations are not queued for offline replay.

## Phase 6 performance work

- Adds manual Rollup chunks for React framework, router, icons and other third-party modules.
- Lazily loads the landing page and heavy dashboard panels behind a shared Suspense fallback.
- Adds client-side KYC image compression (WebP where supported, maximum 2400 px edge) and explicit size validation; PDF files remain unchanged.
- Rejects oversized base64 KYC documents on the API as a second line of defense.
- Adds a bundle-size reporting script and `docs/PERF.md` with repeatable production measurement/Lighthouse instructions.

## Required validation

The apply script runs Prisma validation/generation, API typecheck/tests, web TypeScript/Vite production build and web tests. It then asserts the Workbox worker is non-empty and the manifest placeholder was replaced. Any failure triggers a patch rollback and preserves a backup of the prior state.

No claim is made that Lighthouse has been run in this environment. Record the actual generated bundle measurements and Lighthouse report after the production build succeeds in Codespace.
