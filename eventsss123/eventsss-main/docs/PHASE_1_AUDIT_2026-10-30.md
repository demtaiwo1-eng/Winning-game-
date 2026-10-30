# Phase 1 — Production Blocker and Web/API Correctness Audit

**Audit date:** 2026-10-30 UTC  
**Repository:** `demtaiwo1-eng/Winning-game-`  
**Branch:** `ephinta/full-phased-improvement-patch`  
**PR:** [#1](https://github.com/demtaiwo1-eng/Winning-game-/pull/1)  
**Audited commit:** `510c6d1f09a6ade0d4a6dee01ff30395fa1b9e50`

## Executive result

The Phase 1 source changes in the current PR are present and the latest GitHub Actions run completed successfully. This is a **code/CI pass, not a production-readiness sign-off**. The latest CI log proves that the GitHub Actions repository variable `VITE_API_URL` was empty. CI intentionally emitted a warning and marked the online API readiness artifact `false`, while still building a web bundle and debug APK. Those artifacts must not be described or distributed as online-ready.

No source runtime changes, production environment changes, database operations, merges, or deployments were made during this audit.

## Scope review

| Area | Audit result | Evidence / remaining work |
|---|---|---|
| Shared API routing | Implemented in source | `nativeFetch.ts` uses `getApiBaseUrl` and `resolveApiRequest`; `apiUrl.test.ts` covers HTTPS API hosts, Supabase proxy paths, relative fallback, and rejects insecure remote URLs. |
| Public landing auth/promotions | Uses shared API path | Active `PublicLanding.tsx` routes auth and public-promotions requests through the shared API path; fetch routing is handled by `nativeFetch.ts`. |
| CORS | Code supports explicit origin allowlisting | `app.ts` reads `CORS_ORIGINS`; default values are local development origins and Capacitor localhost. The production frontend origin has not been identified/configured in this audit. |
| Mislabelled AdMob / fabricated cards | Removed from active landing page | The PR removes the AdSense-labelled-as-AdMob markup and fabricated fallback promotion cards. |
| Vendor promotion safety | Implemented in API route | New vendor promotions are forced to DRAFT; amount/date checks and listing ownership checks are present. Activation remains withheld pending verified billing/approval. |
| Android SDK licence handling | Implemented in workflow | Finite licence input replaces the `yes | sdkmanager` pipe that could fail under `pipefail`. |
| Automated checks | Passed | Latest run #24 completed successfully: API/web checks, disposable PostgreSQL 16 migration/integration test job, web build, Android debug APK build and artifact upload. |
| Live frontend/API journey | Not verified | No browser end-to-end test against a deployed frontend and the live API was performed. |
| Physical Android tap-through | Not verified | CI built a debug APK; no physical-device acceptance test was performed. |

## Confirmed production integration blocker

The latest CI run (#24, commit `510c6d1`) had an empty `VITE_API_URL` environment value. Its log contains the warning:

> VITE_API_URL is not set. This run can build an offline-capable APK artifact, but it cannot be published as an online-ready release.

The workflow saved the online-readiness result as `false`. The web build and APK build succeeding do not override that result.

The connected Render workspace currently lists the API service `ephinta_wss` and a separate suspended API service `ephinta_ws`; it does not list a frontend/static-site service. Therefore the production frontend's canonical HTTPS origin is not established by the Render inventory.

The API CORS code uses an explicit `CORS_ORIGINS` list. Its defaults do not include an unknown production frontend hostname. Do not guess an origin or broadly enable arbitrary origins.

### Required owner-supplied configuration

Before the web/native app can be certified online-ready:

1. Confirm the canonical public HTTPS URL where the Ephinta frontend is actually hosted.
2. Set GitHub repository variable `VITE_API_URL` to `https://ephinta-wss.onrender.com/api/v1` for builds targeting the current active API.
3. Set Render environment variable `CORS_ORIGINS` to the exact production frontend origin(s), comma-separated, plus any deliberately supported Capacitor origin. Do not include paths or trailing slashes in origin entries.
4. Re-run CI. The API readiness artifact must say `true`, and both `/health` and `/ready` probes must pass.
5. Run browser sign-up/sign-in/password-reset and planner handoff smoke tests against the deployed frontend/API. Complete a physical Android tap-through before release.

Do not paste credentials or secret values into chat. Environment changes should be made through the appropriate secret/settings interface.

## Safety and release decision

- Keep PR #1 open and unmerged pending review and the owner-supplied frontend origin.
- Do not deploy the feature branch to the active Render API as part of this audit.
- Keep Render services and database on the Free plan; no paid resources are proposed.
- No production DB or user data was changed.
- Phase 1 source/CI implementation is **present and CI-passing**; online integration and device acceptance remain **BLOCKED / NOT VERIFIED**.
- Phase 0 restore rehearsal and long-term database continuity remain separate outstanding items and are not closed by this Phase 1 audit.
