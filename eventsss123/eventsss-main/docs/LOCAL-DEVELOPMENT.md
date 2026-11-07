# EPHINTA local development

## Start the full application

From the repository workspace root:

```bash
cd eventsss123/eventsss-main
npm ci
npm run dev
```

To verify that all three services start and respond, run `npm run dev:smoke` from the same directory. It starts the stack, checks the web/API/database readiness endpoints, and stops the local development database afterwards.

The root `npm run dev` launcher prepares the development database, applies pending Prisma migrations, seeds reference categories and plans, then starts the API and Vite web client.

- Web client: http://localhost:5173
- API health: http://localhost:5000/health
- API + database readiness: http://localhost:5000/ready
- PostgreSQL: 127.0.0.1:5432

The first local start uses Docker Compose and PostgreSQL 16. Docker Desktop (Windows/macOS) or Docker Engine + Compose (Linux/Codespaces) must be running. The local development database uses a named Docker volume and is separate from the live Render database.

The launcher creates a temporary development-only JWT secret when none is configured. Set a persistent `JWT_SECRET` in `apps/api/.env` if you need login sessions to survive restarting the dev server.

## Use a hosted database instead

Create `apps/api/.env` from `apps/api/.env.example`, then set:

```dotenv
DATABASE_MODE=online
DATABASE_URL_ONLINE=postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

Use a private connection string only from a trusted network that can reach the database. Never commit `.env`, paste database credentials into source files, or use the production database for destructive development resets.

With `DATABASE_MODE=auto` (the default), EPHINTA uses local PostgreSQL and starts the local Docker database if necessary. It never falls back to the live database automatically. Set `DATABASE_MODE=online` explicitly when you intentionally want to use the hosted database.

## Database commands

```bash
npm run db:deploy       # apply checked-in Prisma migrations
npm run db:seed         # safely upsert reference categories and plans
npm run db:studio       # open Prisma Studio
npm run dev:db:logs     # follow local PostgreSQL logs
npm run dev:db:stop     # stop the local PostgreSQL container
``

`npm run dev:db:reset` is destructive: it removes the local development database volume and all local test data. It does not affect Render.

## Ports and services

Vite serves the frontend on 5173 and proxies `/api` requests to the local API on 5000. PostgreSQL listens on 5432. These are separate services; the database port is not an HTTP API port.

Render uses its own injected HTTP `PORT` for the API service and a separate managed PostgreSQL endpoint. Do not hard-code Render's HTTP port or expose database credentials in the frontend.

## Troubleshooting

- If Docker is unavailable, start PostgreSQL yourself or configure a reachable `DATABASE_URL_ONLINE`.
- If port 5173 or 5000 is occupied by an unhealthy process, stop that process and retry. The launcher deliberately does not kill unknown processes.
- API startup logs: operating-system temporary directory, file `ephinta-api-dev.log`.
- Web startup logs: operating-system temporary directory, file `ephinta-web-dev.log`.
- Confirm database connectivity at `http://localhost:5000/ready`; a healthy web page alone does not prove the database is connected.
