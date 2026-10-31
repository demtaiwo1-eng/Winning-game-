# Phase 4.4 — Multi-currency and FX readiness

## Currency isolation safeguards

- Wallets remain separate by the existing unique `(userId, currency)` key.
- Wallet ledger entries remain attached to exactly one wallet and therefore one currency.
- Wallet deposit and escrow-hold requests validate ISO-style three-letter currency codes and positive integer minor-unit amounts.
- Reusing an idempotency key is accepted only when owner, wallet currency, amount, ledger type, reference type, and reference ID all match.
- Cross-currency or changed-amount idempotency replays return a conflict instead of returning an unrelated prior wallet entry.
- Generated escrow idempotency keys include currency.

## FX boundary

No automatic currency conversion, exchange quote, payout, or FX settlement is enabled. Currency balances stay separate. FX quote/lock/expiry models remain deferred until a documented provider FX API and commercial approval are available.

## Validation

- Unit tests cover exact idempotent replays and mismatched owner, currency, amount, ledger type, and reference.
- CI must pass API/web checks, disposable PostgreSQL migration/integration tests, web build, and Android build before merge.
