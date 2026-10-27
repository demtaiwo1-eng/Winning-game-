import { offlineFetch } from './offline/fetch';
import { getApiBaseUrl, resolveApiRequest } from './apiUrl';

/**
 * Route relative API requests to the configured HTTPS host on both web and
 * Capacitor; without this, a separately hosted client would call its own origin.
 */
const raw = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
const apiBaseUrl = raw ? getApiBaseUrl(raw) : '';

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  return offlineFetch(resolveApiRequest(input, apiBaseUrl), init);
};

export {};
