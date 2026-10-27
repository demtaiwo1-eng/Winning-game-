/// <reference lib="webworker" />

/*
 * Browser-only ESS service worker. Capacitor sessions deliberately do not
 * register this worker; the native shell uses Capgo for web-layer updates.
 * The worker owns the same IndexedDB outbox used by the application so the
 * Background Sync tag registered by offline/outbox.ts has a real handler.
 */

export {};

declare global {
  interface Window {
    __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
  }
}

const PRECACHE = self.__WB_MANIFEST || [];


type OutboxRecord = {
  id: string;
  sequence: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  attempts: number;
  nextAttemptAt: number;
  status: 'pending' | 'processing' | 'failed';
  updatedAt: number;
  lastError?: string;
};

type ConflictRecord = {
  id: string;
  createdAt: number;
  resource: string;
  resourceId?: string;
  reason: string;
  localValue?: unknown;
  serverValue?: unknown;
  resolved: boolean;
};

const DB_NAME = 'ess-offline';
const DB_VERSION = 2;
const OUTBOX_STORE = 'mutationOutbox';
const CONFLICT_STORE = 'syncConflicts';
const OUTBOX_TAG = 'ess-mutation-outbox';
const MAX_ATTEMPTS = 8;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('metadata')) {
        const store = db.createObjectStore('metadata');
        store.put(0, 'mutationSequence');
      }
      if (!db.objectStoreNames.contains(CONFLICT_STORE)) {
        const store = db.createObjectStore(CONFLICT_STORE);
        store.createIndex('by-created', 'createdAt');
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE);
        store.createIndex('by-sequence', 'sequence');
        store.createIndex('by-next-attempt', 'nextAttemptAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open ESS offline database'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

async function listOutbox(): Promise<OutboxRecord[]> {
  const db = await openDb();
  const tx = db.transaction(OUTBOX_STORE, 'readonly');
  const index = tx.objectStore(OUTBOX_STORE).index('by-sequence');
  return requestResult(index.getAll()) as Promise<OutboxRecord[]>;
}

async function putOutbox(record: OutboxRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  tx.objectStore(OUTBOX_STORE).put(record);
  await requestResult(tx.objectStore(OUTBOX_STORE).get(record.id));
}

async function deleteOutbox(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  tx.objectStore(OUTBOX_STORE).delete(id);
  await requestResult(tx.objectStore(OUTBOX_STORE).get(id));
}

async function putConflict(conflict: ConflictRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CONFLICT_STORE, 'readwrite');
  tx.objectStore(CONFLICT_STORE).put(conflict);
  await requestResult(tx.objectStore(CONFLICT_STORE).get(conflict.id));
}

function nextBackoff(attempts: number) {
  return Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
}

async function replayOutboxInWorker() {
  if (!self.navigator.onLine) return;

  for (const original of await listOutbox()) {
    if (original.status === 'failed' && original.attempts >= MAX_ATTEMPTS) continue;
    if (original.nextAttemptAt > Date.now()) continue;

    const record: OutboxRecord = { ...original, status: 'processing', updatedAt: Date.now() };
    await putOutbox(record);

    try {
      const response = await fetch(record.url, {
        method: record.method,
        headers: record.headers,
        body: record.body,
      });

      if (response.ok) {
        await deleteOutbox(record.id);
        continue;
      }

      if (response.status === 409) {
        let serverValue: unknown;
        try {
          serverValue = await response.clone().json();
        } catch {
          serverValue = undefined;
        }
        await putConflict({
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          resource: record.url,
          reason: 'Background Sync replay was rejected as a conflict.',
          localValue: record.body,
          serverValue,
          resolved: false,
        });
        await deleteOutbox(record.id);
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      const attempts = record.attempts + 1;
      await putOutbox({
        ...record,
        attempts,
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        nextAttemptAt: Date.now() + nextBackoff(attempts),
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: Date.now(),
      });
      // Preserve order: do not replay later mutations while the earliest one
      // is unavailable.
      break;
    }
  }
}

async function precache() {
  const cache = await caches.open('ess-precache');
  await cache.addAll(PRECACHE.map((entry) => entry.url));
}

function isApiRead(request: Request, url: URL) {
  if (request.method !== 'GET' || !url.pathname.startsWith('/api/v1/')) return false;
  return /^\/api\/v1\/(events|listings|marketplace|guests|tasks|budget|questionnaire|messages)/.test(url.pathname);
}

function isNetworkOnly(url: URL) {
  return /^\/api\/v1\/(auth|payments|wallet|escrow|checkout)(\/|$)/.test(url.pathname);
}

function isStatic(request: Request) {
  return request.destination === 'script' || request.destination === 'style' ||
    request.destination === 'worker' || request.destination === 'font' || request.destination === 'image';
}

async function staleWhileRevalidate(request: Request) {
  const cache = await caches.open('ess-app-data');
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => undefined);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request: Request) {
  const cache = await caches.open('ess-static');
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('install', (event: Event) => {
  (event as ExtendableEvent).waitUntil(precache().then(() => (self as unknown as ServiceWorkerGlobalScope).skipWaiting()));
});

self.addEventListener('activate', (event: Event) => {
  (event as ExtendableEvent).waitUntil((self as unknown as ServiceWorkerGlobalScope).clients.claim());
});

self.addEventListener('fetch', (event: Event) => {
  const fetchEvent = event as FetchEvent;
  const request = fetchEvent.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isApiRead(request, url)) {
    fetchEvent.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isNetworkOnly(url) || (url.pathname.startsWith('/api/') && request.method !== 'GET')) {
    fetchEvent.respondWith(fetch(request));
    return;
  }

  if (isStatic(request)) {
    fetchEvent.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    fetchEvent.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open('ess-precache');
        return (await cache.match('/index.html')) || (await cache.match('/offline.html')) || Response.error();
      }),
    );
  }
});

self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as Event & { tag: string; waitUntil(promise: Promise<unknown>): void };
  if (syncEvent.tag === OUTBOX_TAG) syncEvent.waitUntil(replayOutboxInWorker());
});

self.addEventListener('message', (event: Event) => {
  const messageEvent = event as ExtendableMessageEvent;
  if (messageEvent.data?.type === 'ESS_SYNC_NOW') {
    void replayOutboxInWorker();
  }
  if (messageEvent.data?.type === 'SKIP_WAITING') {
    void (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
  }
});
