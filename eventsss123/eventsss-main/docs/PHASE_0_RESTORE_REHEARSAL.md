# Phase 0 — disposable PostgreSQL restore rehearsal

This procedure validates the existing owner-held custom-format backup using a separate disposable database. It does not itself establish that a supplied URL is non-production; the operator must verify the target resource in the provider dashboard before entering its URL.

## Safety requirements

- Keep the production database and its connection URL out of this procedure's target.
- Create a newly provisioned, empty, disposable PostgreSQL 16-compatible database. Verify its resource identity and environment in the provider dashboard first.
- The target database name must contain `restore`, `disposable`, `test`, or `staging`; the verifier refuses other names and any target that already contains base tables. These checks are guardrails, not proof that a database is non-production.
- Never paste either database URL into chat, GitHub, shell history, source control, or logs.
- Do not create a paid Render resource or change the current Free plan as part of this rehearsal.

## Current evidence and preservation baseline (2026-10-31)

- Owner-supplied backup: `ephinta_db_20261030.dump`, 103,970 bytes, SHA-256 `a13fc25599b998012cb90ad6df6b1afbc0174cc3012b5718ac1e5e822bea067a`.
- The file begins with the PostgreSQL custom-archive `PGDMP` marker. This confirms the expected format marker only; `pg_restore --list` and a full restore have **not** completed in this environment.
- Read-only inspection of the live Render PostgreSQL 16.15 database found 38 public base tables, 16 finished Prisma migrations, and 0 unfinished migrations.
- Observed row counts in selected live tables: `User` 1, `Event` 1, `Wallet` 1, `Cart` 2, `EventTask` 22, `RefreshToken` 1, `PaymentIntent` 0, and `LedgerEntry` 0. These are counts only; no row contents are reproduced here.
- The purpose and ownership of those existing records have not been confirmed. Preserve them; do not truncate, reset, replace, or restore over the live database.
- A second active Render Free PostgreSQL database could not be provisioned because the workspace already has an active Free database. No paid database was created. Use another explicitly approved disposable PostgreSQL 16 target or run the verifier locally; never substitute the production database.
- The current Free database has a reported expiry of 2026-11-26. Plan a no-cost continuity path before that date.


## Run the verifier

From the application root (`eventsss123/eventsss-main`) on a trusted machine with PostgreSQL client tools installed:

```bash
export BACKUP="$HOME/path/to/the-existing-backup.dump"
read -rsp "Disposable PostgreSQL URL (input hidden): " RESTORE_DATABASE_URL
printf '\n'
export RESTORE_DATABASE_URL
export RESTORE_TARGET_CONFIRMATION=DISPOSABLE_NON_PRODUCTION
bash scripts/verify-backup-restore.sh
unset RESTORE_DATABASE_URL RESTORE_TARGET_CONFIRMATION BACKUP
```

The hidden prompt prevents the URL from being echoed or placed in shell command history. Do not paste the URL into a command. The script checks that the backup is a readable custom-format archive, records its SHA-256, refuses a target with existing tables, restores in a single transaction, and verifies that public tables and Prisma migration records exist with no unfinished migrations. It does not print the connection URL.

If `pg_restore --list` fails, stop and do not attempt the restore. Preserve the original backup and verify the file transfer/checksum before retrying. If the target is not empty, discard/recreate only that disposable target; never use a production database.

## Required post-restore evidence

The script's success is necessary but not sufficient for Phase 0 sign-off. Also:

1. Record the backup filename, byte size, SHA-256, UTC test time, PostgreSQL server version, and non-secret target identifier.
2. Compare representative row counts and records against the backup's own metadata and the recorded live baseline above. Do not assume the backup and live database are identical: the live database currently has 38 public base tables and 16 completed migrations, and selected tables contain records. Record any differences; never force historical empty-table or 14-migration assumptions onto the current database.
3. Point an isolated staging API process at the restored database and verify `/health`, `/ready`, and the API/database integration tests.
4. Record the operator and any warnings. Keep the production database unchanged.

A successful archive listing alone is not a restore rehearsal. A successful restore alone is not complete application-data validation.

## Automated verifier regression (CI)

The repository workflow `.github/workflows/ephinta-backup-restore-rehearsal.yml` creates a synthetic PostgreSQL 16 custom-format archive, restores it to a newly created database named `ephinta_restore_ci`, checks fixture rows and Prisma migration metadata, and confirms the verifier refuses a non-empty target. This protects the restore procedure against regressions.

**This synthetic CI fixture is not the owner-held production backup.** It does not prove that `ephinta_db_20261030.dump` is intact or restorable. The exact owner archive must still pass `pg_restore --list` and a full restore to an independently confirmed disposable target before Phase 0 can be signed off.


## Latest live Render database snapshot (2026-11-21)

A fresh read-only inspection of the existing production Render PostgreSQL database was completed on 2026-11-21. This is a newer snapshot than the historical 2026-10-31 baseline above; it does not replace or validate the owner-held backup.

- PostgreSQL server: 16.15 (Debian 16.15-1.pgdg12+2).
- Public base tables: 61.
- Prisma migrations: 39 finished; 0 unfinished.
- Selected live row counts: `User` 11, `Event` 7, `Wallet` 11, `PaymentIntent` 0, `LedgerEntry` 0.
- Render database resource: `ephinta_db` (`dpg-dbgbaeqfngtc7397tdag-a`), Free plan, status available.
- Render-reported expiry: 2026-11-26 14:29:15 UTC. Confirm current expiry and available continuity options in the Render Dashboard before relying on this resource.

**Continuity is urgent.** Before the reported expiry, the owner must create and securely retain a fresh backup, validate its checksum and custom-format archive with `pg_restore --list`, and complete a restore into an independently verified disposable PostgreSQL 16 database. The 2026-10-30 archive's recorded checksum is not evidence that it restores successfully. Do not change the production database, discard existing rows, create a paid resource, or migrate to Supabase as part of this work. Keep the existing Render backend/database and JWT arrangement unless the owner explicitly approves a different plan.

The available Render database query integration is read-only and cannot create a `pg_dump`, export, snapshot, or restore. Therefore this snapshot is observation only: it does not extend the database expiry, create a backup, or complete Phase 0 sign-off. The owner must use an authorized PostgreSQL client from a trusted machine to create and validate the backup without exposing database URLs or credentials in chat, GitHub, shell history, or logs.
