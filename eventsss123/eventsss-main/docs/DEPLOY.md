# Deploy the API with the shared Aiven database

GitHub Actions builds the app and APK, but GitHub Actions/GitHub MCP is not a hosted API or PostgreSQL
service. The Android app must call a deployed HTTPS API; database credentials stay on the API server
and are never embedded in the web app or APK.

1. In Render, create a Blueprint from this repository and its default branch. The blueprint creates the
   `ess-api` service and prompts for `DATABASE_URL`; it does not provision a second PostgreSQL database.
2. Set `DATABASE_URL` in Render to the Aiven PostgreSQL connection URI with `sslmode=require`. Keep the
   password in Render's environment-variable secret field; do not commit it or put it in a GitHub
   Actions variable.
3. Wait for deployment. The service runs Prisma migrations and idempotent seed data before starting.
   Verify `https://<your-service>.onrender.com/health` and `/ready`; `/ready` confirms database access.
4. In GitHub, add Actions repository variable `VITE_API_URL` with
   `https://<your-service>.onrender.com/api/v1`. The APK workflow checks both health endpoints and
   builds web assets with that URL.
5. After a successful default-branch Actions run, download the tested debug APK and SHA-256 checksum
   from the GitHub Release. Pull requests and other branches produce an Actions APK artifact but do not
   publish a release.

The app stores planner drafts and safe pending edits in local device/browser storage while offline and
replays eligible API changes when connectivity returns. Account creation, login, payments, wallet,
escrow and checkout operations require a live API connection. Offline drafts remain on that device
until the user reconnects, signs in, and submits them.

Render's free web-service plans may sleep after inactivity. Check current plan limits before relying on
the service for production traffic.
