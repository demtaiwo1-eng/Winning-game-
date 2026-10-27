# Deploy the API with the shared Aiven database

Aiven PostgreSQL is the shared database, not an application/API host. The app
needs a public HTTPS Node.js API between the web or Android client and Aiven.
Never connect an APK or browser directly to PostgreSQL, and never put database
credentials in frontend code, APK builds, or GitHub Actions variables.

## Requirements for any API host

Choose a host that can run this repository's Node.js 20/Express API as a
persistent Node service, provide a public HTTPS URL, and make
outbound TLS connections to Aiven PostgreSQL. Configure the following on that
host as secret environment variables:

- `DATABASE_URL`: Aiven's TLS-enabled PostgreSQL URI (`sslmode=require`).
  Preserve Aiven's database name and use a low Prisma `connection_limit` if the
  database plan restricts concurrent connections.
- `JWT_SECRET`: a unique random value of at least 32 characters.
- Optional payment and email provider secrets if those integrations are to be
  used (`PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, and the `SMTP_*` settings).
- `CORS_ORIGINS`: comma-separated allowed browser origins when the web app and
  API are hosted on different domains. Capacitor origins are included in the
  API defaults.

The API currently uses in-memory rate limiting and runs periodic payment
reconciliation in its server process, so a plain serverless function conversion
would need a shared rate-limit store and a separately scheduled reconciliation
job.

The host must run the API's Prisma migrations before serving a new schema. Run
the idempotent seed task when required. Verify both `/health` and `/ready`;
`/ready` verifies the database connection.

Cloud providers often use changing outbound IPs. If Aiven has an IP allowlist,
configure fixed egress on the API host or intentionally configure Aiven public
access with TLS and strong credentials. Do not assume the API host has a
stable outbound IP.

## Connect web and Android builds

### Optional Supabase HTTPS gateway

The Supabase Edge Function in `supabase/functions/ess-api-proxy` provides a
Supabase HTTPS URL in front of the existing API. It forwards `/api/v1/*`,
`/health`, and `/ready` requests to that API, while the Node API continues to
connect to Aiven. This avoids rewriting the application backend for Deno, but
it does **not** host or replace the Node API.

1. Deploy the existing Node API to a compatible host and configure its Aiven
   `DATABASE_URL`, `JWT_SECRET`, migrations, and seed data as described above.
   The API host must allow connections from Supabase Edge Functions.
2. Set these GitHub Actions settings:
   - Secret `SUPABASE_ACCESS_TOKEN`: create a scoped access token in your
     Supabase account's Access Tokens settings with `edge_functions_write`.
   - Variable `SUPABASE_PROJECT_REF`: the project reference from the Supabase
     project URL.
3. In a trusted terminal, install/authenticate the Supabase CLI, link the
   project, then set the API host's HTTPS origin as a Supabase secret. It must
   be the API origin only, with no path:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set ESS_API_BASE_URL=https://your-api-host.example
   supabase secrets set ALLOWED_ORIGINS=https://your-web-app.example
   ```

   Add each production web origin to `ALLOWED_ORIGINS`, comma-separated.
   Capacitor origins are already allowed. Do not set these values to the Aiven
   database URL or put database credentials in Supabase function secrets.
4. Run **Deploy Supabase API Gateway** from the GitHub Actions tab on `main`.
   It type-checks and tests the function before deploying it. Use
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/ess-api-proxy/api/v1`
   as GitHub Actions repository variable `VITE_API_URL`.
5. Verify the gateway's `/health` and `/ready` paths. `/ready` must return
   success before treating the online API as ready.

The regular API host can also be used directly: set `VITE_API_URL` to its
HTTPS base ending in `/api/v1` (for example,
`https://your-api-host.example/api/v1`). Both web and Android builds route their
API calls through this configured URL. The APK workflow checks `/health` and
`/ready` before publishing a Release.

Download a tested APK from the GitHub Release only when the API is configured
and ready. If the API URL is not set, Actions can still create an APK artifact
for testing, but it is not published as an online-ready release.

Planner drafts and eligible offline edits stay on the device until connectivity
returns. Login, account creation, payments, wallet, escrow, and checkout require
a live API. Payment operations also require valid payment-provider credentials.

## Remaining deployment requirement

The Supabase gateway can be deployed only after both a Supabase project and a
separately hosted Node API exist. Aiven alone cannot serve the Express API.
Configure the API host first, deploy the gateway if desired, then set
`VITE_API_URL` and run the APK workflow. Without an active upstream API the
gateway responds with a clear 503 and online app functions cannot work.
