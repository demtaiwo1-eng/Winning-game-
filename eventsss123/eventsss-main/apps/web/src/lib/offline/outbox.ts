import { addConflict, countPendingMutations, getOfflineDB, nextMutationSequence, type MutationRecord } from './db';

const networkFetch = globalThis.fetch.bind(globalThis);
const OUTBOX_MAX_ATTEMPTS = 8;

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function backoff(attempts: number) {
  return Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
}

export function isSafeOfflineMutation(method: string, url: string) {
  const m = method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) return false;

  let pathname: string;
  try {
    pathname = new URL(url, 'https://ess.invalid').pathname;
  } catch {
    pathname = url.split(/[?#]/, 1)[0] || '';
  }

  // Only versioned ESS API mutations may enter the outbox.
  if (!/^\/api\/v1\//i.test(pathname)) return false;

  // Privileged admin actions must never be queued for delayed background replay.
  if (/^\/api\/v1\/admin(?:\/|$)/i.test(pathname)) return false;

  // Authentication and all financial state changes must remain online-only.
  if (/^\/api\/v1\/(auth|login|register|refresh|logout|payments?|wallet|escrow)(?:\/|$)/i.test(pathname)) {
    return false;
  }

  // Cart edits can be queued. Every other checkout endpoint (including nested
  // wallet-payment and checkout-session actions) must be sent to the network.
  if (/^\/api\/v1\/checkout(?:\/|$)/i.test(pathname) &&
      !/^\/api\/v1\/checkout\/cart(?:\/|$)/i.test(pathname)) {
    return false;
  }

  return true;
}

export async function enqueueMutation(input: { method: string; url: string; headers?: HeadersInit; body?: BodyInit | null }) {
  if (!isSafeOfflineMutation(input.method, input.url)) throw new Error('This operation must be performed while online.');

  const db = await getOfflineDB();
  const headers = new Headers(input.headers);
  const idempotencyKey = headers.get('Idempotency-Key') || makeId();
  headers.set('Idempotency-Key', idempotencyKey);
  const now = Date.now();
  const sequence = await nextMutationSequence();

  const record: MutationRecord = {
    id: makeId(),
    createdAt: now,
    updatedAt: now,
    sequence,
    method: input.method.toUpperCase(),
    url: input.url,
    headers: Object.fromEntries(headers.entries()),
    body: typeof input.body === 'string' ? input.body : input.body ? String(input.body) : null,
    idempotencyKey,
    attempts: 0,
    nextAttemptAt: now,
    status: 'pending',
  };
  await db.put('mutationOutbox', record, record.id);

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      const syncManager = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
      if (syncManager) await syncManager.register('ess-mutation-outbox');
    }
  } catch {
    // Online/focus/app-resume/timer replay remains authoritative when Background Sync is unavailable.
  }

  return record;
}

export async function replayOutbox() {
  if (!navigator.onLine) return { sent: 0, failed: 0 };
  const db = await getOfflineDB();
  const pending = await db.getAllFromIndex('mutationOutbox', 'by-sequence');
  let sent = 0;
  let failed = 0;

  for (const record of pending) {
    if (record.status === 'failed' && record.attempts >= OUTBOX_MAX_ATTEMPTS) { failed++; continue; }
    if (record.nextAttemptAt > Date.now()) continue;

    await db.put('mutationOutbox', { ...record, status: 'processing', updatedAt: Date.now() }, record.id);
    try {
      const response = await networkFetch(record.url, { method: record.method, headers: record.headers, body: record.body });
      if (response.ok) { await db.delete('mutationOutbox', record.id); sent++; continue; }
      if (response.status === 409) {
        let serverValue: unknown;
        try { serverValue = await response.clone().json(); } catch { serverValue = undefined; }
        await addConflict({
          id: makeId(), createdAt: Date.now(), resource: record.url,
          reason: 'Server rejected the offline mutation as a conflict.',
          localValue: record.body, serverValue, resolved: false,
        });
        await db.delete('mutationOutbox', record.id);
        failed++;
        continue;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      const attempts = record.attempts + 1;
      await db.put('mutationOutbox', {
        ...record,
        attempts,
        status: attempts >= OUTBOX_MAX_ATTEMPTS ? 'failed' : 'pending',
        nextAttemptAt: Date.now() + backoff(attempts),
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: Date.now(),
      }, record.id);
      failed++;
      break;
    }
  }
  return { sent, failed };
}

export async function pendingMutationCount() { return countPendingMutations(); }
