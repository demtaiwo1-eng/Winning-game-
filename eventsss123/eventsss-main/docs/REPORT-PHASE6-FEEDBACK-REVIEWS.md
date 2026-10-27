# Booking feedback and marketplace reviews

## Changelog

- Added authenticated marketplace review endpoints using the existing `Review` table; no schema or migration changes.
- Restricted review eligibility to a client’s own `FULFILLED` booking, enforced one review per booking, and validated 1–5 star ratings and comment length.
- Added vendor review averages/counts to marketplace listings and a latest-review endpoint for listing providers.
- Added a client feedback panel listing completed bookings that still need feedback, with a success/error response per submission.
- Added an API test confirming feedback submission and eligibility endpoints require authentication.

## Verification

- API TypeScript build — passed.
- API tests — 25 passed, 1 database-dependent test skipped.
- Web production build — passed.
- Web tests — 6 passed.
- Changed-file diagnostics — no errors.

Database-backed review creation/listing could not be exercised because this environment has no configured test database; the existing DB test remains skipped.

## Phone tap-through checklist

1. Sign in as a client and open **Feedback**; confirm only completed bookings without prior feedback are listed.
2. Select a rating, optionally enter a comment, and submit.
3. Confirm the booking disappears from pending feedback and a success message appears.
4. Return to Marketplace and confirm the vendor card shows the updated average and review count.
5. Confirm incomplete bookings do not appear as eligible and duplicate submissions are rejected by the API.
