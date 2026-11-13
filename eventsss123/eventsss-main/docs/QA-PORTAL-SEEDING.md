# EPHINTA portal-scale QA fixtures

The scale seeder creates **1,000 synthetic identities per active portal role**:

- CLIENT
- ORGANIZATION (500 event-planning and 500 service-provider profiles)
- VENDOR
- AFFILIATE
- CONSULTANT
- VERIFIER
- ADMIN

That is 7,000 synthetic accounts, 7,000 wallets and 1,500 vendor profiles. ADMIN fixtures are privileged and must remain in a disposable local database.

RIDER is intentionally excluded: the current application decommissions Rider sign-in and refresh. Do not count disabled Rider identities as a working portal.

## Safety requirements

The seeder requires all of the following:

- `QA_SCALE_CONFIRM=YES`
- `QA_DATABASE_URL` pointing to PostgreSQL on `localhost`, `127.0.0.1` or `::1`
- `NODE_ENV` must not be `production`

It refuses Render, Neon, Supabase and other remote database hosts. It does not use OPay, Paystack, bank transfers, live webhooks or real customer data. Each seeded account receives a random throwaway password hash; the generated password is not printed.

## Seed the fixtures

From `eventsss123/eventsss-main`, after installing dependencies and applying Prisma migrations:

```bash
QA_SCALE_CONFIRM=YES \
QA_DATABASE_URL='postgresql://ess:ess@127.0.0.1:5432/ess?schema=public' \
npm run qa:seed:portals
```

The command prints the unique `prefix` used for this run. Preserve that prefix if you want to clean the fixtures later.

## Clean one run

```bash
QA_SCALE_CONFIRM=YES \
QA_DATABASE_URL='postgresql://ess:ess@127.0.0.1:5432/ess?schema=public' \
QA_PORTAL_PREFIX='qa-portal-<printed-run-prefix>' \
npm run qa:seed:portals -- --clean
```

Cleanup deletes only users whose email begins with that exact run prefix. Prisma cascades remove their related wallets and vendor profiles.

## Full QA run

The scale runner seeds the 7,000 identities, runs the existing 300-user database workflow regression (100 clients, 100 vendors and 100 verifiers), then runs API/web checks, production web build, strict design audit and browser E2E. It removes the seeded 7,000-user population at the end, including after a failed test phase.

**Important:** the 7,000-account population test is distinct from a 7,000-user concurrent load test. The existing business-journey regression currently exercises 300 authenticated personas. A separate concurrency/load test is required before claiming 7,000 simultaneous active users.
