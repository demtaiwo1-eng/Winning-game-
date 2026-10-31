export const RECONCILIATION_MAX_ATTEMPTS = 8;
export const RECONCILIATION_LOCK_MS = 2 * 60_000;
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 6 * 60 * 60_000;

/** Exponential retry delay capped at six hours. */
export function reconciliationBackoffMs(attempt: number): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.min(safeAttempt - 1, 20), MAX_BACKOFF_MS);
}

/** Persist an error category only; provider messages may contain sensitive data. */
export function reconciliationErrorCode(error: unknown): string {
  return error instanceof Error ? error.name.slice(0, 80) : "UnknownError";
}
