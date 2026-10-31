# Phase 0 — disposable PostgreSQL restore rehearsal

This procedure validates the existing owner-held custom-format backup without touching the live database.

## Safety requirements

- Keep the production database and its connection URL out of this procedure's target.
- Use a newly created, empty, disposable PostgreSQL 16-compatible database.
- The target database name must contain `restore`, `disposable`, `test`, or `staging`; the verifier refuses other names and any target that already contains base tables.
- Never paste either database URL into chat, GitHub, shell history, source control, or logs.
- Do not create a paid Render resource or change the current Free plan as part of this rehearsal.

## Run the verifier

From the application root (`eventsss123/eventsss-main`) on a trusted machine with PostgreSQL client tools installed:

```bash
export BACKUP="$HOME/path/to/the-existing-backup.dump"
export RESTORE_DATABASE_URL='(enter the disposable target URL securely in your terminal)'
export RESTORE_TARGET_CONFIRMATION=DISPOSABLE_NON_PRODUCTION
bash scripts/verify-backup-restore.sh
unset RESTORE_DATABASE_URL RESTORE_TARGET_CONFIRMATION BACKUP
```

The target URL placeholder above is explanatory only: replace it locally; do not commit it. The script checks that the backup is a readable custom-format archive, records its SHA-256, refuses a target with existing tables, restores in a single transaction, and verifies that public tables and Prisma migration records exist with no unfinished migrations. It does not print the connection URL.

If `pg_restore --list` fails, stop and do not attempt the restore. Preserve the original backup and verify the file transfer/checksum before retrying. If the target is not empty, discard/recreate only that disposable target; never use a production database.

## Required post-restore evidence

The script's success is necessary but not sufficient for Phase 0 sign-off. Also:

1. Record the backup filename, byte size, SHA-256, UTC test time, PostgreSQL server version, and non-secret target identifier.
2. Compare representative row counts and records against the source backup metadata. The current baseline expects the 35 application tables to be empty and the Prisma migration history to contain 14 completed migrations; if the backup reflects a later migration, use its actual migration count rather than forcing this historical number.
3. Point an isolated staging API process at the restored database and verify `/health`, `/ready`, and the API/database integration tests.
4. Record the operator and any warnings. Keep the production database unchanged.

A successful archive listing alone is not a restore rehearsal. A successful restore alone is not complete application-data validation.
