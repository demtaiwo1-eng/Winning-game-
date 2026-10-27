import { offlineFetch } from './offline/fetch';

/**
 * Inside the Capacitor shell the page origin is https://localhost, so relative
 * calls like fetch("/api/v1/...") would hit the phone itself. This rewrites them
 * to the real API origin taken from VITE_API_URL (e.g. https://api.example.com/api/v1).
 * It does nothing on the normal web build.
 */
const raw = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
const isNative =
  typeof window !== "undefined" &&
  !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

let origin = "";
try {
  if (raw && /^https?:\/\//.test(raw)) origin = new URL(raw).origin;
} catch {
  /* invalid URL: leave calls untouched */
}

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (isNative && origin && typeof input === "string" && input.startsWith("/api/")) {
    input = origin + input;
  }
  return offlineFetch(input, init);
};

export {};
