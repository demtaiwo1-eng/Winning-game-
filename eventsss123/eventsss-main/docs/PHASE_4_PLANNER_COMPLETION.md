# Phase 4 — Event planner completion patch

## Included in this patch

- Adds an active planner workspace to the authenticated client portal, using the existing owner-scoped event APIs.
- Supports editing and saving event title, city, start and end times; the existing wizard's client-request ID continues to make draft handoff retries idempotent.
- Exposes the seven persisted planning-answer fields in the active workspace.
- Adds task creation with due dates, status updates, overdue counts, due-date visibility, and downloadable iCalendar reminders with a 24-hour alarm for import into the user's calendar.
- Adds planned-versus-actual budget lines and actual-spend updates using integer minor units; summaries are calculated from the stored event budget.
- Adds an event-linked booking view using the authenticated caller's existing booking feed.
- Adds event readiness CSV export and browser print / Save as PDF.
- Adds opt-in contact visibility in the guest check-in history view.
- Adds an append-only EventGuestCheckIn table and owner-scoped history endpoint. A check-in history row is written transactionally only for the first successful check-in; duplicate retries do not add duplicate rows.

## Data and safety

- The migration is additive. Existing Guest.checkedInAt and Guest.checkInMethod fields are retained.
- No existing event, guest, booking, wallet or ledger rows are deleted or reset.
- Check-in history contains guest name, method, server timestamp and event association; contact fields are not copied into the history table.
- The history endpoint is scoped through the authenticated event owner and returns a bounded latest-500 list.
- Existing pre-migration check-ins are not reconstructed as audit entries because the historical operator cannot be reliably identified. Their existing Guest check-in fields remain untouched.
- Task reminders are user-triggered `.ics` calendar downloads with a 24-hour VALARM. Delivery is handled by the user's calendar after import; no background push/email scheduler or paid messaging provider is added.
- Vendor bookings are read from the caller-scoped booking feed and filtered by event ID; booking creation remains in the existing marketplace checkout flow where the planner selects an event.
- No payment provider, payout, refund, wallet, OPay or Render plan changes.

## Validation gates

- Run final-head GitHub Actions checks, including Prisma schema generation, migration application to disposable PostgreSQL, API/web checks, database integration tests, web build and Android debug APK build.
- Verify event ownership denial for event detail, plan answers, guest history, tasks and budget endpoints in the existing API integration suite.
- Browser/device flows still require staging/device evidence; CI success alone does not certify them.
- Automatic background reminder delivery remains a separately gated operational capability; do not represent due-date indicators as delivered push notifications.
