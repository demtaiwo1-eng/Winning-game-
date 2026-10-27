# ESS Phase 1 Report — Password Rule Alignment

## Changelog

- Centralized the password policy in `apps/api/src/lib/passwordRule.ts` and use it in API registration/reset validation and the active web authentication UI.
- Set the requested rule to at least 8 characters and at least one special character; registration no longer silently requires uppercase, lowercase, and digits.
- Made password inputs visible by default with an accessible eye toggle, added live requirement checks, and updated reset-password copy.

## Requirements

- **Covered:** R3 (password rule, visible-by-default fields, toggle, on-screen guidance); R10 (patch and repeatable apply script).
- **Not covered by this change:** R1–R2, R4–R9, R11–R26. These requirements need the other planned phases and are not represented as complete here.

## Files changed

- `apps/api/src/lib/passwordRule.ts`
- `apps/api/src/modules/auth/auth.schemas.ts`
- `apps/api/tests/app.test.ts`
- `apps/api/tests/auth.schemas.test.ts`
- `apps/web/src/EnterpriseApp.tsx`
- `apps/web/src/lib/passwordRule.ts`
- `apps/web/src/lib/passwordRule.test.ts`
- `docs/DECISIONS.md`
- `docs/REPORT-PHASE1-PASSWORD.md`
- `patches/020-phase1-password-rule.patch`
- `scripts/apply-020-phase1-password-rule.sh`

No unrelated source file was intentionally modified. Existing uncommitted Phase 5 files were left in place.

## Patch and script

- Patch: `patches/020-phase1-password-rule.patch`
- Apply from repository root: `bash scripts/apply-020-phase1-password-rule.sh`
- The script uses the shared backup/rollback runner, skips `npm install` and Prisma operations because their inputs are unchanged, then builds API/web and runs both test suites.

## Migrations

None.

## Validation

- API production build: passed.
- Web production build: passed.
- API tests: 20 passed, 1 skipped.
- Web tests: 6 passed.
- `git diff --check`: passed.
- Editor diagnostics: no errors in changed TypeScript files.

## Security note and trade-off

This policy is intentionally weaker than the prior 12-character mixed-class rule: an 8-character password with a special character is now accepted, as explicitly requested. This lowers the minimum password strength; the API enforces the same rule for registration and password reset so there is no UI/API mismatch.

## Known issues and next work

This is a narrow Phase 1 correction, not completion of the full Phase 1 scope. Routing, remaining roles, registration validation and wizard handoff still require their planned work. The database-backed test remains skipped unless a test database is configured.

## Tap-through checklist

1. Open the sign-up form and confirm its password is visible on first display.
2. Confirm the helper says “At least 8 characters, including a special character.”
3. Type `1234567!`; both checklist items should pass without uppercase/lowercase/digit-class requirements.
4. Type `12345678`; the special-character check should remain unmet and submit should be blocked.
5. Toggle the eye control and confirm the value becomes masked, then visible again.
6. Open password reset and confirm the same rule, visible default and toggle are present.
