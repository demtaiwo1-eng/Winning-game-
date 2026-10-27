import { getOffline, putOffline } from './db';
import { enqueueMutation } from './outbox';

const networkFetch = globalThis.fetch.bind(globalThis);

function isNetworkOnly(url: string) {
  let pathname: string;
  try {
    pathname = new URL(url, 'https://ess.invalid').pathname;
  } catch {
    pathname = url.split(/[?#]/, 1)[0] || '';
  }

  if (/^\/api\/v1\/(auth|login|register|refresh|logout|payments?|wallet|escrow)(?:\/|$)/i.test(pathname)) {
    return true;
  }

  // Offline cart editing is permitted, but every other checkout endpoint is online-only.
  if (/^\/api\/v1\/checkout(?:\/|$)/i.test(pathname)) {
    return !/^\/api\/v1\/checkout\/cart(?:\/|$)/i.test(pathname);
  }

  return false;
}

function offlineStoreFor(pathname: string) {
  if (/\/events(?:\/|$)/.test(pathname)) return 'events' as const;
  if (/\/guests(?:\/|$)/.test(pathname)) return 'guests' as const;
  if (/\/tasks(?:\/|$)/.test(pathname)) return 'tasks' as const;
  if (/\/budget(?:\/|$)/.test(pathname)) return 'budget' as const;
  if (/\/checkout\/cart(?:\/|$)/.test(pathname)) return 'cart' as const;
  if (/\/(listings|marketplace)(?:\/|$)/.test(pathname)) return 'listingSnapshots' as const;
  if (/\/questionnaire(?:\/|$)/.test(pathname)) return 'questionnaireDrafts' as const;
  if (/\/messages(?:\/|$)/.test(pathname)) return 'messages' as const;
  return null;
}

function cloneInit(init?: RequestInit): RequestInit {
  return { ...init, headers: init?.headers };
}

async function cacheRead(store: ReturnType<typeof offlineStoreFor>, key: string) {
  if (!store) return undefined;
  return getOffline<unknown>(store, key);
}

async function cacheResponse(store: ReturnType<typeof offlineStoreFor>, key: string, response: Response) {
  if (!store || !response.ok) return;
  try {
    const data = await response.clone().json();
    await putOffline(store, key, data);
  } catch {
    // Non-JSON responses are not persisted in the structured offline stores.
  }
}

export async function offlineFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const request = new Request(input, cloneInit(init));
  const method = request.method.toUpperCase();
  const url = request.url;
  const parsed = new URL(url);
  const pathname = parsed.pathname;

  if (!pathname.startsWith('/api/v1/')) return networkFetch(request);

  const store = offlineStoreFor(pathname);
  const networkOnly = isNetworkOnly(url);

  if (navigator.onLine || method === 'GET' || method === 'HEAD' || networkOnly) {
    try {
      const response = await networkFetch(request);
      if (method === 'GET') await cacheResponse(store, url, response);
      return response;
    } catch (error) {
      if (method === 'GET' || method === 'HEAD' || networkOnly) {
        if (method === 'GET') {
          const cached = await cacheRead(store, url);
          if (cached !== undefined) {
            return new Response(JSON.stringify(cached), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'X-ESS-Offline-Cache': 'true' },
            });
          }
        }
        throw error;
      }
    }
  }

  if (networkOnly) throw new Error('This operation must be performed while online.');

  const body = await request.clone().text();
  const record = await enqueueMutation({ method, url, headers: request.headers, body: body || null });

  return new Response(JSON.stringify({ queued: true, offline: true, idempotencyKey: record.idempotencyKey }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
}
