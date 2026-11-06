# Run the application locally

From the repository root, run:

```sh
npm run dev
```

This starts the API and Vite development server directly. The API binds to
port 5000 and the web app binds to port 5173; startup fails rather than silently
choosing alternate ports if either port is occupied. Startup waits for database
readiness before showing the app URL:

- App: <http://localhost:5173/>
- API health: <http://localhost:5000/health>
- Database readiness: <http://localhost:5000/ready>

Set up the ignored local API environment file before the first run. The API
needs a valid `DATABASE_URL` (or `DATABASE_URL_ONLINE`) and a `JWT_SECRET` of
at least 32 characters. Keep credentials out of tracked files.

Run `npm run dev:verify` when you want to run the checks and production builds
before starting development servers. `npm run dev:quick` is an alias for
`npm run dev`.
