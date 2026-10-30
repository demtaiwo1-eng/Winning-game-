# Phase 0 continuity, backup, network and health-check plan

**Recorded:** 2026-10-30 UTC  
**Repository:** `demtaiwo1-eng/Winning-game-`  
**Production API:** `ephinta_wss` in Oregon  
**Database source of truth:** `ephinta_db` in Oregon  
**Data-source decision:** Owner confirms there is no previous customer/business data anywhere. Treat the currently connected `ephinta_db` as the sole, intentionally empty source of truth. No legacy import is required.

## 1. Database continuity decision

Keep the existing database and upgrade it in place; do not create a second empty database or change database name/user/region. This preserves the already-applied Prisma schema and avoids an unnecessary connection-string migration.

Recommended production target:

- PostgreSQL 16 (current version is already 16.15).
- Render Postgres `1c-2g` compute plan (1 CPU, 2 GB RAM, 100 max connections).
- Keep the existing Oregon region, co-located with `ephinta_wss`.
- Enable automatic disk autoscaling if available for this database.
- Use Render's internal database URL from the API service, never the external URL for same-region application traffic.
- Enable Render High Availability only if the owner accepts the additional standby cost and the workspace meets Render's Pro-workspace requirement. HA requires at least 1 CPU and PostgreSQL 13+, both satisfied by the recommended database plan and current PostgreSQL version. HA standby is billed at the same compute/storage as the primary.
- Keep PITR enabled through a paid Postgres compute plan. Current Render docs describe a 3-day recovery window on Hobby workspaces and 7 days on Pro or higher. PITR recovery creates a separate recovery instance that must be validated before cutover.

Current observed database use is very low (0–1 active connections in the sampled period, CPU around 0.5–1%, memory around 35–44 MB); the recommended 1 CPU / 2 GB plan is a conservative starting floor for production headroom and HA eligibility, not a claim that current load requires it.

### Current published price references (verify in Dashboard before applying)

- Render Postgres `1c-2g`: listed at approximately **US$40/month**.
- Render Pro workspace: listed at **US$25/month**.
- HA standby uses the same plan and storage as primary, so an HA configuration at this size is approximately **US$105/month total** before storage/other usage (US$40 primary + US$40 standby + US$25 workspace).
- If the owner does not want HA or the Pro workspace cost, the lower-cost continuity baseline is a paid Postgres primary with PITR and independent logical exports; this has a single-primary availability risk.

Prices are indicative snapshots from Render's published pricing page, not a billing quote. No paid plan or workspace upgrade has been made.

## 2. Backup and restore rehearsal

The existing Free database has no Render managed logical exports or PITR. Before production use:

1. Upgrade the existing database to a paid compute plan in Render Dashboard.
2. Create a logical export from Database → Recovery → Create export, download it, and store it in restricted encrypted storage outside the repository.
3. Record SHA-256 checksum and UTC timestamp.
4. Create a separate disposable PostgreSQL 16 database in the same region (or a trusted isolated test instance). Never restore over the production database.
5. Restore the downloaded export into that empty database using Render's documented restore workflow / `pg_restore`.
6. Verify schema, all Prisma migration records, and representative row counts. At the current baseline, all 35 application tables are expected to be empty and `_prisma_migrations` should contain 14 finished migrations.
7. Run API smoke tests against the restored database using a staging API or controlled local test process.
8. Record export ID/checksum, restore target, UTC timestamp, validation results, and operator sign-off.

For an independent manual export, use PostgreSQL 16 client tools on a trusted machine. Enter the external database URL locally as a secure environment variable (never in chat, shell history, source control, or logs):

```bash
set -euo pipefail
: "${DATABASE_URL:?Set the external database URL securely in this terminal}"
umask 077
BACKUP="$HOME/ephinta-db-backups/ephinta-$(date -u +%Y%m%dT%H%M%SZ).dump"
mkdir -p "$(dirname "$BACKUP")"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file "$BACKUP"
test -s "$BACKUP"
pg_restore --list "$BACKUP" >/dev/null
sha256sum "$BACKUP" > "$BACKUP.sha256"
```

Then restore only to a separate empty non-production database:

```bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Set a disposable non-production database URL}"
: "${BACKUP:?Set the exact backup file path}"
sha256sum --check "$BACKUP.sha256"
pg_restore --exit-on-error --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" "$BACKUP"
```

The Render integration available in this session exposes read-only SQL and metadata but no database upgrade, backup/export, restore, or IP-allowlist mutation operation. No backup or restore rehearsal is falsely claimed complete.

## 3. Network security

- Keep API and DB in Oregon, same Render workspace.
- Verify `DATABASE_URL` on `ephinta_wss` uses the database's **internal** URL from Connect → Internal. Do not reveal or paste the URL.
- Once internal connectivity is confirmed, remove the broad external `0.0.0.0/0` allow rule. Prefer no external access for the database. If a controlled off-platform backup/CI client is required, allow only its fixed public IPv4 `/32` and require TLS 1.2+ (`sslmode=require`); never use a broad CIDR.
- Re-check API readiness after changing the allowlist. The external allowlist does not affect same-region internal Render traffic.
- Rotate the database password only in a coordinated operation that updates the API secret and verifies reconnection. Do not rotate it as part of this baseline.
- Keep application secrets in Render secret storage; do not log connection strings.

The external allowlist was not changed because the current API connection URL could not be read/verified through the available integration, and an uncoordinated change could disrupt backup access or operations.

## 4. Health checks

The application code on `main` defines:

- `GET /health`: process liveness; returns JSON `{ "status": "ok", "uptime": ... }`.
- `GET /ready`: database readiness; runs `SELECT 1` and returns `{ "status": "ready" }`, or HTTP 503 when DB is unavailable.

The tracked root `render.yaml` on `main` already specifies `healthCheckPath: /ready`, but the actual live Render service currently reports an empty health-check path. Set the active service's Health Check Path to `/ready` in Render Dashboard → `ephinta_wss` → Settings, save, then verify a successful deploy/health check. Also verify externally:
- `https://ephinta-wss.onrender.com/health` returns HTTP 200.
- `https://ephinta-wss.onrender.com/ready` returns HTTP 200 and `{"status":"ready"}`.

The endpoints could not be independently reached from this session's network, so public HTTP health is not yet certified. The deployment logs did confirm API startup and port 10000 detection.

## 5. Phase 0 status

**PARTIALLY COMPLETE — NOT SIGNED OFF.**

Completed: source-of-truth decision, no-legacy-data decision, DB schema/migration inspection, successful API deployment/startup, and documented target architecture.

Still outstanding: paid database plan selection/upgrade, optional Pro+HA cost approval, export and restore rehearsal, final internal-URL verification, safe external allowlist tightening, live `/ready` configuration, and external HTTP smoke test.

No database data/schema was modified; no paid upgrade, IP allowlist change, restore, or source branch merge was performed by this plan.
