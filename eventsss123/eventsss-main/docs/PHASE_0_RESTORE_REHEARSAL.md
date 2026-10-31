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
