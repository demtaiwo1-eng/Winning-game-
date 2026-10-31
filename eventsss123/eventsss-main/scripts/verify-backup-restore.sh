#!/usr/bin/env bash
# Restore a custom-format PostgreSQL backup into a guarded, operator-confirmed disposable database.
# The operator must independently verify the target resource is non-production before running.
set -Eeuo pipefail
umask 077

fail() {
  printf 'ERROR: %s\\n' "$*" >&2
  exit 1
}

command -v pg_restore >/dev/null 2>&1 || fail "PostgreSQL client tools (pg_restore) are required."
command -v psql >/dev/null 2>&1 || fail "PostgreSQL client tools (psql) are required."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required."

: "${BACKUP:?Set BACKUP to the exact custom-format backup file path.}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to a disposable, non-production PostgreSQL URL.}"
[[ "${RESTORE_TARGET_CONFIRMATION:-}" == "DISPOSABLE_NON_PRODUCTION" ]] \\
  || fail "Set RESTORE_TARGET_CONFIRMATION=DISPOSABLE_NON_PRODUCTION only after confirming the target is disposable."
[[ -f "$BACKUP" && -s "$BACKUP" ]] || fail "Backup file is missing or empty."

# Do not enable shell tracing: RESTORE_DATABASE_URL may contain credentials.
printf '==> Checking backup archive and checksum\\n'
pg_restore --list "$BACKUP" >/dev/null || fail "pg_restore could not read the archive."
BACKUP_SHA256="$(sha256sum "$BACKUP" | awk '{print $1}')"
printf 'Backup SHA-256: %s\\n' "$BACKUP_SHA256"

# Inspect the target using SQL, without printing the connection URL.
TARGET_DB="$(psql "$RESTORE_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c 'SELECT current_database()')"
[[ "$TARGET_DB" =~ (restore|disposable|test|staging) ]] \\
  || fail "Target database name must contain restore, disposable, test, or staging; refusing to continue."
TABLE_COUNT="$(psql "$RESTORE_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type='BASE TABLE'")"
[[ "$TABLE_COUNT" == "0" ]] || fail "Target database is not empty (found $TABLE_COUNT base tables). Use a newly created disposable database."

printf '==> Restoring into operator-confirmed empty disposable database: %s\\n' "$TARGET_DB"
pg_restore --exit-on-error --single-transaction --no-owner --no-acl \\
  --dbname "$RESTORE_DATABASE_URL" "$BACKUP"

printf '==> Validating restored schema and Prisma migration history\\n'
RESTORED_TABLES="$(psql "$RESTORE_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
MIGRATION_COUNT="$(psql "$RESTORE_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM public."_prisma_migrations"')"
UNFINISHED_MIGRATIONS="$(psql "$RESTORE_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL')"

(( RESTORED_TABLES > 0 )) || fail "No public application tables were restored."
(( MIGRATION_COUNT > 0 )) || fail "Prisma migration history is missing."
(( UNFINISHED_MIGRATIONS == 0 )) || fail "Found $UNFINISHED_MIGRATIONS unfinished Prisma migrations."

printf '\\nSUCCESS: restore rehearsal checks passed.\\n'
printf 'Target database: %s\\n' "$TARGET_DB"
printf 'Public tables restored: %s\\n' "$RESTORED_TABLES"
printf 'Prisma migration records: %s\\n' "$MIGRATION_COUNT"
printf 'Unfinished migrations: %s\\n' "$UNFINISHED_MIGRATIONS"
printf 'Backup SHA-256: %s\\n' "$BACKUP_SHA256"
printf 'This validates archive restore and migration metadata only; run the staging API smoke and representative data checks before sign-off.\\n'
