import { offlineFetch } from './offline/fetch';
import { resolveApiRequest } from './apiUrl';

/**
 * Route relative API requests to the configured HTTPS host on both web and
 * Capacitor; without this, a separately hosted client would call its own origin.
 */
const raw = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;

let origin = "";
try {
  if (raw && /^https?:\/\//.test(raw)) origin = new URL(raw).origin;
} catch {
  /* invalid URL: leave calls untouched */
}

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  return offlineFetch(resolveApiRequest(input, origin), init);
};

export {};
