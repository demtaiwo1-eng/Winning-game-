# Deploy the API with the shared Aiven database

Aiven PostgreSQL is the shared database, not an application/API host. The app
needs a public HTTPS Node.js API between the web or Android client and Aiven.
Never connect an APK or browser directly to PostgreSQL, and never put database
credentials in frontend code, APK builds, or GitHub Actions variables.

## Requirements for any API host

Choose a host that can run this repository's Node.js 20/Express API continuously
or as compatible serverless functions, provide a public HTTPS URL, and make
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

The host must run the API's Prisma migrations before serving a new schema. Run
the idempotent seed task when required. Verify both `/health` and `/ready`;
`/ready` verifies the database connection.

Cloud providers often use changing outbound IPs. If Aiven has an IP allowlist,
configure fixed egress on the API host or intentionally configure Aiven public
access with TLS and strong credentials. Do not assume the API host has a
stable outbound IP.

## Connect web and Android builds

After deploying the API, set GitHub Actions repository variable `VITE_API_URL`
to the public HTTPS API base ending in `/api/v1` (for example,
`https://your-api-host.example/api/v1`). The web build and Android APK use this
same setting. The app routes relative API calls to the configured host on web
and in Capacitor, and the APK build workflow checks `/health` and `/ready`
before publishing a Release.

Download a tested APK from the GitHub Release only when the API is configured
and ready. If the API URL is not set, Actions can still create an APK artifact
for testing, but it is not published as an online-ready release.

Planner drafts and eligible offline edits stay on the device until connectivity
returns. Login, account creation, payments, wallet, escrow, and checkout require
a live API. Payment operations also require valid payment-provider credentials.

## Current deployment blocker

The repository is prepared to use an API URL from any compatible provider, but
there is currently no active API host configured. Aiven alone cannot serve the
Express API. Add an API host/account, then configure its secrets and the
`VITE_API_URL` Actions variable before expecting shared online app functions or
an online-ready APK to work.
