# Unused Files Audit

This report is a practical cleanup review, not a destructive deletion checklist. It highlights files that look either legacy, generated, or otherwise non-core to the active application build. The goal is to reduce confusion during maintenance without deleting anything that might still be needed for local workflows or migration history.

## High-confidence candidates for review

These files appear to be local media or troubleshooting payloads rather than active application code:

- Here we are-1 -Wale Waves_ESS_Wedding.mp3
- Here we are-2 -Wale Waves_ESS_Wedding.mp3
- Welcome, Little One-1-Wale Waves_ESS_Naming.mp3
- Welcome, Little One-2-Wale Waves_ESS_Naming.mp3
- You Will Live in Our Hearts-1-Wale Waves_ESS_Burials.mp3
- You Will Live in Our Hearts-2-Wale Waves_ESS_Burials.mp3

These older scripts may still be useful for local repair workflows, but they should be reviewed before being retained permanently:

- apply-ephinta-ui-money-fixes.sh
- ephinta-complete.sh
- ephinta-fix.sh
- ess-cleanup.sh
- fix-ephinta-signing.sh
- run-dev-safe.sh
- run-ess-app-force.sh
- run-ess-app.sh
- search-code.sh
- setup-local-postgres.sh
- update-ephinta.sh

## Generated or build artifacts to review separately

The following are likely generated outputs and should be treated as build-side material unless deliberately versioned:

- apps/api/dist/
- apps/api/node_modules/ (normally ignored by Git)
- node_modules/ (workspace dependency install output)

## Non-deletion conclusion

No active source file was identified as clearly orphaned by the app runtime itself. The main candidates are legacy media, local developer utilities, and generated artifacts. These should be reviewed manually before removal because some of them may still be part of migration, debugging, or deployment support workflows.

## Recommended next action

1. Keep the active product code and working tests in place.
2. Archive or relocate legacy media and repair scripts only if they are no longer required.
3. Treat generated build output as disposable, not product source.
4. Keep the root docs and implementation reports as the source of truth for the current app state.
