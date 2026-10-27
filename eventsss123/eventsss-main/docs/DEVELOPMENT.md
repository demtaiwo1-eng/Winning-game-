# Run the application locally

From the repository root, run:

```sh
npm run dev
```

The command runs API and web checks, builds the API and production web assets,
then starts the API and Vite development server. Startup waits for database
readiness before showing the app URL:

- App: <http://localhost:5173/>
- API health: <http://localhost:5000/health>
- Database readiness: <http://localhost:5000/ready>

Set up the ignored local API environment file before the first run. The API
needs a valid `DATABASE_URL` (or `DATABASE_URL_ONLINE`) and a `JWT_SECRET` of
at least 32 characters. Keep credentials out of tracked files.

For a faster edit/reload loop after checks and builds have passed, use
`npm run dev:quick`. This starts the same API and web servers without repeating
the full verification and production builds.
