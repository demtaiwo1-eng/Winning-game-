# Phase 4 — Event planner completeness: guest invitations and RSVP

## Delivered slice

- Add a CSV guest import flow to the authenticated event guest/check-in workspace.
- Accept a header row with `Name` (or `Full name`), optional `Email`, `Phone`, and `Plus ones` columns.
- Validate all rows in the browser and cap each upload at 500 guests before calling the existing owner-scoped bulk guest API.
- Add guest CSV export with RSVP status and per-guest invitation URL. Spreadsheet formula prefixes are neutralized and CSV cells are quoted/escaped.
- Add a public `/rsvp/:token` page that reads the existing public RSVP endpoint and submits ACCEPTED, DECLINED, or MAYBE plus-one counts.
- Add per-guest copy-invitation-link actions in the event guest workspace.
- Add unit tests for quoted CSV fields, validation, row limits, invitation URLs, and formula neutralization.

## Security and data handling

- Guest import uses the existing authenticated event route and owner checks; it does not introduce a new write API or database schema.
- Public RSVP uses the existing opaque per-guest UUID token. The page displays only the invited guest's name and event details returned by the public RSVP view; it does not expose guest email or phone.
- Invitation links are bearer links: organizers should share each link only with its intended guest. CSV export contains guest contact fields and invitation URLs and should be handled as private event data.
- No bulk email/SMS sending is introduced; this slice prepares invitation links for sharing without inventing delivery or consent.
- No event records, guest records, payment records, or wallet balances are modified outside an organizer's explicit import or a guest's RSVP submission.
- No schema migration, destructive operation, paid Render resource, or payment-provider change.

## Validation and remaining Phase 4 scope

CI must pass on the final PR head before merge. The broader Phase 4 acceptance scope remains open: guest check-in history/privacy controls, full task timeline/reminders, planned-vs-actual budget views, vendor booking linkage, event readiness exports/print views, and browser/device end-to-end testing.
