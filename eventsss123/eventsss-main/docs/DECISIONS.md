# ESS Owner Decisions (locked for Phase 1+)

Recorded 2026-10-05.

## Rider — full product removal
- Remove Rider from UI, registration, and active API product surface.
- `GET/PATCH /api/v1/rider/jobs` return `410 Gone`.
- Keep `Role.RIDER` and historical `DispatchJob` rows for migration safety in this phase.
- Existing rider data is not deleted in Phase 1.

## Organization
- Add `ORGANIZATION` to Prisma `Role` and registration.
- Phase 1 provides the role, label and protected dashboard target.
- Phase 2 distinguishes `EVENT_PLANNING` organizations (planner dashboard) from
  `SERVICE_PROVIDER` organizations (vendor-style dashboard and profile).

## Password
- At least 8 characters, including a special character.
- This rule is shared by registration and password reset validation.

## User-facing labels
- Internal role `CLIENT` is displayed as **Executive Planner**.
- Executive Planner registration starts through the event wizard, not the shared role picker.

## Deletion / cleanup
- No current deletion is performed in Phase 1.
- `eventsss-main/` and other duplicate artifacts remain until their contents are inventoried and a later cleanup phase is authorized.
