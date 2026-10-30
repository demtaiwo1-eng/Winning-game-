# Phase 2 — paid vendor promotions and monetisation integrity

**Implementation branch:** `ephinta/phase-2-promotions`  
**Pull request:** https://github.com/demtaiwo1-eng/Winning-game-/pull/3  
**Status:** Implementation slice submitted for CI/review; not production-approved.

## Implemented in this slice

- Vendor-created promotions are DRAFT and cannot be self-published.
- A vendor can pay for a campaign from an NGN wallet only if sufficient funds are available.
- The wallet debit is conditional/atomic; the immutable ledger record uses a deterministic campaign idempotency key.
- The payment claim, wallet debit, ledger record, and audit record are in one database transaction. A repeated request reuses the matching ledger record rather than charging again.
- ADMIN activation requires a matching ledger entry for the exact promotion ID and exact budget.
- A vendor can pause only their own ACTIVE campaign.
- ADMIN can activate, pause, resume, or end only through constrained state transitions; each action is audited.
- A paid campaign cannot be ended while refunds are not implemented. It can be paused; no silent loss of campaign funds is allowed.
- Public impressions/clicks are accepted only for ACTIVE campaigns inside their schedule and are rate-limited.
- Tracking never returns private vendor financial data.
- Added an additive migration for payment/approval/pause timestamps and impression/click counters.
- Added pure policy tests for exact payment matching, campaign schedule, and allowed tracking actions.
- Added a vendor dashboard for draft creation, wallet payment and pause, plus an admin dashboard for paid-campaign approval and status control.

## API routes added

- `POST /api/v1/billing/promotions/:id/pay` — vendor pays from NGN wallet.
- `POST /api/v1/billing/promotions/:id/pause` — vendor pauses own active campaign.
- `PATCH /api/v1/billing/promotions/:id/status` — ADMIN activates, pauses, resumes, or ends under the state/payment guards.
- `POST /api/v1/billing/public-promotions/:id/track` — rate-limited `impression` or `click` event.

## Money and release safety

- A wallet can be credited in production only through the existing verified payment-provider settlement flow; direct wallet deposit endpoint is disabled in production.
- No demo payment success, fake payment, client-supplied status, or client-supplied amount is accepted as campaign settlement.
- Campaign budget is a prepaid wallet debit in NGN. This slice does not yet implement per-impression/per-click billing, refund accounting, or spend drawdown.
- No live provider account was activated and no real-money payment was initiated.
- Campaign wallet payments and ADMIN activation require the explicit environment opt-in `PROMOTIONS_WALLET_PAYMENTS_ENABLED=true` (except in tests). It is not enabled by this patch, so the production feature remains closed until separate staging/owner sign-off.
- No production database migration has been run. Migration is additive and will be applied only by the reviewed deploy process after merge.
- No Render plan changes or production data reset.

## Remaining Phase 2 acceptance work

- CI must pass on the final PR head and migration must succeed on the disposable PostgreSQL 16 CI database.
- Add authenticated DB integration tests for vendor isolation, concurrent wallet payment idempotency, insufficient funds, admin-only approval, and state transitions.
- Add a tested refund/cancellation process before enabling paid campaign termination.
- Add scheduled expiry/status reconciliation and robust deduplicated bot-resistant attribution.
- Confirm all campaign payments originate from verified wallet funding, review the opt-in setting, and define the commercial pricing/measurement policy.
- Review the new vendor/admin screens on small Android viewports and complete authenticated staging journeys.
- Run staging journeys using test accounts; no production paid campaign until owner sign-off.

A green build is necessary but not sufficient for Phase 2 completion.
