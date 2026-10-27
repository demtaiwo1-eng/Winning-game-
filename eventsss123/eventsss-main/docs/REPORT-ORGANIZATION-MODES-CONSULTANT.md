# Organization Modes and Consultant Portal Report

## Changelog

- Added `ORGANIZATION` as an active account role with a required operating mode:
  `EVENT_PLANNING` or `SERVICE_PROVIDER`.
- Organization event-planning accounts use the Executive Planner dashboard and
  client-scoped APIs. Service-provider organizations receive a vendor profile,
  the vendor-style dashboard, and vendor-scoped authorization.
- Added mode selection to Organization signup and conditionally requests
  business details only for service-provider organizations.
- Added Consultant to the active role choices and provided the existing
  minimal notifications dashboard.
- Added registration-schema and role-authorization tests.
- Clarified the Organization mode decision and updated the planner dashboard
  heading to use the required Executive Planner label.

## Database and migration note

The migration adds the `OrganizationMode` enum, the `ORGANIZATION` role, and
`User.organizationMode`. Prisma also generated `DROP DEFAULT` operations for
`updatedAt` on `EventReadiness`, `EventServiceCheck`, and `VerifierProfile`.
These reconcile existing database defaults with the current Prisma schema;
the migration was applied in the development database and `prisma migrate
status` reported the database up to date. No user or event rows were deleted.

## Verification

- API production build: passed.
- Web production build: passed.
- API suite: 40 passed, 1 database-dependent test skipped.
- Web suite: 6 passed.
- Prisma migration status: up to date (9 migrations found).
- Type/problem diagnostics for touched API and web files: no errors.

The skipped test requires the explicit database-test configuration and was not
run as part of the default suite. Signup against an external mail provider and
physical-device behavior were not validated.

## Phone tap-through checklist

1. Open the public landing page and open the role chooser.
2. Choose **Organization** and select **Create your workspace**.
3. Verify both organization modes are offered and neither is preselected.
4. Select **Plan and manage events**; confirm business-only fields are hidden.
5. Complete signup and verify the account opens the Executive Planner
   command center.
6. Sign out, register another Organization, choose **Provide services to event
   planners**, and verify business name and provider details are requested.
7. Verify the provider-mode account opens the vendor-style catalog, wallet,
   plans, and KYC tabs.
8. Open the Consultant role and verify the minimal notifications dashboard
   loads.
9. Verify an existing Client account is still presented as **Executive
   Planner** and continues to access its existing dashboard.
