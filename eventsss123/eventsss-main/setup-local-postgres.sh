#!/usr/bin/env bash
# Connects the ESS API to the PostgreSQL you already have installed on your computer.
# Run from the VS Code terminal (on Windows use Git Bash):  bash setup-local-postgres.sh
# Keep local-postgres.patch in the same folder as this script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="$SCRIPT_DIR/local-postgres.patch"

DB_NAME="ess_dev"
DB_USER="ess"
DB_PASS="ess_dev_password"
PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
ADMIN_USER="${PG_ADMIN_USER:-postgres}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${PG_HOST}:${PG_PORT}/${DB_NAME}?schema=public"

say() { printf '\n==> %s\n' "$1"; }
warn() { printf 'WARNING: %s\n' "$1" >&2; }
fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO_ROOT" ] || fail "Run this inside the eventsss repo."
cd "$REPO_ROOT"
[ -d apps/api ] || fail "apps/api not found. Run this from the eventsss repo."
[ -f "$PATCH_FILE" ] || fail "local-postgres.patch not found next to this script."

say "Applying patch"
if git apply --check "$PATCH_FILE" 2>/dev/null; then
  git apply "$PATCH_FILE"
  echo "Patch applied."
elif git apply --reverse --check "$PATCH_FILE" 2>/dev/null; then
  echo "Patch already applied, skipping."
else
  fail "Patch does not apply cleanly. scripts/postgres/create-ess-db.sql may already exist."
fi

say "Locating psql"
if ! command -v psql >/dev/null 2>&1; then
  for dir in /c/Program\ Files/PostgreSQL/*/bin /Applications/Postgres.app/Contents/Versions/latest/bin /opt/homebrew/bin /usr/local/bin; do
    if [ -x "$dir/psql" ] || [ -x "$dir/psql.exe" ]; then
      PATH="$dir:$PATH"
      break
    fi
  done
fi
command -v psql >/dev/null 2>&1 || fail "psql not found. Add your PostgreSQL 'bin' folder to PATH and run again."
echo "Using $(command -v psql)"

say "Connecting as admin user '${ADMIN_USER}'"
if [ -z "${PGPASSWORD:-}" ]; then
  read -r -s -p "Password for PostgreSQL user '${ADMIN_USER}' (set during installation): " ADMIN_PASS
  echo
  export PGPASSWORD="$ADMIN_PASS"
fi
psql -h "$PG_HOST" -p "$PG_PORT" -U "$ADMIN_USER" -d postgres -tAc "SELECT 1" >/dev/null \
  || fail "Could not log in. Check the password, host and port (default port is 5432)."

say "Creating database user and database"
psql -h "$PG_HOST" -p "$PG_PORT" -U "$ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 \
  -v db_user="$DB_USER" -v db_pass="$DB_PASS" -v db_name="$DB_NAME" \
  -f scripts/postgres/create-ess-db.sql
unset PGPASSWORD

say "Connecting the API (apps/api/.env)"
ENV_FILE="apps/api/.env"
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "${ENV_FILE}.bak"
  echo "Backup saved as ${ENV_FILE}.bak"
else
  touch "$ENV_FILE"
fi
if grep -q '^DATABASE_URL=' "$ENV_FILE"; then
  sed -i.tmp "s|^DATABASE_URL=.*|DATABASE_URL=\"${DATABASE_URL}\"|" "$ENV_FILE"
  rm -f "${ENV_FILE}.tmp"
else
  printf 'DATABASE_URL="%s"\n' "$DATABASE_URL" >> "$ENV_FILE"
fi
git check-ignore -q "$ENV_FILE" || warn "$ENV_FILE is not git-ignored. Do not commit it."

say "Preparing Prisma"
cd apps/api
if [ -f prisma/schema.prisma ]; then
  grep -q 'env("DATABASE_URL")' prisma/schema.prisma \
    || warn "prisma/schema.prisma does not read env(\"DATABASE_URL\"). Check the datasource block."
  if [ ! -d node_modules ] && [ ! -d ../../node_modules ]; then
    npm install
  fi
  npx prisma generate
  if ls prisma/migrations/*/migration.sql >/dev/null 2>&1; then
    npx prisma migrate deploy
  else
    npx prisma db push
  fi
else
  warn "apps/api/prisma/schema.prisma not found. Skipping Prisma steps."
fi
cd "$REPO_ROOT"

say "Testing connection"
PGPASSWORD="$DB_PASS" psql -h "$PG_HOST" -p "$PG_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" \
  || fail "Could not connect with the new credentials."

cat <<EOF

Done.
  Database : ${DB_NAME}
  User     : ${DB_USER}
  URL      : ${DATABASE_URL}
EOF
