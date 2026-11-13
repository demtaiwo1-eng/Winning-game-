# EPHINTA SMTP configuration (when credentials are ready)

SMTP is configured only on the API server. Do not put SMTP credentials in the browser,
mobile app, source control, screenshots, or chat.

## Render service

Open the Render dashboard, select the EPHINTA API web service (`ephinta-wss`),
then open **Environment**. Add these variables when the SMTP provider is ready:

- `SMTP_HOST` — provider SMTP hostname
- `SMTP_PORT` — normally 587 (STARTTLS) or 465 (implicit TLS)
- `SMTP_USER` — SMTP username
- `SMTP_PASSWORD` — SMTP password or app-specific password
- `SMTP_FROM` — verified sender address, e.g. `EPHINTA <no-reply@your-domain.example>`

Save the environment changes and allow Render to redeploy the API. Keep all values
in Render's encrypted environment configuration. Never expose `SMTP_PASSWORD`
through an admin/browser form or a public API response.

## Current behavior and verification

The API environment schema already accepts all five SMTP variables and
`apps/api/.env.example` contains blank placeholders. The mailer currently uses
SMTP for password-reset messages. Payment email notifications require a separate
notification workflow and delivery tests; they must not be described as working
until implemented and verified with a controlled test inbox.

Before enabling customer email:
1. Verify the sender domain (SPF, DKIM and DMARC) with the mail provider.
2. Configure all five variables in Render.
3. Trigger a test message to a controlled inbox.
4. Confirm delivery, bounce/error handling, and audit-safe logging.
5. Only then enable payment and booking email notification events.
