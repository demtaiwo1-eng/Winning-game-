# Phase 0 baseline and release-safety record

**Recorded:** 2026-10-30  
**Repository:** `demtaiwo1-eng/Winning-game-`  
**Application root:** `eventsss123/eventsss-main/`  
**Phase status:** PARTIALLY COMPLETE — production backup/restore rehearsal and live service verification remain BLOCKED pending authorized access.

## 1. Source-control baseline

| Item | Recorded value |
|---|---|
| Default branch | `main` |
| Main/base SHA at PR creation | `908c468bc5ecc25e9291f86b8e15a76cdb036de2` |
| Working branch | `ephinta/full-phased-improvement-patch` |
| Working branch SHA | `52eef5c2eab89f85a9299e81f68a05d67181aa0c` |
| Draft PR | [#1 — Ephinta phased improvement patch](https://github.com/demtaiwo1-eng/Winning-game-/pull/1) |
| PR state | Open, draft, not merged |
| Repository changes in PR at baseline | 6 files; 7 commits |
| Working tree / local uncommitted state | Not observable through the GitHub connector |

Do not merge this PR or deploy it as part of Phase 0.

## 2. Service topology discovered in tracked configuration

The tracked root `render.yaml` declares one Render service:

- `ess-api`: Render `web` service, Node runtime, Oregon region, free plan.
- Build command: `cd eventsss123/eventsss-main && npm install --include=dev && npm run build`.
- Start command runs `npm --prefix apps/api run db:deploy` before starting the API.
- Health check path: `/ready`.
- `DATABASE_URL` and `JWT_SECRET` are declared as externally supplied values (`sync: false`).

The tracked Render blueprint does **not** declare a Render PostgreSQL database or a frontend/static-site service. The actual live Render dashboard, deployed domains, linked database, backups, service status, and environment-variable values are not visible from this repository configuration. Confirm these in the Render dashboard before deployment changes.

## 3. Environment variable inventory (names only)

The tracked root and API example files reference:

- Runtime/API: `NODE_ENV`, `PORT`, `APP_BASE_URL`, `CORS_ORIGINS`, `ALLOW_CODESPACES`
- Database: `DATABASE_MODE`, `DATABASE_URL`, `DATABASE_URL_LOCAL`, `DATABASE_URL_ONLINE`
- Authentication: `JWT_SECRET`, `ACCESS_TTL_MIN`, `REFRESH_TTL_DAYS`
- Commerce: `COMMISSION_BPS`, `DEFAULT_CURRENCY`, `PAYMENT_MODE`, `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- Web build: `VITE_API_URL`
- Optional chain configuration in root example: `WEB3_PROVIDER_URL`, `ESCROW_CONTRACT_ADDRESS`, `CHAIN_ID`

These are names from tracked example/configuration files, not proof that each variable is set in production. No secret values are recorded here.

## 4. Database and migration baseline

- Prisma datasource provider: PostgreSQL.
- Prisma schema: `apps/api/prisma/schema.prisma`.
- Tracked Prisma migration SQL files: **14**.
- Migration directories, in order:
  1. `20260930100327_init`
  2. `20261001120000_password_reset_tokens`
  3. `20261001123000_affiliate_role`
  4. `20261001190000_event_readiness_verifier`
  5. `20261001200000_scale_zones_multi_verifier`
  6. `20261001210000_compendium_production`
  7. `20261001220000_verifier_profiles`
  8. `20261006224500_cart_checkout_session`
  9. `20261008112105_add`
  10. `20261008124000_event_client_request_id`
  11. `20261008140000_event_plan_answers`
  12. `20261008141500_event_task_tiers`
  13. `20261009010000_phase7_guest_checkin`
  14. `20261009130000_flutterwave_reconciliation`
- A separate legacy SQL file exists at `db/migrations/001_unified_master_schema.sql`. It is inventoried separately and must not be assumed to be part of Prisma's migration history or run automatically.
- CI run #18 applied Prisma migrations to its disposable PostgreSQL 16 service and ran database integration tests successfully. This is not a production migration or backup.

## 5. Automated baseline evidence

GitHub Actions run [#18 — EPHINTA Web Checks and Android APK](https://github.com/demtaiwo1-eng/Winning-game-/actions/runs/41049581788):

- Commit: `52eef5c2eab89f85a9299e81f68a05d67181aa0c`
- Event: `pull_request`
- Overall conclusion: **success**
- Web/API job: successful dependency install, API/web checks, disposable PostgreSQL migration, DB integration tests, and web build.
- Android job: successful SDK setup/licence step, Capacitor sync, debug APK build, and APK artifact collection.
- This CI evidence validates that commit in GitHub's runner environment. It does not validate production domains, production credentials, a live database, real payment providers, or physical-device workflows.

## 6. Mandatory production backup and restore rehearsal — NOT YET VERIFIED

No production database connection or Render dashboard access was used. No production backup was taken, and no restore rehearsal is claimed. Do not proceed with a production migration or deployment until the owner/operator completes the following against the actual Render PostgreSQL database.

### Safe backup procedure

1. In Render, identify the PostgreSQL service actually used by `ess-api`; confirm its database name, region, plan, and private connection string. Do not paste the connection string into chat or commit it.
2. Run the following from a trusted terminal with the database URL supplied through a secure environment variable. Store the dump outside the repository in encrypted/private storage.

```bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL securely in this terminal}"
mkdir -p "$HOME/ephinta-db-backups"
BACKUP="$HOME/ephinta-db-backups/ephinta-$(date -u +%Y%m%dT%H%M%SZ).dump"
umask 077
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file "$BACKUP"
test -s "$BACKUP"
pg_restore --list "$BACKUP" >/dev/null
sha256sum "$BACKUP" > "$BACKUP.sha256"
echo "Backup created and archive structure verified: $BACKUP"
```

3. Copy the dump and checksum to approved encrypted storage with restricted access. Keep the original production database unchanged.
4. Provision a separate, empty, non-production PostgreSQL database. Restore only into that disposable target (never into production):

```bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Set a disposable NON-PRODUCTION database URL}"
: "${BACKUP:?Set the exact backup file path}"
sha256sum --check "$BACKUP.sha256"
pg_restore --exit-on-error --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" "$BACKUP"
```

5. Point a staging copy of the API at the restored database. Run read-only checks for user counts, vendor profiles, events, bookings, payment intents, wallet/ledger rows, and migration history. Run the existing API/database test suites. Compare key row counts and representative records with the source backup metadata.
6. Record operator, UTC timestamp, source database identifier (not its credentials), backup file checksum, restore target identifier, validation results, and any warnings in the release record.

**Important:** a successful `pg_dump` and `pg_restore --list` only verifies archive creation/structure. The restore rehearsal is complete only after restoring into a separate database and validating the restored application data.

## 7. Rollback procedure

- Application rollback: redeploy the previously successful Render deployment/release and keep the database schema backward compatible with that application version.
- Database rollback: do not run ad-hoc reverse SQL or reset production. Prefer forward-fix migrations. If an approved recovery requires restoring a backup, restore it to a separate database first, validate it, then coordinate a controlled connection switch with the owner/operator.
- Before every future production migration: verify a recent restorable backup, confirm migration SQL and expected lock/data impact, deploy to staging, run smoke tests, and obtain explicit owner approval.
- Keep the previous application deployment and backup until post-deployment validation is complete.

## 8. Phase 0 exit checklist

- [x] Record main/base SHA and working branch/PR state.
- [x] Inventory tracked Render service declaration and identify missing topology details.
- [x] Inventory environment variable names without exposing values.
- [x] Record Prisma schema location and all 14 tracked Prisma migrations.
- [x] Record separate legacy SQL migration file.
- [x] Record successful API/web/DB CI and Android debug APK workflow evidence.
- [x] Write safe backup, restore rehearsal, and rollback procedures.
- [ ] Confirm actual Render services, production domains, and database identity in the dashboard.
- [ ] Take a production PostgreSQL backup and verify its checksum/archive.
- [ ] Restore that backup into a separate non-production database and validate key records.
- [ ] Record the completed restore rehearsal and operator sign-off.

**Exit decision:** Phase 0 is **not fully signed off** until the final four operational checks above are completed. Those checks require authorized access to the live Render/database environment; they cannot be truthfully completed from GitHub repository files or CI.
