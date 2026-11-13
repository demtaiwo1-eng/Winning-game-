# Quarantined EPHINTA maintenance scripts

**Date:** 2026-11-14  
These are preserved copies moved out of the active application tree for a verification cycle. They are not imported or executed by the product. Their original repository paths and blob SHAs are recorded in [`docs/maintenance/REMOVED_FILES_MANIFEST.md`](../../../docs/maintenance/REMOVED_FILES_MANIFEST.md).

Do not run these copies from this folder. Some were one-off repair/install scripts and can rewrite source files, delete local dependency state, or depend on obsolete Codespaces/Codex workflows.

After the staged-cleanup CI passes, the originals are removed in a separate commit. The quarantine copies remain available for recovery/review in this maintenance branch until the owner approves final removal.

The Android cleanup verification workflow uses the preinstalled runner Android SDK directly; it does not invoke a redundant SDK setup action that attempts to install the removed legacy `tools` package.
