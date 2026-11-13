#!/usr/bin/env node
/**
 * Deprecated by the database-backed global payment mode.
 * Do not mutate Render environment variables to switch DEMO/TEST/LIVE.
 * Use the ADMIN dashboard: Platform operations > Central payment mode.
 * The 2% incoming and outgoing fee policy is enforced by the API.
 */
console.error("[payment-mode] This script is retired. Change the mode in the authenticated EPHINTA ADMIN dashboard. No Render variables were changed.");
process.exit(2);
