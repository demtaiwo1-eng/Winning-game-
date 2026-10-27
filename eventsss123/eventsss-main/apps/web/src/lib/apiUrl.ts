export function getApiBaseUrl(configuredUrl: string): string {
  try {
    const url = new URL(configuredUrl);
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost)) ||
        url.username || url.password) {
      return '';
    }

    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function resolveApiRequest(input: RequestInfo | URL, apiBaseUrl: string): RequestInfo | URL {
  if (apiBaseUrl && typeof input === 'string' && input.startsWith('/api/')) {
    return `${apiBaseUrl}${input}`;
  }
  return input;
}
