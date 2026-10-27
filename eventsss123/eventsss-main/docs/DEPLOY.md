# Deploy with Render

This app uses a Node.js/Express API and PostgreSQL. For a shared online setup,
deploy the API as a Render Web Service, the frontend as a Render Static Site,
and use Render Postgres. The browser and Android app call the API over HTTPS;
they must never connect directly to PostgreSQL or contain database credentials.

## 1. Connect the GitHub repository

1. Sign in to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New > Postgres** or **New > Web Service**, then connect GitHub when
   prompted. Authorize Render's GitHub App for
   `demtaiwo1-eng/Winning-game-`.
3. Use the `main` branch when creating each service. Render can then
   automatically deploy changes pushed to that branch.

## 2. Create the PostgreSQL database

1. In Render, choose **New > Postgres** and create a database in the region
   where the API service will run.
2. Wait until the database status is **Available**.
3. In the database's **Connect** menu, copy its **Internal Database URL**.
   Use this URL for the Render API service when both services are in the same
   Render region. Keep it private.

The database starts empty; the app does not automatically copy data from an
existing database. If you need accounts, events, or bookings from another
database, plan and verify an export/import before switching clients. Do not
delete the existing database during setup.

## 3. Deploy the API from the Render Blueprint

The repository-root `render.yaml` configures the API service while leaving
Render's **Root Directory** unset. Its commands explicitly change into the
nested app directory, so no Root Directory change is needed for this or any
other service.

1. Push the repository-root `render.yaml` to the `main` branch on GitHub.
2. In Render, choose **New > Blueprint**, connect
   `demtaiwo1-eng/Winning-game-`, select `main`, and review the Blueprint
   preview before confirming.
3. The Blueprint defines the API service named `ess-api`; it does not create,
   replace, or delete a PostgreSQL database. If you want it to update an
   existing API service instead of creating another one, the service name in
   `render.yaml` must match that existing service's name. Do not confirm a
   preview that would create an unwanted duplicate service.
4. When Render requests values for the `sync: false` variables, enter the
   private Render Postgres **Internal Database URL** as `DATABASE_URL` and a
   new random `JWT_SECRET` (at least 32 characters). Never put secrets in
   GitHub or the Blueprint file.
5. Confirm the Blueprint's `region` in `render.yaml` matches the database's
   region; the internal URL works for services in the same Render region.
   The example currently specifies `oregon`.
6. Deploy and review the service logs. The Blueprint runs migrations before
   starting the API and configures `/ready` as its health check.

The Blueprint uses Render's Free Web Service plan for initial testing. Free
services spin down when idle; see the availability note below before using this
for production.

## 4. Deploy the frontend as a Render Static Site

1. Click **New > Static Site**, select the same repository and `main` branch.
2. Leave **Root Directory** empty so Render checks out the repository root.
3. Set **Build Command** to:

   ```sh
   cd eventsss123/eventsss-main && npm install --include=dev && npm run build -w apps/web
   ```

4. Set **Publish Directory** to:

   ```text
   eventsss123/eventsss-main/apps/web/dist
   ```

5. Add the build-time environment variable `VITE_API_URL` with the API's
   Render URL ending in `/api/v1`, for example:

   ```text
   https://your-api-service.onrender.com/api/v1
   ```

6. Create the site and copy its HTTPS `onrender.com` URL. If the site uses
   client-side routes, add a Render rewrite from `/*` to `/index.html` with
   status `200` in **Redirects/Rewrites**.
7. Set `CORS_ORIGINS` on the API service to this exact site origin (no trailing
   slash), then redeploy the API.

## 5. Verify the deployment and configure Android builds

Open the API service URLs:

- `https://YOUR_API.onrender.com/health` — confirms the API process responds.
- `https://YOUR_API.onrender.com/ready` — confirms the API can reach PostgreSQL.

Only treat the deployment as ready after both return success. If `/ready`
fails, inspect the Render logs and confirm `DATABASE_URL`, the database region,
and the migration result.

For GitHub Actions APK builds, add repository variable `VITE_API_URL` with the
same API URL ending in `/api/v1`. Build/deploy the frontend again after changes
to its `VITE_API_URL`. The APK workflow checks API health and database
readiness before publishing an online-ready APK. Without a configured API URL,
an APK may still be built for testing, but it is not an online-ready release.

For local development, set `DATABASE_URL_ONLINE` in your ignored
`apps/api/.env` file if you want to use the Render database. With
`DATABASE_MODE=auto`, the launcher prefers reachable local PostgreSQL and falls
back to `DATABASE_URL_ONLINE`. Never commit the `.env` file.

## Optional: put Supabase in front of the Render API

The Supabase Edge Function in `supabase/functions/ess-api-proxy` is an optional
HTTPS gateway; it does not host the API or database. Using the Render API URL
directly is simpler. If you specifically want the Supabase URL:

1. Deploy and verify the Render API first.
2. Configure GitHub Actions with secret `SUPABASE_ACCESS_TOKEN` (a scoped
   Supabase access token with `edge_functions_write`) and variable
   `SUPABASE_PROJECT_REF` (the project reference from the Supabase URL).
3. Link the Supabase project with the CLI and set the Render API origin as a
   function secret, without `/api/v1`:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set ESS_API_BASE_URL=https://YOUR_API.onrender.com
   supabase secrets set ALLOWED_ORIGINS=https://YOUR_SITE.onrender.com
   ```

   Add each production web origin to `ALLOWED_ORIGINS`, comma-separated. Never
   set these secrets to the database URL.
4. Run **Deploy Supabase API Gateway** from GitHub Actions. If you use the
   gateway, set `VITE_API_URL` to:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/ess-api-proxy/api/v1
   ```

## Free-plan limitations and existing data

Render's free options are for testing and hobby projects, not production.
According to Render's current [free instance documentation](https://render.com/docs/free),
a Free Web Service spins down after 15 minutes without inbound traffic and
takes about a minute to wake on a new request. A Free Render Postgres database
expires 30 days after creation. The API's periodic payment reconciliation runs
inside the API process, so it pauses while the free Web Service is spun down.
Choose an appropriate paid plan if the app needs dependable availability,
persistent hosted database service, or continuous payment reconciliation.
Check [Render pricing](https://render.com/pricing) before provisioning.

Planner drafts and eligible offline edits stay on the device until connectivity
returns. Login, account creation, payments, wallet, escrow, and checkout require
a live API. Payment operations also need valid payment-provider credentials.
